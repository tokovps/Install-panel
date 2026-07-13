import { sessionStore } from '../store/session.js';

export default {
  id: 'admin:broadcast',
  render: async (user) => {
    if (user.role !== 'admin') {
      return { text: '⚠️ Akses ditolak.', keyboard: [[['🏠 Menu Utama', 'home']]] };
    }

    // Set wizard session for broadcasting
    sessionStore.set(user.telegramId, 'state', 'awaiting_broadcast_message');

    const text = `
📣 <b>Broadcast Pesan ke Semua Pengguna</b>

Silakan ketik dan kirimkan pesan pengumuman yang ingin Anda broadcast ke seluruh pengguna terdaftar di chat ini.

⚠️ <b>Ketentuan:</b>
• Mendukung formatting HTML (Contoh: <code>&lt;b&gt;tebal&lt;/b&gt;</code>, <code>&lt;i&gt;miring&lt;/i&gt;</code>).
• Pesan akan langsung dikirimkan ke seluruh pengguna satu per satu.
• Harap berhati-hati sebelum mengirimkan pesan.

<i>Klik tombol ❌ Batal di bawah jika ingin membatalkan.</i>
`;

    return {
      text,
      cancelCallback: 'admin:dashboard'
    };
  }
};
