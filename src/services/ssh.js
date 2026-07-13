import { Client } from 'ssh2';
import { logger } from '../utils/logger.js';

/**
 * Throttler helper to limit Telegram edit rate-limit issues
 */
export class ThrottledUpdater {
  constructor(updateFn, delayMs = 1500) {
    this.updateFn = updateFn;
    this.delayMs = delayMs;
    this.lastUpdate = 0;
    this.buffer = '';
    this.timeout = null;
  }

  append(text) {
    this.buffer += text;
    this.scheduleUpdate();
  }

  scheduleUpdate() {
    if (this.timeout) return;

    const now = Date.now();
    const elapsed = now - this.lastUpdate;

    if (elapsed >= this.delayMs) {
      this.triggerUpdate();
    } else {
      this.timeout = setTimeout(() => {
        this.triggerUpdate();
      }, this.delayMs - elapsed);
    }
  }

  triggerUpdate() {
    this.timeout = null;
    this.lastUpdate = Date.now();
    if (this.buffer) {
      this.updateFn(this.buffer);
    }
  }

  flush() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    if (this.buffer) {
      this.updateFn(this.buffer);
    }
  }
}

export const SshService = {
  /**
   * Execute multiple commands or a script on a remote server via SSH and stream the log outputs
   * @param {Object} credentials - { host, port, username, password }
   * @param {string} command - Shell command to run
   * @param {Object} options - { onLog, onComplete, onError, timeoutMs = 600000 }
   */
  executeStream: (credentials, command, options = {}) => {
    const {
      onLog = () => {},
      onComplete = () => {},
      onError = () => {},
      timeoutMs = 600000 // 10 minutes default
    } = options;

    const conn = new Client();
    let isFinished = false;
    let timer = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      isFinished = true;
      try {
        conn.end();
      } catch (err) {}
    };

    // Timeout safety
    timer = setTimeout(() => {
      if (!isFinished) {
        logger.warn(`SSH command timed out on ${credentials.host}`);
        onError(new Error('Koneksi SSH Timeout (Waktu instalasi melebihi batas)'));
        cleanup();
      }
    }, timeoutMs);

    conn.on('ready', () => {
      onLog('🔑 [SSH] Koneksi berhasil! Mempersiapkan shell...\n');
      
      conn.exec(command, (err, stream) => {
        if (err) {
          onError(err);
          cleanup();
          return;
        }

        stream.on('data', (data) => {
          onLog(data.toString());
        });

        stream.stderr.on('data', (data) => {
          onLog(data.toString());
        });

        stream.on('close', (code, signal) => {
          if (isFinished) return;
          logger.info(`SSH execution closed with code ${code}`);
          if (code === 0) {
            onComplete(code);
          } else {
            onError(new Error(`Instalasi terhenti dengan kode keluar: ${code}`));
          }
          cleanup();
        });
      });
    });

    conn.on('error', (err) => {
      if (isFinished) return;
      logger.error(`SSH Connection Error for ${credentials.host}`, err);
      let errorMsg = err.message;
      if (err.message.includes('All configured authentication methods failed')) {
        errorMsg = 'Autentikasi gagal (Username atau Password salah)';
      } else if (err.message.includes('ETIMEDOUT') || err.message.includes('ENOTFOUND')) {
        errorMsg = 'Gagal menghubungi server (IP salah atau server offline)';
      }
      onError(new Error(errorMsg));
      cleanup();
    });

    try {
      conn.connect({
        host: credentials.host,
        port: parseInt(credentials.port || '22', 10),
        username: credentials.username || 'root',
        password: credentials.password,
        readyTimeout: 15000 // 15 seconds connection timeout
      });
    } catch (err) {
      onError(err);
      cleanup();
    }

    return {
      disconnect: cleanup
    };
  }
};
