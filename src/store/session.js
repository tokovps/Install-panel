/**
 * In-Memory Temporary Session Store for Wizards and Multi-Step Inputs
 */
const sessions = new Map();

export const sessionStore = {
  get: (telegramId, key) => {
    const id = parseInt(telegramId, 10);
    if (!sessions.has(id)) {
      sessions.set(id, {});
    }
    const userSession = sessions.get(id);
    return key ? userSession[key] : userSession;
  },

  set: (telegramId, key, value) => {
    const id = parseInt(telegramId, 10);
    if (!sessions.has(id)) {
      sessions.set(id, {});
    }
    const userSession = sessions.get(id);
    userSession[key] = value;
    sessions.set(id, userSession);
  },

  delete: (telegramId, key) => {
    const id = parseInt(telegramId, 10);
    if (sessions.has(id)) {
      const userSession = sessions.get(id);
      delete userSession[key];
      sessions.set(id, userSession);
    }
  },

  clear: (telegramId) => {
    const id = parseInt(telegramId, 10);
    sessions.delete(id);
  }
};
