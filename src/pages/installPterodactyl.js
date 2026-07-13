import { db } from '../config/db.js';

export default {
  id: 'install:panel',
  render: async (user) => {
    const settings = await db.getSettings();
    const price = settings.prices?.pterodactyl || 2000;

    const formatIDR = (val) => new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val);

    const hasEnoughBalance = (user.balance || 0) >= price;

    const text = `
📦 <b>Layanan Instalasi Pterodactyl Panel</b>

Instalasi Pterodactyl Game Management Panel lengkap dengan web server Nginx, SSL otomatis, database MariaDB, PHP, Redis, dan Docker dependencies.

━━━━━━━━━━━━━━━━━━
💰 <b>Rincian Harga & Saldo:</b>
• Harga Layanan: <b>${formatIDR(price)}</b>
• Saldo Anda: <b>${formatIDR(user.balance || 0)}</b>
• Status Kelayakan: ${hasEnoughBalance ? '✅ <b>Saldo Cukup</b>' : '⚠️ <b>Saldo Tidak Cukup</b>'}
━━━━━━━━━━━━━━━━━━

⚠️ <b>Persyaratan Penting Sebelum Memulai:</b>
1. Pastikan Anda memiliki domain/subdomain yang sudah diarahkan (A Record) ke IP VPS Anda (Contoh: <code>panel.domainanda.com</code>).
2. OS VPS wajib <b>Ubuntu 20.04 / 22.04 LTS</b> (Fresh VPS).
3. Akses root SSH penuh diperlukan.

${hasEnoughBalance 
  ? '<i>Klik tombol di bawah ini untuk mulai memasukkan data konfigurasi VPS Anda.</i>' 
  : '<i>Silakan lakukan Top Up saldo terlebih dahulu sebelum menggunakan layanan ini.</i>'
}
`;

    const buttons = [];
    if (hasEnoughBalance) {
      buttons.push([['▶️ Mulai Konfigurasi', 'install:panel:start']]);
    } else {
      buttons.push([['📥 Top Up Saldo', 'topup']]);
    }

    return {
      text,
      keyboard: buttons
    };
  }
};
