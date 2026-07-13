import { db } from '../config/db.js';

export default {
  id: 'admin:autogopay',
  render: async (user) => {
    if (user.role !== 'admin') {
      return { text: '⚠️ Akses ditolak.', keyboard: [[['🏠 Menu Utama', 'home']]] };
    }

    const settings = await db.getSettings();
    const gopay = settings.payment?.autogopay || { apiKey: '', qrisString: '', webhook: '/api/webhooks/gopay', enabled: false };

    const statusBadge = gopay.enabled ? '🟢 AKTIF' : '🔴 NONAKTIF';

    const text = `
🔌 <b>Konfigurasi Sistem Pembayaran AutoGoPay</b>

Atur kredensial integrasi gateway AutoGoPay untuk sistem top up otomatis menggunakan QRIS.

━━━━━━━━━━━━━━━━━━
⚙️ <b>Kredensial Aktif:</b>
• 🔑 API Key: <code>${gopay.apiKey ? gopay.apiKey.substring(0, 8) + '...' : '❌ Belum Diatur'}</code>
• 🧾 QRIS String: <code>${gopay.qrisString ? gopay.qrisString.substring(0, 15) + '...' : '❌ Belum Diatur'}</code>
• 🌐 Webhook URL: <code>${gopay.webhook || '/api/webhooks/gopay'}</code>
• ⚡ Status Gateway: <b>${statusBadge}</b>
━━━━━━━━━━━━━━━━━━

💡 <b>Petunjuk Pengaturan:</b>
1. <b>API Key</b>: Masukkan API Key yang diperoleh dari dashboard dashboard.autogopay.com.
2. <b>QRIS String</b>: Copy & paste konten raw teks QRIS static Anda (diawali dengan <code>000201...</code>).
3. <b>Webhook</b>: Daftarkan webhook URL di dashboard AutoGoPay mengarah ke bot Anda.

<i>Klik tombol di bawah ini untuk mengubah pengaturan secara interaktif.</i>
`;

    const buttons = [
      [
        ['🔑 API Key', 'admin:setgopay:apikey'],
        ['🧾 QRIS String', 'admin:setgopay:qris']
      ],
      [
        ['🌐 Webhook', 'admin:setgopay:webhook']
      ],
      [
        ['🧪 Test Koneksi', 'admin:setgopay:test'],
        ['🧪 Test Webhook', 'admin:setgopay:test_webhook']
      ],
      [
        [gopay.enabled ? '🔴 Nonaktifkan AutoGoPay' : '🟢 Aktifkan AutoGoPay', 'admin:setgopay:toggle']
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
