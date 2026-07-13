import { db } from '../config/db.js';

export default {
  id: 'admin:users',
  render: async (user) => {
    if (user.role !== 'admin') {
      return { text: '⚠️ Akses ditolak.', keyboard: [[['🏠 Menu Utama', 'home']]] };
    }

    const users = await db.getAllUsers();
    
    const formatIDR = (val) => new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val);

    const userRows = users.map((u, idx) => {
      const roleBadge = u.role === 'admin' ? '👑' : '👤';
      return `${idx + 1}. ${roleBadge} ID: <code>${u.telegramId}</code> - @${u.username || 'no_user'}\n   └─ Saldo: <b>${formatIDR(u.balance || 0)}</b>`;
    }).join('\n\n');

    const text = `
👥 <b>Manajemen Pengguna Terdaftar</b>

Berikut adalah daftar pengguna yang terdaftar di bot Anda:

━━━━━━━━━━━━━━━━━━
${userRows || '<i>Belum ada pengguna terdaftar.</i>'}
━━━━━━━━━━━━━━━━━━

✏️ <b>Modifikasi Saldo Pengguna Langsung:</b>
Anda dapat mengubah saldo pengguna secara instan dari chat dengan mengetikkan format perintah berikut:
<code>/setsaldo [id_telegram] [nominal]</code>

<i>Contoh:</i> <code>/setsaldo 123456789 50000</code>

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
