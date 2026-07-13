/**
 * Centralized Logger Utility
 */
export const logger = {
  info: (message, ...args) => {
    console.log(`[INFO] [${new Date().toISOString()}] ${message}`, ...args);
  },
  warn: (message, ...args) => {
    console.warn(`[WARN] [${new Date().toISOString()}] ${message}`, ...args);
  },
  error: (message, error) => {
    console.error(`[ERROR] [${new Date().toISOString()}] ${message}`, error || '');
    if (error && error.stack) {
      console.error(error.stack);
    }
  },
  debug: (message, ...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEBUG] [${new Date().toISOString()}] ${message}`, ...args);
    }
  }
};
