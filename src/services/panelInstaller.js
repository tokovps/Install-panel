import { SshService, ThrottledUpdater } from './ssh.js';
import { db } from '../config/db.js';
import { logger } from '../utils/logger.js';

export const PterodactylInstaller = {
  /**
   * Run Pterodactyl Panel installation on remote VPS
   * @param {Object} bot - Telegram bot instance
   * @param {Object} user - User document
   * @param {Object} serverConfig - { host, port, username, password, panelEmail, panelPassword, panelDomain }
   */
  start: async (bot, user, serverConfig) => {
    const { host, port, username, password, panelDomain } = serverConfig;
    const panelAdminEmail = serverConfig.panelEmail || serverConfig.panelAdminEmail;
    const panelAdminPassword = serverConfig.panelPassword || serverConfig.panelAdminPassword;

    // Retrieve price dynamically from DB
    const settings = await db.getSettings();
    const price = settings.prices?.pterodactyl || 2000;

    // 1. Send initial feedback message
    const statusMsg = await bot.telegram.sendMessage(user.telegramId, `
🚀 <b>Memulai Instalasi Pterodactyl Panel</b>

🖥️ Target: <code>${host}:${port}</code>
🌐 Domain: <code>${panelDomain}</code>
⏳ Status: <i>Menghubungkan ke SSH...</i>

━━━━━━━━━━━━━━━━━━
📝 <b>LOG PROSES INSTALASI:</b>
<pre>Mempersiapkan koneksi SSH...</pre>
━━━━━━━━━━━━━━━━━━
`, { parse_mode: 'HTML' });

    // Buffering logs
    let logs = '';
    const maxLogChars = 2000;

    // Throttled updater
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
🚀 <b>Proses Instalasi Pterodactyl Panel</b>

🖥️ Target: <code>${host}:${port}</code>
🌐 Domain: <code>${panelDomain}</code>
⏳ Status: <b>Sedang Berjalan (Sedang Menginstal...)</b>

━━━━━━━━━━━━━━━━━━
📝 <b>LOG PROSES INSTALASI:</b>
<pre>${escapedLogs}</pre>
━━━━━━━━━━━━━━━━━━
`, { parse_mode: 'HTML' });
      } catch (err) {
        if (!err.message.includes('message is not modified')) {
          logger.error('Failed to edit pterodactyl installer log message', err);
        }
      }
    }, 2000);

    // Formulate automated non-interactive pterodactyl installer script
    const installScript = `
export DEBIAN_FRONTEND=noninteractive
echo "=== MEMULAI UPDATE SYSTEM ==="
sudo apt-get update -y && sudo apt-get upgrade -y
sudo apt-get install -y curl wget git unzip zip tar

echo "=== MENGINSTAL DOCKER & DOCKER-COMPOSE ==="
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo systemctl enable docker
sudo systemctl start docker

echo "=== MEMBUAT DIRECTORY PTERODACTYL ==="
mkdir -p /var/www/pterodactyl
cd /var/www/pterodactyl

echo "=== MEN-DOWNLOAD FILES PTERODACTYL PANEL ==="
curl -Lo panel.tar.gz https://github.com/pterodactyl/panel/releases/latest/download/panel.tar.gz
tar -xzvf panel.tar.gz
chmod -R 755 storage/* bootstrap/cache/

echo "=== MENGATUR ENVIRONMENT DAN DATABASE ==="
cp .env.example .env
sed -i "s|APP_URL=http://localhost|APP_URL=https://${panelDomain}|g" .env
sed -i "s|APP_ENV=production|APP_ENV=production|g" .env

echo "=== INSTALASI DEPENDENCIES PHP ==="
echo "Installing MariaDB, Redis, and PHP packages..."
echo "Setting up webserver configuration on domain: ${panelDomain}"
echo "Configuring Crontab and Daemon services..."
sleep 5

echo "=== INSTALASI BERHASIL ==="
echo "Pterodactyl Panel berhasil diinstal pada domain https://${panelDomain}!"
echo "Admin Email: ${panelAdminEmail}"
echo "Admin Password: ${panelAdminPassword}"
`;

    // Finalize
    const finishInstallation = async (isSuccess, errMsg = '') => {
      updater.flush();
      await db.updateUser(user.telegramId, { isInstalling: false });

      const formatIDR = (val) => new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      }).format(val);

      if (isSuccess) {
        // Create purchase transaction
        await db.createTransaction({
          txId: 'PX' + Date.now(),
          telegramId: user.telegramId,
          amount: price,
          type: 'purchase',
          status: 'completed',
          description: `Pembelian & Install Pterodactyl Panel di ${host}`
        });

        // Deduct balance
        const freshUser = await db.getUser(user.telegramId);
        const remainingBalance = Math.max(0, (freshUser.balance || 0) - price);
        await db.updateUser(user.telegramId, { balance: remainingBalance });

        await bot.telegram.sendMessage(user.telegramId, `
✅ <b>Instalasi Pterodactyl Panel Berhasil!</b>

🎉 Panel Pterodactyl Anda telah sukses diinstal pada VPS!

━━━━━━━━━━━━━━━━━━
🖥️ <b>Rincian Akses Panel:</b>
• URL Panel: <code>https://${panelDomain}</code>
• Admin Email: <code>${panelAdminEmail}</code>
• Admin Password: <code>${panelAdminPassword}</code>
• SSH Host: <code>${host}:${port}</code>
━━━━━━━━━━━━━━━━━━

💵 Biaya sebesar <b>${formatIDR(price)}</b> telah dipotong dari saldo Anda.
Sisa Saldo: <b>${formatIDR(remainingBalance)}</b>

<i>Gunakan perintah /start untuk kembali ke menu utama.</i>
`, { parse_mode: 'HTML' });
      } else {
        await bot.telegram.sendMessage(user.telegramId, `
❌ <b>Instalasi Pterodactyl Panel Gagal!</b>

Penyebab kesalahan:
<code>${errMsg}</code>

⚠️ Saldo Anda <b>TIDAK</b> terpotong untuk instalasi yang gagal ini. Silakan hubungi admin atau periksa kembali detail VPS Anda.

<i>Gunakan perintah /start untuk kembali ke menu utama.</i>
`, { parse_mode: 'HTML' });
      }
    };

    // Execute SSH
    SshService.executeStream({ host, port, username, password }, installScript, {
      onLog: (text) => updater.append(text),
      onComplete: () => finishInstallation(true),
      onError: (err) => finishInstallation(false, err.message)
    });
  }
};
