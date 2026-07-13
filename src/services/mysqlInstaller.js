import { SshService, ThrottledUpdater } from './ssh.js';
import { db } from '../config/db.js';
import { logger } from '../utils/logger.js';

export const MysqlInstaller = {
  /**
   * Run MySQL installation on remote VPS
   * @param {Object} bot - Telegram bot instance
   * @param {Object} user - User document
   * @param {Object} serverConfig - { host, port, username, password, mysqlRootPassword }
   */
  start: async (bot, user, serverConfig) => {
    const { host, port, username, password, mysqlRootPassword } = serverConfig;
    
    // Retrieve price dynamically from DB
    const settings = await db.getSettings();
    const price = settings.prices?.mysql || 2000;

    // 1. Send initial installation feedback message
    const statusMsg = await bot.telegram.sendMessage(user.telegramId, `
🚀 <b>Memulai Instalasi MySQL Server</b>

🖥️ Target: <code>${host}:${port}</code>
⏳ Status: <i>Menghubungkan ke SSH...</i>

━━━━━━━━━━━━━━━━━━
📝 <b>LOG PROSES INSTALASI:</b>
<pre>Mempersiapkan koneksi SSH...</pre>
━━━━━━━━━━━━━━━━━━
`, { parse_mode: 'HTML' });

    // Buffering logs
    let logs = '';
    const maxLogChars = 2000; // Telegram message size limit constraint

    // Throttled updater to prevent Rate Limits
    const updater = new ThrottledUpdater(async (bufferedText) => {
      logs += bufferedText;
      if (logs.length > maxLogChars) {
        logs = '... (truncated) ...\n' + logs.substring(logs.length - maxLogChars);
      }

      const escapedLogs = logs
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      try {
        await bot.telegram.editMessageText(user.telegramId, statusMsg.message_id, null, `
🚀 <b>Proses Instalasi MySQL Server</b>

🖥️ Target: <code>${host}:${port}</code>
⏳ Status: <b>Sedang Berjalan (Sedang Menginstal...)</b>

━━━━━━━━━━━━━━━━━━
📝 <b>LOG PROSES INSTALASI:</b>
<pre>${escapedLogs}</pre>
━━━━━━━━━━━━━━━━━━
`, { parse_mode: 'HTML' });
      } catch (err) {
        if (!err.message.includes('message is not modified')) {
          logger.error('Failed to edit installation log message', err);
        }
      }
    }, 2000);

    // Formulate clean installation script
    const installScript = `
export DEBIAN_FRONTEND=noninteractive
echo "=== MEMULAI UPDATE SYSTEM ==="
sudo apt-get update -y
echo "=== MENGINSTAL MYSQL SERVER ==="
sudo apt-get install -y mysql-server
echo "=== MENGONFIGURASI MYSQL PASSWORD ==="
sudo systemctl start mysql
sudo systemctl enable mysql
sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${mysqlRootPassword}';"
sudo mysql -e "FLUSH PRIVILEGES;"
echo "=== RESTARTING SERVICE ==="
sudo systemctl restart mysql
echo "=== INSTALASI SELESAI ==="
echo "MySQL Server berhasil diinstal!"
echo "User: root"
echo "Password: ${mysqlRootPassword}"
`;

    const finishInstallation = async (isSuccess, errMsg = '') => {
      updater.flush();
      await db.updateUser(user.telegramId, { isInstalling: false });

      const formatIDR = (val) => new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      }).format(val);

      if (isSuccess) {
        // Record completed purchase transaction
        await db.createTransaction({
          txId: 'PX' + Date.now(),
          telegramId: user.telegramId,
          amount: price,
          type: 'purchase',
          status: 'completed',
          description: `Pembelian & Install MySQL Server di ${host}`
        });

        // Deduct balance from user
        const freshUser = await db.getUser(user.telegramId);
        const remainingBalance = Math.max(0, (freshUser.balance || 0) - price);
        await db.updateUser(user.telegramId, { balance: remainingBalance });

        await bot.telegram.sendMessage(user.telegramId, `
✅ <b>Instalasi MySQL Server Selesai!</b>

🎉 MySQL Server telah berhasil diinstal dan dikonfigurasi di VPS Anda!

━━━━━━━━━━━━━━━━━━
🖥️ <b>Rincian Akses MySQL:</b>
• IP Address: <code>${host}</code>
• Port MySQL: <code>3306</code>
• Username: <code>root</code>
• Password: <code>${mysqlRootPassword}</code>
━━━━━━━━━━━━━━━━━━

💵 Biaya sebesar <b>${formatIDR(price)}</b> telah dipotong dari saldo Anda.
Sisa Saldo: <b>${formatIDR(remainingBalance)}</b>

<i>Gunakan perintah /start untuk kembali ke menu utama.</i>
`, { parse_mode: 'HTML' });
      } else {
        await bot.telegram.sendMessage(user.telegramId, `
❌ <b>Instalasi MySQL Server Gagal!</b>

Penyebab kesalahan:
<code>${errMsg}</code>

⚠️ Saldo Anda <b>TIDAK</b> terpotong untuk instalasi yang gagal ini. Silakan hubungi admin atau periksa kembali detail VPS Anda.

<i>Gunakan perintah /start untuk kembali ke menu utama.</i>
`, { parse_mode: 'HTML' });
      }
    };

    // Execute SSH command
    SshService.executeStream({ host, port, username, password }, installScript, {
      onLog: (text) => updater.append(text),
      onComplete: () => finishInstallation(true),
      onError: (err) => finishInstallation(false, err.message)
    });
  }
};
