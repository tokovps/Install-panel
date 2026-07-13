import { db } from '../config/db.js';

export default {
  id: 'account',
  render: async (user) => {
    const txs = await db.getTransactionsByUserId(user.telegramId);
    const purchases = txs.filter(t => t.type === 'purchase' && t.status === 'completed');
    
    const formattedBalance = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(user.balance || 0);

    const text = `
👤 <b>Profil Akun Anda</b>

Berikut adalah detail informasi akun Anda di sistem bot kami:

━━━━━━━━━━━━━━━━━━
⚙️ <b>Informasi Umum:</b>
• ID Telegram: <code>${user.telegramId}</code>
• Username: @${user.username || 'Tidak ada'}
• Status Peran: <b>${user.role === 'admin' ? '👑 Administrator' : '👤 Member'}</b>
• Terdaftar sejak: <code>${new Date(user.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</code>

💰 <b>Statistik Keuangan:</b>
• Saldo Saat Ini: <b>${formattedBalance}</b>
• Jumlah Transaksi: <code>${txs.length} Kali</code>
• Jumlah Pembelian: <code>${purchases.length} Instalasi Berhasil</code>
━━━━━━━━━━━━━━━━━━

<i>Gunakan tombol di bawah untuk menambah saldo atau melihat detail transaksi Anda di menu Saldo.</i>
`;

    const buttons = [
      [
        ['💰 Detail Saldo', 'balance'],
        ['📥 Top Up Saldo', 'topup']
      ]
    ];

    return {
      text,
      keyboard: buttons
    };
  }
};
