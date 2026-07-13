import express from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { db } from '../config/db.js';
import { AutoGoPayService } from '../services/autogopay.js';

const router = express.Router();

// --- API ROUTE: Health Check ---
router.get('/api/health', async (req, res) => {
  try {
    const { getBotStatus } = await import('../index.js');
    const status = getBotStatus();
    res.json(status);
  } catch (err) {
    logger.error('Failed to retrieve health status', err);
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// --- GET ROUTE: Webhook Verification / Ready Check ---
router.get('/webhook/autogopay', (req, res) => {
  logger.info(`[WEBHOOK AUDIT - GET] Method: ${req.method} | URL: ${req.originalUrl} | Status: 200`);
  return res.status(200).send('Webhook Ready');
});

// --- API ROUTE: AutoGoPay Webhook Handler Function ---
async function handleAutoGoPayWebhook(req, res) {
  const method = req.method;
  const url = req.originalUrl;
  const headers = req.headers;
  const body = req.body || {};
  
  // Retrieve signature safely (case-insensitive check)
  const signature = headers['x-signature'] || headers['X-Signature'] || headers['x-signature-hex'] || headers['x-gopay-signature'];

  logger.info(`[WEBHOOK MASUK] AutoGoPay Webhook Triggered`);
  logger.info(`[WEBHOOK MASUK] METHOD: ${method}`);
  logger.info(`[WEBHOOK MASUK] URL: ${url}`);
  logger.info(`[WEBHOOK MASUK] Headers: ${JSON.stringify(headers, null, 2)}`);
  logger.info(`[WEBHOOK MASUK] Body: ${JSON.stringify(body, null, 2)}`);
  logger.info(`[WEBHOOK MASUK] Signature: ${signature}`);

  try {
    const settings = await db.getSettings();
    const gopay = settings.payment?.autogopay || {};
    
    // Check if live API Key check is active and required
    if (gopay.apiKey && typeof gopay.apiKey === 'string' && gopay.apiKey.trim() !== '' && gopay.apiKey !== 'gopay_test_key_123' && gopay.enabled) {
      if (!signature) {
        logger.warn('[WEBHOOK MASUK] Rejected: Missing X-Signature header.');
        logger.info(`[WEBHOOK RESPON] Status: 401 | Message: Unauthorized: Missing X-Signature header`);
        return res.status(401).json({ 
          success: false, 
          error: 'Unauthorized: Missing X-Signature header' 
        });
      }

      const cleanSignature = String(signature).trim().toLowerCase();

      // 1. Calculate signature based on Raw Body buffer if available
      let rawBodyStr = '';
      if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
        rawBodyStr = req.rawBody.toString('utf8');
      } else {
        rawBodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      }

      const hmacRaw = crypto.createHmac('sha256', gopay.apiKey);
      const calculatedSignatureRaw = hmacRaw.update(rawBodyStr).digest('hex').toLowerCase();

      // 2. Fallback check: Calculate signature on parsed JSON stringified body
      const hmacJson = crypto.createHmac('sha256', gopay.apiKey);
      const calculatedSignatureJson = hmacJson.update(JSON.stringify(req.body || {})).digest('hex').toLowerCase();

      logger.info(`[WEBHOOK MASUK] Header Signature: "${cleanSignature}"`);
      logger.info(`[WEBHOOK MASUK] Calculated rawBody Signature: "${calculatedSignatureRaw}"`);
      logger.info(`[WEBHOOK MASUK] Calculated JSON Signature: "${calculatedSignatureJson}"`);

      const isValidSignature = (cleanSignature === calculatedSignatureRaw) || (cleanSignature === calculatedSignatureJson);

      if (!isValidSignature) {
        logger.warn('[WEBHOOK MASUK] Rejected: Signature verification failed.');
        logger.info(`[WEBHOOK RESPON] Status: 401 | Message: Unauthorized: Invalid X-Signature verification`);
        return res.status(401).json({ 
          success: false, 
          error: 'Unauthorized: Invalid X-Signature verification' 
        });
      }
      logger.info('[WEBHOOK MASUK] Signature validated successfully.');
    } else {
      logger.info('[WEBHOOK MASUK] Bypassing signature validation (Running in test mode or API Key not configured / enabled).');
    }

    // Process webhook logic
    const result = await AutoGoPayService.processWebhook(body);
    
    logger.info('[WEBHOOK MASUK] Webhook processed successfully. Result:', result);
    logger.info(`[WEBHOOK RESPON] Status: 200 | Body: ${JSON.stringify(result)}`);
    return res.status(200).json(result);

  } catch (err) {
    // Log the entire error stack as requested
    logger.error('[WEBHOOK MASUK] CRITICAL ERROR / EXCEPTION caught in route try-catch:', err);
    if (err.stack) {
      logger.error(`[WEBHOOK MASUK] Stack Error: ${err.stack}`);
    }

    // Return 200 with success: false to signal handled exception, rather than server crashing
    logger.info(`[WEBHOOK RESPON] Status: 200 | Body: { success: false, error: "Exception occurred", ... }`);
    return res.status(200).json({ 
      success: false, 
      error: 'Exception occurred but gracefully handled', 
      message: err.message 
    });
  }
}

// Mount webhook handler to both preferred paths to prevent breaking existing and new systems
router.post('/webhook/autogopay', handleAutoGoPayWebhook);
router.post('/api/webhooks/gopay', handleAutoGoPayWebhook);

export default router;
