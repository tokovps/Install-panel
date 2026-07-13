import { db } from '../config/db.js';

export default {
  id: 'admin:dashboard',
  render: async (user) => {
    if (user.role !== 'admin') {
      return {
        text: '⚠️ Anda tidak memiliki hak akses administrator.',
        keyboard: [[['🏠 Menu Utama', 'home']]]
      };
    }

    const users = await db.getAllUsers();
    const txs = await db.getAllTransactions();
    const settings = await db.getSettings();

    const totalUsers = users.length;
    const completedTopups = txs.filter(t => t.type === 'topup' && t.status === 'completed');
    const totalRevenue = completedTopups.reduce((sum, t) => sum + t.amount, 0);

    const formatIDR = (val) => new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val);

    const gopay = settings.payment?.autogopay || {};
    const botConf = settings.bot || {};

    const text = `
👑 <b>ADMINISTRATOR PANEL DASHBOARD</b>

Selamat datang di panel admin. Gunakan menu di bawah untuk mengelola operasional bot secara penuh.

━━━━━━━━━━━━━━━━━━
📊 <b>Statistik & Ringkasan Bot:</b>
• Total Pengguna Terdaftar: <b>${totalUsers} User</b>
• Total Transaksi Sukses: <code>${completedTopups.length} Kali</code>
• Total Pendapatan QRIS: <b>${formatIDR(totalRevenue)}</b>
• Status DB: <code>🟢 MongoDB Connected</code>
• Status Bot: <code>${botConf.maintenance ? '🟡 Maintenance Active' : '🟢 Online & Ready'}</code>

🔌 <b>Status AutoGoPay:</b>
• API Key: <code>${gopay.apiKey ? '✅ Terpasang' : '❌ Belum Diatur'}</code>
• QRIS Static: <code>${gopay.qrisString ? '✅ Terpasang' : '❌ Belum Diatur'}</code>
• Status Gateway: <code>${gopay.enabled ? '🟢 AKTIF' : '🔴 NONAKTIF'}</code>
━━━━━━━━━━━━━━━━━━

<i>Silakan pilih menu manajemen di bawah ini:</i>
`;

    const buttons = [
      [
        ['👥 Kelola User', 'admin:users'],
        ['📈 Statistik', 'admin:stats']
      ],
      [
        ['💰 Harga Layanan', 'admin:prices'],
        ['💳 AutoGoPay', 'admin:autogopay']
      ],
      [
        ['📣 Broadcast', 'admin:broadcast'],
        ['⚙️ Pengaturan Bot', 'admin:settings']
      ]
    ];

    return {
      text,
      keyboard: buttons
    };
  }
};
