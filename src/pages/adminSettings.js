import { db } from '../config/db.js';

export default {
  id: 'admin:settings',
  render: async (user) => {
    if (user.role !== 'admin') {
      return { text: '⚠️ Akses ditolak.', keyboard: [[['🏠 Menu Utama', 'home']]] };
    }

    const settings = await db.getSettings();
    const botConf = settings.bot || {
      maintenance: false,
      maintenanceMessage: 'Bot sedang dalam perawatan / maintenance.',
      forceJoin: [],
      contact: '',
      channel: '',
      storeName: 'AutoInstaller Bot'
    };

    const text = `
⚙️ <b>Pengaturan Operasional Bot</b>

Kelola konfigurasi fungsional dan branding dari bot Anda di sini.

━━━━━━━━━━━━━━━━━━
🏷️ <b>Nama Toko:</b> <code>${botConf.storeName || 'Belum Diatur'}</code>
🛠️ <b>Status Maintenance:</b> <code>${botConf.maintenance ? '🔴 AKTIF' : '🟢 NONAKTIF'}</code>
✍️ <b>Pesan Maintenance:</b> <i>${botConf.maintenanceMessage || '-'}</i>
📢 <b>Force Join:</b> <code>${botConf.forceJoin && botConf.forceJoin.length > 0 ? botConf.forceJoin.join(', ') : '❌ Tidak Ada'}</code>
📞 <b>Kontak Admin:</b> <code>${botConf.contact || '❌ Belum Diatur'}</code>
📡 <b>Channel Update:</b> <code>${botConf.channel || '❌ Belum Diatur'}</code>
━━━━━━━━━━━━━━━━━━

<i>Pilih menu di bawah ini untuk mengubah pengaturan secara interaktif:</i>
`;

    const buttons = [
      [
        ['🏷️ Nama Toko', 'admin:setbot:storename'],
        [botConf.maintenance ? '🟢 Nonaktifkan Maintenance' : '🔴 Aktifkan Maintenance', 'admin:setbot:toggle_maintenance']
      ],
      [
        ['✍️ Pesan Maintenance', 'admin:setbot:maintmsg'],
        ['📢 Force Join', 'admin:setbot:forcejoin']
      ],
      [
        ['📞 Kontak Admin', 'admin:setbot:contact'],
        ['📡 Channel Update', 'admin:setbot:channel']
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
