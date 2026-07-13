import { db } from '../config/db.js';

export default {
  id: 'help',
  render: async (user) => {
    const settings = await db.getSettings();
    const botConf = settings.bot || {};
    const contactHandle = botConf.contact || '@Support_PteroBot';
    const contactUrl = `https://t.me/${contactHandle.replace('@', '')}`;

    const text = `
❓ <b>Panduan & Bantuan Penggunaan Bot</b>

Selamat datang di pusat bantuan. Bot ini dirancang untuk memudahkan Anda melakukan instalasi otomatis Pterodactyl Panel dan database MySQL pada VPS/Server Anda menggunakan protokol SSH2 yang aman.

━━━━━━━━━━━━━━━━━━
📖 <b>Cara Melakukan Instalasi:</b>
1. Pastikan Anda memiliki saldo yang cukup (Cek di menu 💰 <b>Saldo</b>).
2. Jika kurang, lakukan Top Up menggunakan menu 📥 <b>Top Up Saldo</b> (pembayaran otomatis via QRIS).
3. Pilih layanan instalasi yang Anda inginkan pada Menu Utama:
   • <b>Install Pterodactyl</b>: Instalasi Panel Pterodactyl lengkap.
   • <b>Install MySQL</b>: Instalasi database server MySQL.
4. Masukkan informasi server tujuan (IP Address, Port SSH, Username, Password, Domain, dll.) sesuai instruksi Wizard.
5. Bot akan melakukan koneksi SSH secara aman dan memulai proses instalasi secara real-time.
6. Anda akan menerima log instalasi langsung di chat ini hingga proses selesai!

⚠️ <b>Persyaratan Server (VPS) Tujuan:</b>
• OS yang direkomendasikan: <b>Ubuntu 20.04 / 22.04 LTS</b> atau <b>Debian 11 / 12</b> (Kondisi VPS harus Fresh/Bersih).
• Akses SSH dengan user <b>root</b>.
• Port SSH standar (biasanya 22) harus terbuka.
• Untuk Pterodactyl, pastikan domain/subdomain sudah diarahkan (pointing) ke IP VPS Anda.

━━━━━━━━━━━━━━━━━━
📞 <b>Hubungi Support:</b>
Jika Anda mengalami kendala pembayaran atau instalasi, silakan hubungi tim dukungan kami di:
• Telegram: ${contactHandle}
• Saldo Terpotong Tapi Gagal: Kirim bukti Invoice ID Anda ke admin.
`;

    return {
      text,
      keyboard: [
        [
          { text: '💬 Hubungi Support', url: contactUrl }
        ]
      ]
    };
  }
};
