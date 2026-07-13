import { db } from '../config/db.js';

export default {
  id: 'admin:prices',
  render: async (user) => {
    if (user.role !== 'admin') {
      return { text: '⚠️ Akses ditolak.', keyboard: [[['🏠 Menu Utama', 'home']]] };
    }

    const settings = await db.getSettings();
    const prices = settings.prices || { pterodactyl: 2000, mysql: 2000 };

    const formatIDR = (val) => new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val || 0);

    const text = `
💰 <b>Manajemen Harga Layanan Instalasi</b>

Atur tarif harga untuk setiap layanan instalasi otomatis yang tersedia pada bot Anda.

━━━━━━━━━━━━━━━━━━
📊 <b>Daftar Tarif Saat Ini:</b>
• 📦 Install Pterodactyl Panel: <b>${formatIDR(prices.pterodactyl)}</b>
• 🐬 Install MySQL Server: <b>${formatIDR(prices.mysql)}</b>
━━━━━━━━━━━━━━━━━━

💡 <b>Petunjuk Pengubahan Harga:</b>
Klik tombol di bawah ini untuk mengubah harga masing-masing layanan secara instan menggunakan menu interaktif wizard.
`;

    const buttons = [
      [
        ['📦 Ubah Harga Pterodactyl', 'admin:setprice:pterodactyl'],
        ['🐬 Ubah Harga MySQL', 'admin:setprice:mysql']
      ],
      [
        ['⬅️ Dashboard Admin', 'admin:dashboard']
      ]
    ];

    return {
      text,
      keyboard: buttons
    };
  }
};
