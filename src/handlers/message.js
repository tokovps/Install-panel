import { db } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { sessionStore } from '../store/session.js';
import { AdminInputEngine } from '../core/adminInput.js';
import { WizardEngine } from '../core/wizard.js';
import { NavigationEngine } from '../core/navigation.js';
import { AutoGoPayService } from '../services/autogopay.js';

/**
 * Message Handler for incoming non-command text updates
 */
export async function handleTextMessage(ctx) {
  const text = ctx.message?.text;
  if (!text) return;
  if (text.startsWith('/')) return; // handled by command loader

  const telegramId = ctx.from.id;
  try {
    const user = await db.getUser(telegramId);
    const state = sessionStore.get(telegramId, 'state');

    // 1. Process Custom Top Up amount input state
    if (state === 'awaiting_topup_amount') {
      const amount = parseInt(text.trim(), 10);
      if (isNaN(amount) || amount < 1000 || amount > 10000000) {
        await ctx.reply('⚠️ Nominal tidak valid! Masukkan angka saja tanpa titik/koma antara 1.000 hingga 10.000.000.');
        return;
      }

      sessionStore.clear(telegramId); // clear top up state
      await ctx.reply(`⏳ Menyiapkan invoice untuk top up sebesar Rp ${amount.toLocaleString('id-ID')}...`);

      try {
        const invoice = await AutoGoPayService.createInvoice(telegramId, amount);
        sessionStore.set(telegramId, 'activeInvoiceId', invoice.txId);
        await NavigationEngine.navigateTo(ctx, 'topup:invoice', user);
      } catch (err) {
        logger.error('Failed to create custom top up invoice', err);
        await ctx.reply('❌ Gagal membuat invoice pembayaran. Silakan coba kembali nanti.');
      }
      return;
    }

    // 2. Process Admin input state
    const adminHandled = await AdminInputEngine.handleText(ctx, user, text);
    if (adminHandled) return;

    // 3. Process Wizard state
    const wizardHandled = await WizardEngine.handleText(ctx, user, text);
    if (wizardHandled) return;

    // Default fallback
    await ctx.reply('⚠️ Perintah tidak dikenal. Silakan ketik /start untuk ke menu utama.');
  } catch (err) {
    logger.error(`Error processing text message from ${telegramId}`, err);
  }
}
