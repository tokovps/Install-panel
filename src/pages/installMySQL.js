import { db } from '../config/db.js';

export default {
  id: 'install:mysql',
  render: async (user) => {
    const settings = await db.getSettings();
    const price = settings.prices?.mysql || 2000;

    const formatIDR = (val) => new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val);

    const hasEnoughBalance = (user.balance || 0) >= price;

    const text = `
🐬 <b>Layanan Instalasi MySQL Server</b>

Instalasi database server MySQL secara otomatis dan aman langsung pada VPS/Server Anda.

━━━━━━━━━━━━━━━━━━
💰 <b>Rincian Harga & Saldo:</b>
• Harga Layanan: <b>${formatIDR(price)}</b>
• Saldo Anda: <b>${formatIDR(user.balance || 0)}</b>
• Status Kelayakan: ${hasEnoughBalance ? '✅ <b>Saldo Cukup</b>' : '⚠️ <b>Saldo Tidak Cukup</b>'}
━━━━━━━━━━━━━━━━━━

⚙️ <b>Spesifikasi Rekomendasi VPS:</b>
• OS: Ubuntu 20.04 / 22.04 LTS atau Debian 11 / 12 (Fresh VPS).
• Akses root SSH penuh diperlukan.

${hasEnoughBalance 
  ? '<i>Klik tombol di bawah ini untuk mulai memasukkan data konfigurasi VPS Anda.</i>' 
  : '<i>Silakan lakukan Top Up saldo terlebih dahulu sebelum menggunakan layanan ini.</i>'
}
`;

    const buttons = [];
    if (hasEnoughBalance) {
      buttons.push([['▶️ Mulai Konfigurasi', 'install:mysql:start']]);
    } else {
      buttons.push([['📥 Top Up Saldo', 'topup']]);
    }

    return {
      text,
      keyboard: buttons
    };
  }
};
