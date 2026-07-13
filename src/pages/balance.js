import { db } from '../config/db.js';

export default {
  id: 'balance',
  render: async (user) => {
    const txs = await db.getTransactionsByUserId(user.telegramId);
    
    const formattedBalance = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(user.balance || 0);

    const totalTopUp = txs
      .filter(t => t.type === 'topup' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);
      
    const totalPurchase = txs
      .filter(t => t.type === 'purchase' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);

    const formatIDR = (val) => new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val);

    let txListText = '';
    const recentTxs = txs.slice(0, 5); // last 5 transactions
    
    if (recentTxs.length === 0) {
      txListText = '<i>Belum ada riwayat transaksi.</i>';
    } else {
      txListText = recentTxs.map((t, idx) => {
        const date = new Date(t.createdAt).toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        });
        const typeEmoji = t.type === 'topup' ? '📥' : '📤';
        const statusEmoji = t.status === 'completed' ? '✅' : t.status === 'pending' ? '⏳' : '❌';
        return `${idx + 1}. [${date}] ${typeEmoji} <b>${formatIDR(t.amount)}</b>\n   └─ ${t.description} (${statusEmoji} <code>${t.status.toUpperCase()}</code>)`;
      }).join('\n\n');
    }

    const text = `
💰 <b>Manajemen Saldo Anda</b>

Kelola saldo dan lihat riwayat transaksi Anda secara real-time.

━━━━━━━━━━━━━━━━━━
📊 <b>Ringkasan Keuangan:</b>
• Saldo Saat Ini: <b>${formattedBalance}</b>
• Total Top Up: <code>${formatIDR(totalTopUp)}</code>
• Total Pembelian: <code>${formatIDR(totalPurchase)}</code>
━━━━━━━━━━━━━━━━━━

🧾 <b>5 Transaksi Terakhir Anda:</b>
${txListText}

━━━━━━━━━━━━━━━━━━
<i>Gunakan tombol di bawah untuk menambah saldo Anda secara otomatis menggunakan QRIS (AutoGoPay).</i>
`;

    const buttons = [
      [
        ['📥 Top Up Saldo', 'topup'],
        ['🔄 Refresh', 'balance']
      ]
    ];

    return {
      text,
      keyboard: buttons
    };
  }
};
