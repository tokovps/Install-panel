import { sessionStore } from '../store/session.js';

export default {
  id: 'topup:custom',
  render: async (user) => {
    // Set user session to await topup amount input
    sessionStore.set(user.telegramId, 'state', 'awaiting_topup_amount');

    const text = `
✏️ <b>Top Up Saldo - Jumlah Kustom</b>

Silakan ketik jumlah nominal top up yang Anda inginkan langsung di chat ini.

⚠️ <b>Ketentuan:</b>
• Minimal nominal: <b>Rp 1.000</b>
• Maksimal nominal: <b>Rp 10.000.000</b>
• Masukkan angka saja tanpa titik atau koma (Contoh: <code>15000</code>)

<i>Klik tombol ❌ Batal di bawah untuk kembali ke menu sebelumnya.</i>
`;

    return {
      text,
      cancelCallback: 'topup' // Shows "Batal" pointing back to 'topup' page
    };
  }
};
