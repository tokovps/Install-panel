import { db } from '../config/db.js';

export default {
  id: 'home',
  render: async (user) => {
    const settings = await db.getSettings();
    const botConf = settings.bot || {};
    const storeName = botConf.storeName || 'AutoInstaller Bot';

    // Check maintenance mode
    if (botConf.maintenance && user.role !== 'admin') {
      const maintMsg = botConf.maintenanceMessage || 'Bot sedang dalam perawatan / maintenance.';
      const contactUrl = botConf.contact ? `https://t.me/${botConf.contact.replace('@', '')}` : null;
      
      const text = `
⚠️ <b>SISTEM SEDANG MAINTENANCE</b>

Mohon maaf atas ketidaknyamanannya. Saat ini <b>${storeName}</b> sedang melakukan pemeliharaan rutin untuk meningkatkan kualitas layanan.

━━━━━━━━━━━━━━━━━━
💬 <b>Pesan Maintenance:</b>
<i>${maintMsg}</i>
━━━━━━━━━━━━━━━━━━

Silakan hubungi administrator atau coba kembali beberapa saat lagi.
`;
      const buttons = [];
      const row = [];
      if (contactUrl) {
        row.push({ text: '📞 Hubungi Admin', url: contactUrl });
      }
      row.push({ text: '🔄 Coba Lagi', callback_data: 'home' });
      buttons.push(row);

      return {
        text,
        keyboard: buttons
      };
    }

    const formattedBalance = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(user.balance || 0);

    const text = `
🤖 <b>${storeName}</b>

Selamat datang di bot instalasi otomatis tercepat dan teraman. Gunakan tombol di bawah ini untuk memulai instalasi atau mengisi saldo Anda.

━━━━━━━━━━━━━━━━━━
👤 <b>Akun Anda:</b>
• ID: <code>${user.telegramId}</code>
• Username: @${user.username || 'Tidak ada'}
• Saldo: <b>${formattedBalance}</b>
• Status: <code>${user.role === 'admin' ? '👑 Administrator' : '👤 Member'}</code>
━━━━━━━━━━━━━━━━━━

Silakan pilih layanan di bawah untuk melanjutkan:
`;

    const buttons = [
      [
        ['📦 Install Pterodactyl', 'install:panel'],
        ['🐬 Install MySQL', 'install:mysql']
      ],
      [
        ['💰 Saldo & Top Up', 'balance'],
        ['👤 Akun Saya', 'account']
      ],
      [
        ['❓ Bantuan', 'help']
      ]
    ];

    if (user.role === 'admin') {
      buttons.push([['👑 Panel Admin', 'admin:dashboard']]);
    }

    return {
      text,
      keyboard: buttons
    };
  }
};
