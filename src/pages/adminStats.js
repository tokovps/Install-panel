import { db } from '../config/db.js';

export default {
  id: 'admin:stats',
  render: async (user) => {
    if (user.role !== 'admin') {
      return { text: '⚠️ Akses ditolak.', keyboard: [[['🏠 Menu Utama', 'home']]] };
    }

    const txs = await db.getAllTransactions();
    const users = await db.getAllUsers();

    const topups = txs.filter(t => t.type === 'topup');
    const purchases = txs.filter(t => t.type === 'purchase');

    const topupsSuccess = topups.filter(t => t.status === 'completed');
    const purchasesSuccess = purchases.filter(t => t.status === 'completed');

    const totalRevenue = topupsSuccess.reduce((sum, t) => sum + t.amount, 0);
    const totalSpent = purchasesSuccess.reduce((sum, t) => sum + t.amount, 0);

    const formatIDR = (val) => new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val);

    const text = `
📊 <b>Statistik Detail Operasional Bot</b>

Berikut adalah analisis data lengkap performa finansial dan instalasi bot Anda:

━━━━━━━━━━━━━━━━━━
📈 <b>Layanan Keuangan:</b>
• Total Saldo Beredar: <b>${formatIDR(users.reduce((sum, u) => sum + (u.balance || 0), 0))}</b>
• Total Dana Masuk (QRIS): <b>${formatIDR(totalRevenue)}</b>
• Total Penjualan Layanan: <b>${formatIDR(totalSpent)}</b>

💼 <b>Statistik Transaksi:</b>
• Total Pengajuan Top Up: <code>${topups.length} Kali</code>
• Top Up Berhasil (Paid): <code>${topupsSuccess.length} Kali</code> (${topups.length > 0 ? Math.round((topupsSuccess.length / topups.length) * 100) : 0}%)
• Total Pengajuan Instalasi: <code>${purchases.length} Kali</code>
• Instalasi Sukses (Paid): <code>${purchasesSuccess.length} Kali</code> (${purchases.length > 0 ? Math.round((purchasesSuccess.length / purchases.length) * 100) : 0}%)

📦 <b>Rincian Pembelian Layanan:</b>
• MySQL Installations: <code>${purchasesSuccess.filter(p => p.description.includes('MySQL')).length} Unit</code>
• Pterodactyl Installations: <code>${purchasesSuccess.filter(p => p.description.includes('Pterodactyl')).length} Unit</code>
━━━━━━━━━━━━━━━━━━

<i>Klik tombol di bawah untuk kembali ke Dashboard Admin.</i>
`;

    const buttons = [
      [['⬅️ Dashboard Admin', 'admin:dashboard']]
    ];

    return {
      text,
      keyboard: buttons
    };
  }
};
