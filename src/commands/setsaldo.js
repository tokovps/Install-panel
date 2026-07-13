import { db } from '../config/db.js';

export default {
  name: 'setsaldo',
  execute: async (ctx, user) => {
    if (user.role !== 'admin') {
      return ctx.reply('⚠️ Perintah ini hanya untuk administrator.');
    }

    const messageText = ctx.message.text || '';
    const args = messageText.split(' ').slice(1);

    if (args.length < 2) {
      return ctx.reply('⚠️ Format salah! Gunakan:\n<code>/setsaldo [id_telegram] [nominal]</code>\n\nContoh: <code>/setsaldo 123456789 50000</code>', { parse_mode: 'HTML' });
    }

    const targetId = parseInt(args[0], 10);
    const amount = parseInt(args[1], 10);

    if (isNaN(targetId) || isNaN(amount)) {
      return ctx.reply('⚠️ ID Telegram dan Nominal harus berupa angka valid!');
    }

    try {
      const targetUser = await db.getUser(targetId);
      if (!targetUser) {
        return ctx.reply(`⚠️ User dengan ID <code>${targetId}</code> tidak ditemukan di database.`, { parse_mode: 'HTML' });
      }

      await db.updateUser(targetId, { balance: amount });

      // Create manual topup transaction record
      await db.createTransaction({
        txId: 'MAN' + Date.now(),
        telegramId: targetId,
        amount: amount,
        type: 'topup',
        status: 'completed',
        description: `Set Saldo manual oleh Admin`
      });

      await ctx.reply(`✅ Berhasil menyetel saldo user <code>${targetId}</code> (@${targetUser.username || 'no_user'}) menjadi <b>Rp ${amount.toLocaleString('id-ID')}</b>.`, { parse_mode: 'HTML' });

      // Notify the target user
      try {
        await ctx.telegram.sendMessage(targetId, `
💰 <b>Pemberitahuan Saldo!</b>

Saldo akun Anda telah disesuaikan oleh administrator.
Saldo saat ini: <b>Rp ${amount.toLocaleString('id-ID')}</b>

<i>Ketik /start untuk melihat menu utama.</i>
`, { parse_mode: 'HTML' });
      } catch (notifyErr) {
        // ignore
      }
    } catch (err) {
      await ctx.reply(`❌ Gagal mengubah saldo: ${err.message}`);
    }
  }
};
