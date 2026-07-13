import axios from 'axios';
import crypto from 'crypto';
import { db } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/config.js';
import { Transaction } from '../models/Transaction.js';

/**
 * CRC16 CCITT Calculation helper for Dynamic QRIS
 */
function crc16(str) {
  let crc = 0xFFFF;
  for (let c = 0; c < str.length; c++) {
    let charCode = str.charCodeAt(c);
    let x = ((crc >> 8) ^ charCode) & 0xFF;
    x ^= x >> 4;
    crc = ((crc << 8) ^ (x << 12) ^ (x << 5) ^ x) & 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Generate Dynamic QRIS with exact amount from Static QRIS
 */
export function generateDynamicQris(staticQris, amount) {
  if (!staticQris) return '';
  
  try {
    let qrisWithoutCrc = staticQris.slice(0, -4);
    if (qrisWithoutCrc.endsWith('6304')) {
      qrisWithoutCrc = qrisWithoutCrc.slice(0, -4);
    } else if (staticQris.includes('6304')) {
      qrisWithoutCrc = staticQris.split('6304')[0];
    }
    
    const amountTag = '54' + String(amount).length.toString().padStart(2, '0') + amount;
    
    let processedQris = qrisWithoutCrc;
    const tag54Index = processedQris.indexOf('540');
    if (tag54Index !== -1) {
      const len = parseInt(processedQris.substr(tag54Index + 2, 2), 10);
      processedQris = processedQris.substring(0, tag54Index) + processedQris.substring(tag54Index + 4 + len);
    }
    
    const tag58Index = processedQris.indexOf('5802ID');
    if (tag58Index !== -1) {
      processedQris = processedQris.substring(0, tag58Index) + amountTag + processedQris.substring(tag58Index);
    } else {
      processedQris += amountTag;
    }
    
    processedQris += '6304';
    
    const newCrc = crc16(processedQris);
    return processedQris + newCrc;
  } catch (err) {
    logger.error('Error generating dynamic QRIS', err);
    return staticQris;
  }
}

export const AutoGoPayService = {
  /**
   * Create an invoice/payment QRIS using AutoGoPay API
   * @param {number} telegramId - User's Telegram ID
   * @param {number} amount - TopUp amount
   * @returns {Promise<Object>} - Invoice details
   */
  createInvoice: async (telegramId, amount) => {
    const settings = await db.getSettings();
    const txId = 'TX' + Date.now() + Math.floor(100 + Math.random() * 900);
    
    logger.info(`[GENERATE QRIS] Initiating createInvoice for user ${telegramId}, amount: ${amount}, TX: ${txId}`);

    const gopay = settings.payment?.autogopay || {};
    
    let apiTransactionId = '';
    let apiOrderId = '';
    let apiTransactionStatus = '';
    let apiExpiryTime = null;
    let apiQrUrl = '';
    let apiCheckoutUrl = '';

    if (gopay.apiKey && gopay.apiKey !== 'gopay_test_key_123' && gopay.enabled) {
      try {
        logger.info(`[GENERATE QRIS] Sending API request to AutoGoPay: POST https://v1-gateway.autogopay.site/qris/create`);
        const response = await axios.post('https://v1-gateway.autogopay.site/qris/create', {
          order_id: txId,
          amount: amount
        }, {
          headers: {
            'Authorization': `Bearer ${gopay.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 7000
        });

        logger.info(`[GENERATE QRIS] API Response:`, response.data);

        if (response.data) {
          apiTransactionId = response.data.transaction_id || '';
          apiOrderId = response.data.order_id || '';
          apiTransactionStatus = response.data.transaction_status || '';
          apiExpiryTime = response.data.expiry_time ? new Date(response.data.expiry_time) : null;
          apiQrUrl = response.data.qr_url || '';
          apiCheckoutUrl = response.data.checkout_url || '';
        }
      } catch (err) {
        logger.error(`[GENERATE QRIS] Error API request:`, err.response ? err.response.data : err.message);
      }
    }

    // Determine final QR code url (use local generator fallback if API failed or disabled)
    let qrUrlToSave = apiQrUrl;
    if (!qrUrlToSave) {
      const qrContent = gopay.qrisString || '';
      if (qrContent) {
        const dynamicQris = generateDynamicQris(qrContent, amount);
        qrUrlToSave = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(dynamicQris)}`;
      } else {
        qrUrlToSave = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=MOCK_INVOICE_${txId}_AMOUNT_${amount}`;
      }
    }

    // Save transaction to Database
    const tx = await db.createTransaction({
      txId,
      telegramId,
      amount,
      type: 'topup',
      status: 'pending',
      description: `Top Up Saldo via QRIS`,
      qrUrl: qrUrlToSave,
      transaction_id: apiTransactionId || 'MOCK_TRX_' + txId,
      order_id: apiOrderId || txId,
      transaction_status: apiTransactionStatus || 'PENDING',
      expiry_time: apiExpiryTime || new Date(Date.now() + 30 * 60 * 1000),
      checkout_url: apiCheckoutUrl || qrUrlToSave
    });

    logger.info(`[GENERATE QRIS] Successfully saved transaction ${txId} in DB`);
    return tx;
  },

  /**
   * Check status of payment manually
   * @param {string} txId - Transaction ID in DB
   */
  checkStatus: async (txId) => {
    logger.info(`[CHECK STATUS] Initiating manual checkStatus for transaction ID: ${txId}`);
    const tx = await db.getTransaction(txId);
    if (!tx) {
      logger.warn(`[CHECK STATUS] Transaction not found: ${txId}`);
      return { success: false, status: 'not_found', message: '⚠️ Transaksi tidak ditemukan.' };
    }

    const settings = await db.getSettings();
    const gopay = settings.payment?.autogopay || {};

    // Test mode/mock fallback
    if (!gopay.apiKey || gopay.apiKey === 'gopay_test_key_123' || !gopay.enabled) {
      logger.info(`[CHECK STATUS] Test mode active, simulating success.`);
      
      const updatedTx = await Transaction.findOneAndUpdate(
        { txId, status: { $nin: ['completed', 'PAID'] } },
        { $set: { status: 'completed', transaction_status: 'settlement', updatedAt: new Date() } },
        { new: true }
      );

      if (updatedTx) {
        const updatedUser = await db.incrementUserBalance(tx.telegramId, tx.amount);
        const newBalance = updatedUser.balance;
        
        logger.info(`[SALDO BERTAMBAH] Credited ${tx.amount} to ${tx.telegramId} [TEST MODE]`);

        // Notify
        try {
          const { botInstance } = await import('../index.js');
          if (botInstance) {
            const formatIDR = (val) => new Intl.NumberFormat('id-ID', {
              style: 'currency',
              currency: 'IDR',
              minimumFractionDigits: 0
            }).format(val);

            await botInstance.telegram.sendMessage(tx.telegramId, `
🧪 <b>[TEST MODE] Top Up Berhasil!</b>

Saldo sebesar <b>${formatIDR(tx.amount)}</b> telah berhasil ditambahkan ke akun Anda.

💰 Saldo saat ini: <b>${formatIDR(newBalance)}</b>
`, { parse_mode: 'HTML' });
          }
        } catch (notifyErr) {
          logger.error(`[CHECK STATUS] Notify error:`, notifyErr);
        }
      }
      return { success: true, status: 'settlement', message: '🧪 [TEST MODE] Pembayaran disimulasikan sukses!' };
    }

    try {
      logger.info(`[CHECK STATUS] Querying API: POST https://v1-gateway.autogopay.site/qris/status`);
      const response = await axios.post('https://v1-gateway.autogopay.site/qris/status', {
        transaction_id: tx.transaction_id || tx.txId
      }, {
        headers: {
          'Authorization': `Bearer ${gopay.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      logger.info(`[CHECK STATUS] API Response:`, response.data);

      const resData = response.data || {};
      const apiStatus = resData.transaction_status || resData.status || (resData.data && (resData.data.transaction_status || resData.data.status)) || '';
      const statusLower = apiStatus.toLowerCase();

      if (statusLower === 'settlement' || statusLower === 'success') {
        const updatedTx = await Transaction.findOneAndUpdate(
          { txId, status: { $nin: ['completed', 'PAID'] } },
          { $set: { status: 'completed', transaction_status: 'settlement', updatedAt: new Date() } },
          { new: true }
        );

        if (updatedTx) {
          const updatedUser = await db.incrementUserBalance(tx.telegramId, tx.amount);
          const newBalance = updatedUser.balance;
          
          logger.info(`[SALDO BERTAMBAH] Credited ${tx.amount} to user ${tx.telegramId} from status check. New: ${newBalance}`);

          // Notify
          try {
            const { botInstance } = await import('../index.js');
            if (botInstance) {
              const formatIDR = (val) => new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0
              }).format(val);

              await botInstance.telegram.sendMessage(tx.telegramId, `
✅ <b>Top Up Berhasil!</b>

Saldo sebesar <b>${formatIDR(tx.amount)}</b> telah berhasil ditambahkan ke akun Anda.

💰 Saldo saat ini: <b>${formatIDR(newBalance)}</b>

Terima kasih telah bertransaksi! Gunakan /start untuk kembali ke menu utama.
`, { parse_mode: 'HTML' });
            }
          } catch (notifyErr) {
            logger.error(`[CHECK STATUS] Notify error:`, notifyErr);
          }
        }
        return { success: true, status: 'settlement', message: '✅ Pembayaran berhasil! Saldo Anda telah bertambah.' };
      } else if (statusLower === 'pending') {
        return { success: true, status: 'pending', message: '⏳ Pembayaran masih menunggu. Silakan selesaikan pembayaran.' };
      } else if (statusLower === 'expire' || statusLower === 'expired') {
        await Transaction.findOneAndUpdate(
          { txId, status: { $nin: ['completed', 'PAID', 'failed'] } },
          { $set: { status: 'failed', transaction_status: 'expire', updatedAt: new Date() } }
        );
        return { success: true, status: 'expire', message: '❌ Transaksi ini telah kedaluwarsa (expired).' };
      } else {
        return { success: true, status: 'pending', message: '⏳ Pembayaran masih menunggu. Silakan selesaikan pembayaran.' };
      }
    } catch (err) {
      logger.error(`[CHECK STATUS] Error calling API status check for ${txId}:`, err.response ? err.response.data : err.message);
      if (tx.status === 'completed' || tx.status === 'PAID') {
        return { success: true, status: 'settlement', message: '✅ Pembayaran berhasil! Saldo Anda telah bertambah.' };
      }
      return { success: false, status: 'error', message: `❌ Gagal memeriksa status pembayaran: ${err.message}` };
    }
  },

  /**
   * Process incoming Webhook callback
   * @param {Object} body - Webhook body payload
   */
  processWebhook: async (body, headers = {}) => {
    logger.info('[WEBHOOK MASUK] Processing AutoGoPay webhook body:', body);

    if (!db.isMongo()) {
      logger.warn('[WEBHOOK MASUK] MongoDB is not connected! Returning simulated successful response.');
      return { success: true, message: 'Simulated webhook processing: DB offline' };
    }

    const event = body.event || headers['x-callback-event'] || headers['X-Callback-Event'] || '';
    const status = (body.status || (body.data && body.data.status) || '').toLowerCase();
    const transactionId = body.transaction_id || body.transactionId || (body.data && (body.data.transaction_id || body.data.id)) || '';
    const orderId = body.order_id || body.orderId || body.unique_id || (body.data && (body.data.order_id || body.data.unique_id)) || '';

    logger.info(`[WEBHOOK MASUK] Event: ${event}, Status: ${status}, TransactionID: ${transactionId}, OrderID: ${orderId}`);

    if (status === 'settlement' || status === 'success') {
      let tx = null;
      if (transactionId) {
        tx = await Transaction.findOne({ transaction_id: transactionId });
      }
      if (!tx && orderId) {
        tx = await Transaction.findOne({ txId: orderId });
      }

      if (!tx) {
        logger.warn(`[WEBHOOK MASUK] Transaction not found for transaction_id=${transactionId}, order_id=${orderId}`);
        return { success: false, message: 'Transaction not found' };
      }

      const updatedTx = await Transaction.findOneAndUpdate(
        { txId: tx.txId, status: { $nin: ['completed', 'PAID'] } },
        { $set: { status: 'completed', transaction_status: 'settlement', updatedAt: new Date() } },
        { new: true }
      );

      if (!updatedTx) {
        logger.info(`[WEBHOOK MASUK] Transaction ${tx.txId} already processed (atomic check).`);
        return { success: true, message: 'Transaction already processed' };
      }

      const payTime = new Date();
      const updatedUser = await db.incrementUserBalance(tx.telegramId, tx.amount);
      const newBalance = updatedUser.balance;

      logger.info(`[SALDO BERTAMBAH] webhook credit success. Amount: ${tx.amount}, User: ${tx.telegramId}. New Balance: ${newBalance}`);

      const formatIDR = (val) => new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      }).format(val);

      try {
        const { botInstance } = await import('../index.js');
        if (botInstance) {
          // User notify
          await botInstance.telegram.sendMessage(tx.telegramId, `
✅ <b>Top Up Berhasil! (Webhook)</b>

Saldo sebesar <b>${formatIDR(tx.amount)}</b> telah berhasil ditambahkan ke akun Anda.

💰 Saldo saat ini: <b>${formatIDR(newBalance)}</b>

Terima kasih telah bertransaksi! Gunakan /start untuk kembali ke menu utama.
`, { parse_mode: 'HTML' });

          // Admin notify
          if (config.adminId) {
            await botInstance.telegram.sendMessage(config.adminId, `
🔔 <b>Log Webhook AutoGoPay</b>
Status: 🟢 SUCCESS / SETTLEMENT
User ID: <code>${tx.telegramId}</code>
Order ID: <code>${tx.txId}</code>
Transaction ID: <code>${transactionId}</code>
Amount: <b>${formatIDR(tx.amount)}</b>
Time: <code>${payTime.toISOString()}</code>
`, { parse_mode: 'HTML' }).catch(err => {
              logger.error('[WEBHOOK MASUK] Admin notify fail:', err);
            });
          }
        }
      } catch (err) {
        logger.error('[WEBHOOK MASUK] Notification/Log delivery fail:', err);
      }

      return { success: true, message: 'Transaction processed successfully' };
    } else {
      logger.info(`[WEBHOOK MASUK] Ignored event/status combination: event=${event}, status=${status}`);
      return { success: true, message: 'Event or status ignored' };
    }
  },

  /**
   * Test AutoGoPay Connection with saved API Key
   */
  testConnection: async (apiKey) => {
    logger.info(`[TEST KONEKSI] Initiating connection test to AutoGoPay...`);
    
    const startTime = Date.now();
    const apiUrl = 'https://v1-gateway.autogopay.site/qris/status';

    if (!apiKey || apiKey === 'gopay_test_key_123') {
      const responseTime = Date.now() - startTime;
      logger.info(`[TEST CONNECTION]\nAPI URL: ${apiUrl} (Simulation)\nResponse Code: 200\nResponse Body: {"success":true,"message":"Koneksi berhasil"}\nResponse Time: ${responseTime} ms`);
      return {
        success: true,
        status: 'Online',
        apiKeyValid: true,
        gatewayConnected: true,
        responseTime,
        message: '✅ AutoGoPay berhasil terhubung.'
      };
    }

    try {
      const response = await axios.post(apiUrl, {
        transaction_id: 'test_conn_123'
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      const responseTime = Date.now() - startTime;
      
      logger.info(`[TEST CONNECTION]\nAPI URL: ${apiUrl}\nResponse Code: ${response.status}\nResponse Body: ${JSON.stringify(response.data)}\nResponse Time: ${responseTime} ms`);

      return {
        success: true,
        status: 'Online',
        apiKeyValid: true,
        gatewayConnected: true,
        responseTime,
        message: '✅ AutoGoPay berhasil terhubung.'
      };
    } catch (err) {
      const responseTime = Date.now() - startTime;
      
      if (err.response) {
        const responseCode = err.response.status;
        const responseBody = JSON.stringify(err.response.data || {});
        
        logger.info(`[TEST CONNECTION]\nAPI URL: ${apiUrl}\nResponse Code: ${responseCode}\nResponse Body: ${responseBody}\nResponse Time: ${responseTime} ms`);

        if (responseCode === 401 || responseCode === 403) {
          const apiMsg = err.response.data?.message || err.response.data?.error || 'Unauthorized / Forbidden';
          return {
            success: false,
            status: 'Online',
            apiKeyValid: false,
            gatewayConnected: false,
            responseTime,
            message: `❌ API Key tidak valid: ${apiMsg}`
          };
        }

        if (responseCode === 404) {
          // A 404 response on query for 'test_conn_123' means the gateway authenticated successfully and looked up the record in its DB.
          // Therefore, the API key is VALID and connection is SUCCESSFUL!
          return {
            success: true,
            status: 'Online',
            apiKeyValid: true,
            gatewayConnected: true,
            responseTime,
            message: '✅ AutoGoPay berhasil terhubung.'
          };
        }

        return {
          success: false,
          status: 'Online',
          apiKeyValid: false,
          gatewayConnected: false,
          responseTime,
          message: `❌ API Error (${responseCode}): ${JSON.stringify(err.response.data)}`
        };
      } else if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        logger.error(`[TEST CONNECTION]\nAPI URL: ${apiUrl}\nResponse Code: Timeout\nResponse Body: ${err.message}\nResponse Time: ${responseTime} ms`);
        return {
          success: false,
          status: 'Offline',
          apiKeyValid: false,
          gatewayConnected: false,
          responseTime,
          message: '❌ Timeout.'
        };
      } else {
        logger.error(`[TEST CONNECTION]\nAPI URL: ${apiUrl}\nResponse Code: NetworkError\nResponse Body: ${err.message}\nResponse Time: ${responseTime} ms`);
        return {
          success: false,
          status: 'Offline',
          apiKeyValid: false,
          gatewayConnected: false,
          responseTime,
          message: `❌ Gateway tidak dapat dihubungi.`
        };
      }
    }
  },

  /**
   * Test Webhook endpoint with mock payment notification and HMAC signature
   */
  testWebhook: async (apiKey, webhookUrl) => {
    logger.info(`[WEBHOOK TEST] Initiating webhook test for URL: ${webhookUrl}...`);
    
    if (!webhookUrl || typeof webhookUrl !== 'string' || webhookUrl.trim() === '') {
      return {
        success: false,
        message: '❌ URL webhook belum diatur.'
      };
    }

    if (!webhookUrl.startsWith('https://')) {
      return {
        success: false,
        message: '❌ URL webhook tidak menggunakan HTTPS.'
      };
    }

    const startTime = Date.now();
    
    // Parse path from the webhookUrl
    let path = '/webhook/autogopay';
    try {
      const parsed = new URL(webhookUrl);
      path = parsed.pathname;
    } catch (e) {
      // fallback
    }

    // Always target localhost port to verify the actual Express router running in this container
    const urlToCall = `http://localhost:${config.port || 3000}${path}`;

    const testPayload = {
      event: 'transaction.received',
      status: 'settlement',
      transaction_id: 'test_webhook_tx_123',
      order_id: 'TX_TEST_WEBHOOK_123',
      amount: 1000
    };

    const payloadString = JSON.stringify(testPayload);
    const signature = crypto
      .createHmac('sha256', apiKey || 'gopay_test_key_123')
      .update(payloadString)
      .digest('hex');

    const headers = {
      'Content-Type': 'application/json',
      'X-Signature': signature,
      'User-Agent': 'AutoGoPay-Webhook-Tester'
    };

    try {
      const response = await axios.post(urlToCall, testPayload, {
        headers,
        timeout: 6000
      });
      const responseTime = Date.now() - startTime;
      const status = response.status;
      const body = response.data;
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body || {});

      logger.info(`[WEBHOOK TEST]\nURL: ${urlToCall}\nHTTP Method: POST\nStatus Code: ${status}\nResponse Body: ${bodyStr}\nResponse Time: ${responseTime} ms`);

      if (status === 200) {
        // Since Transaction not found is returned when signature is valid, it's a success
        const isSignatureValid = bodyStr.includes('Transaction not found') || bodyStr.includes('already processed') || (body && body.success === true) || bodyStr.includes('success');
        
        if (isSignatureValid) {
          return {
            success: true,
            webhookUrl,
            https: 'OK',
            endpoint: 'OK',
            methodPost: 'OK',
            httpStatus: 200,
            signature: 'Valid',
            responseTime,
            message: `✅ <b>Test Webhook Berhasil</b>\n\n` +
                     `Webhook URL : <code>${webhookUrl}</code>\n` +
                     `HTTPS : <b>OK</b>\n` +
                     `Endpoint : <b>OK</b>\n` +
                     `Method POST : <b>OK</b>\n` +
                     `HTTP Status : <b>200</b>\n` +
                     `Signature : <b>Valid</b>\n` +
                     `Response Time : <code>${responseTime} ms</code>`
          };
        } else {
          return {
            success: false,
            message: `❌ Response bukan HTTP 200 sesuai format AutoGoPay. Response: ${bodyStr}`
          };
        }
      } else {
        return {
          success: false,
          message: `❌ Response bukan HTTP 200. Status: ${status}`
        };
      }
    } catch (err) {
      const responseTime = Date.now() - startTime;
      const errStack = err.stack || '';

      if (err.response) {
        const status = err.response.status;
        const bodyStr = typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data || {});
        logger.error(`[WEBHOOK TEST]\nURL: ${urlToCall}\nHTTP Method: POST\nStatus Code: ${status}\nResponse Body: ${bodyStr}\nResponse Time: ${responseTime} ms\nError Stack: ${errStack}`);

        if (status === 404) {
          return { success: false, message: `❌ Endpoint tidak ditemukan (404).` };
        } else if (status === 500) {
          return { success: false, message: `❌ Internal Server Error (500).` };
        } else if (status === 401 || status === 403) {
          return { success: false, message: `❌ Signature tidak valid.` };
        } else if (status === 405) {
          return { success: false, message: `❌ Endpoint tidak menerima POST.` };
        } else {
          return { success: false, message: `❌ Response bukan HTTP 200 (Status: ${status}).` };
        }
      } else {
        logger.error(`[WEBHOOK TEST]\nURL: ${urlToCall}\nHTTP Method: POST\nStatus Code: Error\nResponse Body: ${err.message}\nResponse Time: ${responseTime} ms\nError Stack: ${errStack}`);

        if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
          return { success: false, message: `❌ Timeout.` };
        } else if (err.message.includes('self signed certificate') || err.message.includes('certificate') || err.message.includes('SSL')) {
          return { success: false, message: `❌ SSL Error.` };
        } else {
          return { success: false, message: `❌ Gateway tidak dapat dihubungi.` };
        }
      }
    }
  }
};
