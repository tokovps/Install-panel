import { db } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { sessionStore } from '../store/session.js';
import { Keyboard } from './keyboard.js';
import { EditorEngine } from './editor.js';

/**
 * Helper to validate IP address syntax
 */
function isValidIp(ip) {
  const regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
  if (!regex.test(ip)) return false;
  return ip.split('.').every(num => parseInt(num, 10) >= 0 && num <= 255);
}

/**
 * Helper to validate email syntax
 */
function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Renders the Confirmation Summary screen for the MySQL installer wizard
 */
async function renderMysqlConfirm(ctx, user) {
  const telegramId = user.telegramId;
  const ip = sessionStore.get(telegramId, 'ip');
  const port = sessionStore.get(telegramId, 'port');
  const username = sessionStore.get(telegramId, 'username');
  const mysqlPassword = sessionStore.get(telegramId, 'mysqlPassword');

  const settings = await db.getSettings();
  const price = settings.prices?.mysql || 2000;

  const formatIDR = (val) => new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(val);

  const text = `
📋 <b>Konfirmasi Pembelian & Instalasi MySQL</b>

Silakan periksa kembali rincian data konfigurasi VPS Anda sebelum memulai proses instalasi:

━━━━━━━━━━━━━━━━━━
🖥️ <b>Detail VPS & Konfigurasi:</b>
• IP Address: <code>${ip}</code>
• SSH Port: <code>${port}</code>
• SSH Username: <code>${username}</code>
• MySQL Password: <code>${mysqlPassword}</code>
━━━━━━━━━━━━━━━━━━

💵 Biaya Layanan: <b>${formatIDR(price)}</b> (Akan langsung dipotong dari saldo Anda).

⚠️ <b>Pernyataan Persetujuan:</b>
Dengan menekan tombol konfirmasi di bawah, proses instalasi akan segera dijalankan secara otomatis. Pastikan VPS Anda dalam kondisi fresh (kosong) dan terkoneksi internet.

<i>Klik tombol di bawah ini untuk memulai instalasi atau klik ❌ Batal untuk membatalkan.</i>
`;

  const keyboard = Keyboard.create([
    [['🚀 Konfirmasi & Install', 'install:mysql:confirm']]
  ], {
    currentPage: 'install:mysql_confirm',
    cancelCallback: 'cancel_wizard'
  });

  await EditorEngine.editMessage(ctx, { text, keyboard }, user);
}

/**
 * Renders the Confirmation Summary screen for the Pterodactyl installer wizard
 */
async function renderPterodactylConfirm(ctx, user) {
  const telegramId = user.telegramId;
  const ip = sessionStore.get(telegramId, 'ip');
  const port = sessionStore.get(telegramId, 'port');
  const username = sessionStore.get(telegramId, 'username');
  const panelDomain = sessionStore.get(telegramId, 'panelDomain');
  const panelEmail = sessionStore.get(telegramId, 'panelEmail');
  const panelPassword = sessionStore.get(telegramId, 'panelPassword');

  const settings = await db.getSettings();
  const price = settings.prices?.pterodactyl || 2000;

  const formatIDR = (val) => new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(val);

  const text = `
📋 <b>Konfirmasi Pembelian & Instalasi Pterodactyl</b>

Silakan periksa kembali rincian data konfigurasi VPS Anda sebelum memulai proses instalasi:

━━━━━━━━━━━━━━━━━━
🖥️ <b>Detail VPS & Konfigurasi:</b>
• IP Address: <code>${ip}</code>
• SSH Port: <code>${port}</code>
• SSH Username: <code>${username}</code>
• Domain Panel: <code>${panelDomain}</code>
• Admin Email: <code>${panelEmail}</code>
• Admin Password: <code>${panelPassword}</code>
━━━━━━━━━━━━━━━━━━

💵 Biaya Layanan: <b>${formatIDR(price)}</b> (Akan langsung dipotong dari saldo Anda).

⚠️ <b>Pernyataan Persetujuan:</b>
Pastikan subdomain <code>${panelDomain}</code> sudah sukses diarahkan (pointing) ke IP VPS <code>${ip}</code> Anda sebelum mengonfirmasi.

<i>Klik tombol di bawah ini untuk memulai instalasi atau klik ❌ Batal untuk membatalkan.</i>
`;

  const keyboard = Keyboard.create([
    [['🚀 Konfirmasi & Install', 'install:panel:confirm']]
  ], {
    currentPage: 'install:panel_confirm',
    cancelCallback: 'cancel_wizard'
  });

  await EditorEngine.editMessage(ctx, { text, keyboard }, user);
}

export const WizardEngine = {
  /**
   * Main text input processor for active wizard sessions
   */
  handleText: async (ctx, user, text) => {
    const telegramId = user.telegramId;
    const wizardType = sessionStore.get(telegramId, 'wizard');
    const step = sessionStore.get(telegramId, 'step');

    if (!wizardType || !step) return false; // Not in wizard mode

    // Helper: Send error text with same keyboard and cancel button
    const sendError = async (errMsg, customKeyboard = null) => {
      const kb = customKeyboard || Keyboard.create([], { cancelCallback: 'cancel_wizard', currentPage: 'wizard_err' });
      await EditorEngine.editMessage(ctx, { text: `⚠️ <b>Kesalahan Input:</b>\n${errMsg}`, keyboard: kb }, user);
    };

    // --- SHARED WIZARD STEPS ---
    
    // Step 1: Input IP Address
    if (step === 'input_ip') {
      const ipInput = text.trim();
      if (!isValidIp(ipInput)) {
        return await sendError('Format IP Address tidak valid! Silakan masukkan IP VPS yang benar.\nContoh: <code>103.123.45.67</code>');
      }
      sessionStore.set(telegramId, 'ip', ipInput);
      sessionStore.set(telegramId, 'step', 'input_port');
      
      const keyboard = Keyboard.create([
        [['🔌 Gunakan Port Standar (22)', 'wizard:set_port:22']]
      ], { cancelCallback: 'cancel_wizard', currentPage: 'wizard' });

      await EditorEngine.editMessage(ctx, {
        text: `✅ IP tersimpan: <code>${ipInput}</code>\n\nSilakan ketik atau klik tombol di bawah untuk memasukkan <b>Port SSH VPS</b> Anda:`,
        keyboard
      }, user);
      return true;
    }

    // Step 2: Input SSH Port
    if (step === 'input_port') {
      const portInput = parseInt(text.trim(), 10);
      if (isNaN(portInput) || portInput <= 0 || portInput > 65535) {
        return await sendError('Port SSH tidak valid! Harus berupa angka antara 1 sampai 65535.');
      }
      sessionStore.set(telegramId, 'port', portInput);
      sessionStore.set(telegramId, 'step', 'input_username');

      const keyboard = Keyboard.create([
        [['👤 Gunakan User root', 'wizard:set_username:root']]
      ], { cancelCallback: 'cancel_wizard', currentPage: 'wizard' });

      await EditorEngine.editMessage(ctx, {
        text: `✅ Port tersimpan: <code>${portInput}</code>\n\nSilakan ketik atau klik tombol di bawah untuk memasukkan <b>SSH Username</b> VPS Anda:`,
        keyboard
      }, user);
      return true;
    }

    // Step 3: Input SSH Username
    if (step === 'input_username') {
      const usernameInput = text.trim();
      if (usernameInput.length === 0) {
        return await sendError('Username tidak boleh kosong!');
      }
      sessionStore.set(telegramId, 'username', usernameInput);
      sessionStore.set(telegramId, 'step', 'input_password');

      await EditorEngine.editMessage(ctx, {
        text: `✅ Username tersimpan: <code>${usernameInput}</code>\n\nSilakan ketik dan kirimkan <b>SSH Password</b> VPS Anda:\n<i>(Keamanan Terjamin: Password hanya disimpan sementara di memory untuk instalasi)</i>`,
        keyboard: Keyboard.create([], { cancelCallback: 'cancel_wizard', currentPage: 'wizard' })
      }, user);
      return true;
    }

    // Step 4: Input SSH Password
    if (step === 'input_password') {
      const passwordInput = text.trim();
      if (passwordInput.length === 0) {
        return await sendError('Password tidak boleh kosong!');
      }
      sessionStore.set(telegramId, 'password', passwordInput);

      if (wizardType === 'mysql') {
        sessionStore.set(telegramId, 'step', 'input_mysql_password');
        await EditorEngine.editMessage(ctx, {
          text: `✅ SSH Password tersimpan.\n\nSilakan tentukan <b>Password Root MySQL</b> baru yang ingin Anda buat:\nContoh: <code>MySecureDatabasePass123!</code>`,
          keyboard: Keyboard.create([], { cancelCallback: 'cancel_wizard', currentPage: 'wizard' })
        }, user);
      } else if (wizardType === 'pterodactyl') {
        sessionStore.set(telegramId, 'step', 'input_panel_domain');
        await EditorEngine.editMessage(ctx, {
          text: `✅ SSH Password tersimpan.\n\nSilakan masukkan <b>Domain/Subdomain</b> untuk Panel Pterodactyl Anda:\n<i>(Pastikan domain sudah mengarah ke IP VPS Anda!)</i>\nContoh: <code>panel.domainanda.com</code>`,
          keyboard: Keyboard.create([], { cancelCallback: 'cancel_wizard', currentPage: 'wizard' })
        }, user);
      }
      return true;
    }

    // --- MYSQL SPECIFIC STEPS ---
    if (wizardType === 'mysql') {
      if (step === 'input_mysql_password') {
        const mysqlPass = text.trim();
        if (mysqlPass.length < 5) {
          return await sendError('Password MySQL terlalu pendek! Minimal 5 karakter untuk keamanan.');
        }
        sessionStore.set(telegramId, 'mysqlPassword', mysqlPass);
        sessionStore.set(telegramId, 'step', 'confirm');

        await renderMysqlConfirm(ctx, user);
        return true;
      }
    }

    // --- PTERODACTYL SPECIFIC STEPS ---
    if (wizardType === 'pterodactyl') {
      // Step 5: Input Panel Domain
      if (step === 'input_panel_domain') {
        const domainInput = text.trim().toLowerCase();
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
        if (!domainRegex.test(domainInput)) {
          return await sendError('Domain tidak valid! Silakan masukkan format domain yang benar.\nContoh: <code>panel.domainanda.com</code>');
        }
        sessionStore.set(telegramId, 'panelDomain', domainInput);
        sessionStore.set(telegramId, 'step', 'input_panel_email');

        await EditorEngine.editMessage(ctx, {
          text: `✅ Domain tersimpan: <code>${domainInput}</code>\n\nSilakan masukkan <b>Email Administrator</b> untuk login Panel Pterodactyl Anda:\nContoh: <code>admin@domainanda.com</code>`,
          keyboard: Keyboard.create([], { cancelCallback: 'cancel_wizard', currentPage: 'wizard' })
        }, user);
        return true;
      }

      // Step 6: Input Panel Admin Email
      if (step === 'input_panel_email') {
        const emailInput = text.trim();
        if (!isValidEmail(emailInput)) {
          return await sendError('Format Email tidak valid! Silakan masukkan email yang benar.');
        }
        sessionStore.set(telegramId, 'panelEmail', emailInput);
        sessionStore.set(telegramId, 'step', 'input_panel_password');

        await EditorEngine.editMessage(ctx, {
          text: `✅ Email tersimpan: <code>${emailInput}</code>\n\nSilakan tentukan <b>Password Administrator</b> untuk login Panel Pterodactyl Anda:\nContoh: <code>AdminSecretPass123!</code>`,
          keyboard: Keyboard.create([], { cancelCallback: 'cancel_wizard', currentPage: 'wizard' })
        }, user);
        return true;
      }

      // Step 7: Input Panel Admin Password
      if (step === 'input_panel_password') {
        const panelPass = text.trim();
        if (panelPass.length < 6) {
          return await sendError('Password Panel terlalu pendek! Minimal 6 karakter.');
        }
        sessionStore.set(telegramId, 'panelPassword', panelPass);
        sessionStore.set(telegramId, 'step', 'confirm');

        await renderPterodactylConfirm(ctx, user);
        return true;
      }
    }

    return false;
  },

  /**
   * Handles button click callbacks for wizard quick-presets
   */
  handleCallback: async (ctx, user, callbackData) => {
    const telegramId = user.telegramId;
    const wizardType = sessionStore.get(telegramId, 'wizard');
    const step = sessionStore.get(telegramId, 'step');

    if (!wizardType || !step) return false;

    // A. Handle quick-preset SSH Port 22
    if (callbackData === 'wizard:set_port:22' && step === 'input_port') {
      sessionStore.set(telegramId, 'port', 22);
      sessionStore.set(telegramId, 'step', 'input_username');
      
      const keyboard = Keyboard.create([
        [['👤 Gunakan User root', 'wizard:set_username:root']]
      ], { cancelCallback: 'cancel_wizard', currentPage: 'wizard' });

      await EditorEngine.editMessage(ctx, {
        text: `✅ Port tersimpan: <code>22</code>\n\nSilakan ketik atau klik tombol di bawah untuk memasukkan <b>SSH Username</b> VPS Anda:`,
        keyboard
      }, user);
      return true;
    }

    // B. Handle quick-preset SSH Username root
    if (callbackData === 'wizard:set_username:root' && step === 'input_username') {
      sessionStore.set(telegramId, 'username', 'root');
      sessionStore.set(telegramId, 'step', 'input_password');

      await EditorEngine.editMessage(ctx, {
        text: `✅ Username tersimpan: <code>root</code>\n\nSilakan ketik dan kirimkan <b>SSH Password</b> VPS Anda:\n<i>(Keamanan Terjamin: Password hanya disimpan sementara di memory untuk instalasi)</i>`,
        keyboard: Keyboard.create([], { cancelCallback: 'cancel_wizard', currentPage: 'wizard' })
      }, user);
      return true;
    }

    return false;
  }
};
