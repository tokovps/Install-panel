import { NavigationEngine } from './navigation.js';
import { db } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { sessionStore } from '../store/session.js';
import { Keyboard } from './keyboard.js';

/**
 * Safe helper to answer callback query using proper Telegraf API
 */
const answerCb = async (ctx, text, options) => {
  if (ctx && typeof ctx.answerCbQuery === 'function') {
    return await ctx.answerCbQuery(text, options).catch(() => {});
  }
};

/**
 * Callback Router - Handles all inline button clicks
 */
export const CallbackRouter = {
  setup: (bot) => {
    bot.on('callback_query', async (ctx) => {
      const callbackData = ctx.callbackQuery.data;
      const telegramId = ctx.from.id;
      
      try {
        const user = await db.getUser(telegramId);
        const settings = await db.getSettings();
        
        logger.info(`Callback triggered by user ${telegramId}: "${callbackData}" (Current Page: ${user.currentPage})`);

        // Always answer callback query to remove loading spinner in Telegram client
        await answerCb(ctx);

        // 1. Back operation
        if (callbackData === 'back') {
          return await NavigationEngine.goBack(ctx, user);
        }

        // 2. Home operation
        if (callbackData === 'home') {
          sessionStore.clear(telegramId);
          return await NavigationEngine.navigateTo(ctx, 'home', user);
        }

        // 3. Cancel Wizard
        if (callbackData === 'cancel_wizard') {
          sessionStore.clear(telegramId);
          return await NavigationEngine.navigateTo(ctx, 'home', user);
        }

        // --- DYNAMIC/PARAMETERIZED CALLBACKS ---
        
        // A. Create Top Up invoice callback
        if (callbackData.startsWith('topup:pay:')) {
          const amount = parseInt(callbackData.split(':')[2], 10);
          const { AutoGoPayService } = await import('../services/autogopay.js');
          const invoice = await AutoGoPayService.createInvoice(telegramId, amount);
          sessionStore.set(telegramId, 'activeInvoiceId', invoice.txId);
          return await NavigationEngine.navigateTo(ctx, 'topup:invoice', user);
        }

        // B. Check invoice status manually callback
        if (callbackData.startsWith('topup:check:')) {
          const txId = callbackData.split(':')[2];
          const { AutoGoPayService } = await import('../services/autogopay.js');
          const checkResult = await AutoGoPayService.checkStatus(txId);
          await answerCb(ctx, checkResult.message, { show_alert: true });
          if (checkResult.status === 'settlement') {
            return await NavigationEngine.navigateTo(ctx, 'balance', user);
          }
          return;
        }

        // C. Wizard callbacks
        if (callbackData.startsWith('wizard:')) {
          const { WizardEngine } = await import('./wizard.js');
          const handled = await WizardEngine.handleCallback(ctx, user, callbackData);
          if (handled) return;
        }

        // D. Start MySQL Installation Wizard
        if (callbackData === 'install:mysql:start') {
          sessionStore.clear(telegramId);
          sessionStore.set(telegramId, 'wizard', 'mysql');
          sessionStore.set(telegramId, 'step', 'input_ip');
          
          const keyboard = Keyboard.create([], { cancelCallback: 'cancel_wizard', currentPage: 'wizard' });
          const { EditorEngine } = await import('./editor.js');
          await EditorEngine.editMessage(ctx, {
            text: `▶️ <b>Memulai Wizard Konfigurasi MySQL</b>\n\nSilakan ketik dan kirimkan <b>IP Address VPS</b> Anda (Contoh: <code>103.123.45.67</code>):`,
            keyboard
          }, user);
          return;
        }

        // E. Start Pterodactyl Panel Installation Wizard
        if (callbackData === 'install:panel:start') {
          sessionStore.clear(telegramId);
          sessionStore.set(telegramId, 'wizard', 'pterodactyl');
          sessionStore.set(telegramId, 'step', 'input_ip');
          
          const keyboard = Keyboard.create([], { cancelCallback: 'cancel_wizard', currentPage: 'wizard' });
          const { EditorEngine } = await import('./editor.js');
          await EditorEngine.editMessage(ctx, {
            text: `▶️ <b>Memulai Wizard Konfigurasi Pterodactyl</b>\n\nSilakan ketik dan kirimkan <b>IP Address VPS</b> Anda (Contoh: <code>103.123.45.67</code>):`,
            keyboard
          }, user);
          return;
        }

        // F. Confirm & Fire MySQL Installation
        if (callbackData === 'install:mysql:confirm') {
          if (user.isInstalling) {
            await answerCb(ctx, '⚠️ Anda sedang menjalankan proses instalasi lain!', { show_alert: true });
            return;
          }
          
          const price = settings.prices?.mysql || 2000;
          if ((user.balance || 0) < price) {
            await answerCb(ctx, '⚠️ Saldo Anda tidak cukup!', { show_alert: true });
            return;
          }

          await db.updateUser(telegramId, { isInstalling: true });

          const host = sessionStore.get(telegramId, 'ip');
          const port = sessionStore.get(telegramId, 'port');
          const username = sessionStore.get(telegramId, 'username');
          const password = sessionStore.get(telegramId, 'password');
          const mysqlRootPassword = sessionStore.get(telegramId, 'mysqlPassword');

          sessionStore.clear(telegramId);

          await NavigationEngine.navigateTo(ctx, 'home', user, { pushToHistory: false });

          const { MysqlInstaller } = await import('../services/mysqlInstaller.js');
          MysqlInstaller.start(bot, user, { host, port, username, password, mysqlRootPassword });
          return;
        }

        // G. Confirm & Fire Pterodactyl Installation
        if (callbackData === 'install:panel:confirm') {
          if (user.isInstalling) {
            await answerCb(ctx, '⚠️ Anda sedang menjalankan proses instalasi lain!', { show_alert: true });
            return;
          }

          const price = settings.prices?.pterodactyl || 2000;
          if ((user.balance || 0) < price) {
            await answerCb(ctx, '⚠️ Saldo Anda tidak cukup!', { show_alert: true });
            return;
          }

          await db.updateUser(telegramId, { isInstalling: true });

          const host = sessionStore.get(telegramId, 'ip');
          const port = sessionStore.get(telegramId, 'port');
          const username = sessionStore.get(telegramId, 'username');
          const password = sessionStore.get(telegramId, 'password');
          const panelDomain = sessionStore.get(telegramId, 'panelDomain');
          const panelEmail = sessionStore.get(telegramId, 'panelEmail');
          const panelPassword = sessionStore.get(telegramId, 'panelPassword');

          sessionStore.clear(telegramId);

          await NavigationEngine.navigateTo(ctx, 'home', user, { pushToHistory: false });

          const { PterodactylInstaller } = await import('../services/panelInstaller.js');
          PterodactylInstaller.start(bot, user, {
            host, port, username, password, panelDomain, panelEmail, panelPassword
          });
          return;
        }

        // --- ADMIN CALLBACKS (PRICING & AUTOGOPAY & SETTINGS) ---
        
        if (callbackData === 'admin:setgopay:toggle') {
          if (user.role !== 'admin') {
            await answerCb(ctx, '⚠️ Akses ditolak!', { show_alert: true });
            return;
          }
          const currentEnabled = settings.payment?.autogopay?.enabled || false;
          await db.updateSettings({ 'payment.autogopay.enabled': !currentEnabled });
          await answerCb(ctx, `Status AutoGoPay diubah menjadi: ${!currentEnabled ? '🟢 AKTIF' : '🔴 NONAKTIF'}`, { show_alert: true });
          return await NavigationEngine.navigateTo(ctx, 'admin:autogopay', user, { pushToHistory: false });
        }

        if (callbackData === 'admin:setgopay:test') {
          if (user.role !== 'admin') {
            await answerCb(ctx, '⚠️ Akses ditolak!', { show_alert: true });
            return;
          }
          const gopay = settings.payment?.autogopay || {};
          if (!gopay.apiKey) {
            await answerCb(ctx, '❌ Gagal! API Key belum terpasang.', { show_alert: true });
            return;
          }

          // Show elegant loading message in the chat
          const { EditorEngine } = await import('./editor.js');
          const loadingKb = Keyboard.create([], { showBack: false, showHome: false });
          await EditorEngine.editMessage(ctx, {
            text: `⏳ <b>Menghubungi server AutoGoPay...</b>\n\nMohon tunggu sebentar selagi bot memverifikasi kredensial dan menguji koneksi gateway secara real-time.`,
            keyboard: loadingKb
          }, user);

          const { AutoGoPayService } = await import('../services/autogopay.js');
          const testResult = await AutoGoPayService.testConnection(gopay.apiKey);

          let displayMsg = '';
          if (testResult.success) {
            displayMsg = `✅ <b>AutoGoPay berhasil terhubung.</b>\n\n` +
                         `<b>Informasi:</b>\n` +
                         `• API Status : <b>Online</b>\n` +
                         `• API Key : <b>Valid</b>\n` +
                         `• Gateway : <b>Connected</b>\n` +
                         `• Response Time : <code>${testResult.responseTime} ms</code>`;
          } else {
            displayMsg = `${testResult.message}`;
          }

          const backKb = Keyboard.create([[['⬅️ Kembali ke AutoGoPay', 'admin:autogopay']]], { showBack: false, showHome: true });
          await EditorEngine.editMessage(ctx, {
            text: displayMsg,
            keyboard: backKb
          }, user);
          return;
        }

        if (callbackData === 'admin:setgopay:test_webhook') {
          if (user.role !== 'admin') {
            await answerCb(ctx, '⚠️ Akses ditolak!', { show_alert: true });
            return;
          }
          const gopay = settings.payment?.autogopay || {};
          if (!gopay.apiKey) {
            await answerCb(ctx, '❌ Gagal! API Key belum terpasang.', { show_alert: true });
            return;
          }
          if (!gopay.webhook) {
            await answerCb(ctx, '❌ Gagal! URL Webhook belum terpasang.', { show_alert: true });
            return;
          }

          // Show elegant loading message in the chat
          const { EditorEngine } = await import('./editor.js');
          const loadingKb = Keyboard.create([], { showBack: false, showHome: false });
          await EditorEngine.editMessage(ctx, {
            text: `⏳ <b>Menjalankan Test Webhook...</b>\n\nMohon tunggu sebentar selagi bot mengirimkan payload uji coba ke endpoint webhook Anda dan memvalidasi signature secara real-time.`,
            keyboard: loadingKb
          }, user);

          const { AutoGoPayService } = await import('../services/autogopay.js');
          const testResult = await AutoGoPayService.testWebhook(gopay.apiKey, gopay.webhook);

          const backKb = Keyboard.create([[['⬅️ Kembali ke AutoGoPay', 'admin:autogopay']]], { showBack: false, showHome: true });
          await EditorEngine.editMessage(ctx, {
            text: testResult.message,
            keyboard: backKb
          }, user);
          return;
        }

        if (callbackData === 'admin:setbot:toggle_maintenance') {
          if (user.role !== 'admin') {
            await answerCb(ctx, '⚠️ Akses ditolak!', { show_alert: true });
            return;
          }
          const currentMaint = settings.bot?.maintenance || false;
          await db.updateSettings({ 'bot.maintenance': !currentMaint });
          await answerCb(ctx, `Mode Maintenance: ${!currentMaint ? '🔴 AKTIF' : '🟢 NONAKTIF'}`, { show_alert: true });
          return await NavigationEngine.navigateTo(ctx, 'admin:settings', user, { pushToHistory: false });
        }

        if (callbackData.startsWith('admin:setprice:') || callbackData.startsWith('admin:setgopay:') || callbackData.startsWith('admin:setbot:')) {
          if (user.role !== 'admin') {
            await answerCb(ctx, '⚠️ Akses ditolak!', { show_alert: true });
            return;
          }

          const parts = callbackData.split(':');
          const group = parts[1];
          const key = parts[2];

          sessionStore.clear(telegramId);
          const { EditorEngine } = await import('./editor.js');

          if (group === 'setprice') {
            const keyboard = Keyboard.create([], { cancelCallback: 'admin:prices', currentPage: 'admin_edit' });
            if (key === 'pterodactyl') {
              sessionStore.set(telegramId, 'state', 'awaiting_price_pterodactyl');
              await EditorEngine.editMessage(ctx, {
                text: '✏️ <b>Atur Harga - Pterodactyl Panel</b>\n\nSilakan ketikkan nominal harga baru dalam rupiah (tanpa titik/koma) dan kirimkan di chat ini:\nContoh: <code>2000</code>',
                keyboard
              }, user);
            } else if (key === 'mysql') {
              sessionStore.set(telegramId, 'state', 'awaiting_price_mysql');
              await EditorEngine.editMessage(ctx, {
                text: '✏️ <b>Atur Harga - MySQL Server</b>\n\nSilakan ketikkan nominal harga baru dalam rupiah (tanpa titik/koma) dan kirimkan di chat ini:\nContoh: <code>2000</code>',
                keyboard
              }, user);
            }
            return;
          }

          if (group === 'setgopay') {
            const keyboard = Keyboard.create([], { cancelCallback: 'admin:autogopay', currentPage: 'admin_edit' });
            if (key === 'apikey') {
              sessionStore.set(telegramId, 'state', 'awaiting_gopay_apikey');
              await EditorEngine.editMessage(ctx, {
                text: '✏️ <b>Atur AutoGoPay - API Key</b>\n\nSilakan paste/ketik API Key AutoGoPay baru Anda dan kirimkan di chat ini:',
                keyboard
              }, user);
            } else if (key === 'qris') {
              sessionStore.set(telegramId, 'state', 'awaiting_gopay_qris');
              await EditorEngine.editMessage(ctx, {
                text: '✏️ <b>Atur AutoGoPay - QRIS Static String</b>\n\nSilakan paste string data QRIS static Anda (diawali dengan <code>000201...</code>) dan kirimkan di chat ini:',
                keyboard
              }, user);
            } else if (key === 'webhook') {
              sessionStore.set(telegramId, 'state', 'awaiting_gopay_webhook');
              await EditorEngine.editMessage(ctx, {
                text: '✏️ <b>Atur AutoGoPay - Webhook URL</b>\n\nSilakan ketikkan path atau URL webhook Anda (default: <code>/api/webhooks/gopay</code>) dan kirimkan di chat ini:',
                keyboard
              }, user);
            }
            return;
          }

          if (group === 'setbot') {
            const keyboard = Keyboard.create([], { cancelCallback: 'admin:settings', currentPage: 'admin_edit' });
            if (key === 'storename') {
              sessionStore.set(telegramId, 'state', 'awaiting_store_name');
              await EditorEngine.editMessage(ctx, {
                text: '✏️ <b>Atur Nama Toko / Bot</b>\n\nSilakan ketikkan nama branding toko baru Anda dan kirimkan di chat ini:',
                keyboard
              }, user);
            } else if (key === 'maintmsg') {
              sessionStore.set(telegramId, 'state', 'awaiting_maint_msg');
              await EditorEngine.editMessage(ctx, {
                text: '✏️ <b>Atur Pesan Mode Perawatan</b>\n\nSilakan ketikkan pesan yang ditampilkan ke pengguna ketika bot sedang maintenance, lalu kirimkan di chat ini:',
                keyboard
              }, user);
            } else if (key === 'forcejoin') {
              sessionStore.set(telegramId, 'state', 'awaiting_force_join');
              await EditorEngine.editMessage(ctx, {
                text: '✏️ <b>Atur Force Join Channel</b>\n\nSilakan ketikkan username target channel terpisah dengan koma (Contoh: <code>@UpdateChannel, @SubChannel</code>), lalu kirimkan di chat ini:',
                keyboard
              }, user);
            } else if (key === 'contact') {
              sessionStore.set(telegramId, 'state', 'awaiting_contact');
              await EditorEngine.editMessage(ctx, {
                text: '✏️ <b>Atur Kontak Admin</b>\n\nSilakan ketikkan username telegram Anda (Contoh: <code>@AdminGanteng</code>), lalu kirimkan di chat ini:',
                keyboard
              }, user);
            } else if (key === 'channel') {
              sessionStore.set(telegramId, 'state', 'awaiting_channel');
              await EditorEngine.editMessage(ctx, {
                text: '✏️ <b>Atur Channel Update Bot</b>\n\nSilakan ketikkan link channel updates bot Anda (Contoh: <code>https://t.me/UpdateChannel</code>), lalu kirimkan di chat ini:',
                keyboard
              }, user);
            }
            return;
          }
        }

        // 4. Default dynamic navigation
        await NavigationEngine.navigateTo(ctx, callbackData, user);

      } catch (err) {
        logger.error(`Error in CallbackRouter for action: ${callbackData}`, err);
      }
    });
  }
};
