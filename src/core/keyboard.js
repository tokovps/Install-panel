import { Markup } from 'telegraf';

/**
 * Keyboard Engine & Builder
 */
export const Keyboard = {
  /**
   * Create an Inline Keyboard markup
   * @param {Array} buttons - Array of rows, where each row is an array of buttons [text, callback] or objects
   * @param {Object} options - Options for navigation, cancel, pagination
   * @returns {Object} - Telegraf Inline Keyboard Markup
   */
  create: (buttons, options = {}) => {
    const { 
      showBack = true, 
      showHome = true, 
      cancelCallback = null,
      currentPage = 'home',
      hasHistory = false
    } = options;

    const formattedRows = [];

    // Process input buttons
    if (Array.isArray(buttons)) {
      buttons.forEach(row => {
        if (Array.isArray(row)) {
          const rowButtons = [];
          row.forEach(btn => {
            if (Array.isArray(btn) && btn.length >= 2) {
              rowButtons.push(Markup.button.callback(btn[0], btn[1]));
            } else if (typeof btn === 'object' && btn.text && btn.callback_data) {
              rowButtons.push(Markup.button.callback(btn.text, btn.callback_data));
            } else if (typeof btn === 'object' && btn.text && btn.url) {
              rowButtons.push(Markup.button.url(btn.text, btn.url));
            }
          });
          if (rowButtons.length > 0) {
            formattedRows.push(rowButtons);
          }
        }
      });
    }

    const controlRow = [];

    // 1. Show Cancel button if callback specified
    if (cancelCallback) {
      formattedRows.push([Markup.button.callback('❌ Batal', cancelCallback)]);
    }

    // 2. Show Back & Home buttons if not on home page
    if (currentPage !== 'home') {
      if (showBack && hasHistory) {
        controlRow.push(Markup.button.callback('⬅️ Kembali', 'back'));
      }
      if (showHome) {
        controlRow.push(Markup.button.callback('🏠 Menu Utama', 'home'));
      }
    }

    if (controlRow.length > 0) {
      formattedRows.push(controlRow);
    }

    return Markup.inlineKeyboard(formattedRows);
  }
};
