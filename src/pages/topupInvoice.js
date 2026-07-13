import { db } from '../config/db.js';
import { sessionStore } from '../store/session.js';

export default {
  id: 'topup:invoice',
  render: async (user) => {
    const activeInvoiceId = sessionStore.get(user.telegramId, 'activeInvoiceId');
    if (!activeInvoiceId) {
      return {
        text: '⚠️ Tidak ada invoice aktif ditemukan.',
        keyboard: [[['📥 Pilih Nominal', 'topup']]]
      };
    }

    const tx = await db.getTransaction(activeInvoiceId);
    if (!tx) {
      return {
        text: '⚠️ Invoice tidak ditemukan di database.',
        keyboard: [[['📥 Pilih Nominal', 'topup']]]
      };
    }

    const formattedAmount = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(tx.amount);

    const statusEmoji = tx.status === 'completed' ? '✅' : tx.status === 'pending' ? '⏳' : '❌';

    const text = `
🧾 <b>Invoice Pembayaran QRIS</b>

Silakan scan QR Code di atas menggunakan aplikasi e-Wallet (GoPay, OVO, Dana, LinkAja, ShopeePay) atau m-Banking Anda.

━━━━━━━━━━━━━━━━━━
📋 <b>Rincian Pembayaran:</b>
• No. Invoice: <code>${tx.txId}</code>
• Nominal: <b>${formattedAmount}</b>
• Metode: <b>QRIS AutoGoPay</b>
• Status: ${statusEmoji} <b>${tx.status.toUpperCase()}</b>
━━━━━━━━━━━━━━━━━━

💡 <b>Petunjuk Pembayaran:</b>
1. Simpan atau screenshot QR Code di atas.
2. Buka aplikasi e-Wallet atau m-Banking pilihan Anda.
3. Pilih menu scan/bayar lalu upload gambar QR Code tersebut.
4. Selesaikan pembayaran. Saldo Anda akan otomatis bertambah dalam beberapa detik!

<i>Jika saldo belum bertambah setelah 1 menit, klik tombol "🔄 Cek Pembayaran" di bawah.</i>
`;

    const buttons = [
      [
        ['🔄 Cek Pembayaran', `topup:check:${tx.txId}`],
        ['⬅️ List Top Up', 'topup']
      ]
    ];

    return {
      text,
      photo: tx.qrUrl, // Sends QR Code as photo!
      keyboard: buttons
    };
  }
};
