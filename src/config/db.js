import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';
import { config } from './config.js';
import { User } from '../models/User.js';
import { Settings } from '../models/Settings.js';
import { Transaction } from '../models/Transaction.js';

let isMongoConnected = false;

export async function connectDB() {
  if (isMongoConnected) return true;

  if (!config.mongodbUri) {
    logger.warn('CRITICAL: MONGODB_URI is not set! Bot cannot run without MongoDB.');
    return false;
  }

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 5000,
    });
    isMongoConnected = true;
    logger.info('MongoDB connected successfully!');
    
    // Seed default settings if empty
    await seedSettings();
    return true;
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    return false;
  }
}

async function seedSettings() {
  try {
    const existing = await Settings.findOne({ key: 'global' });
    if (!existing) {
      const defaultSettings = new Settings({
        key: 'global',
        payment: {
          autogopay: {
            apiKey: "",
            qrisString: "",
            webhook: "/api/webhooks/gopay",
            enabled: false
          }
        },
        prices: {
          pterodactyl: config.defaults.pricePterodactyl || 2000,
          mysql: config.defaults.priceMysql || 2000
        },
        bot: {
          maintenance: false,
          maintenanceMessage: "Bot sedang dalam perawatan / maintenance.",
          forceJoin: [],
          contact: "",
          channel: "",
          storeName: "AutoInstaller Bot"
        }
      });
      await defaultSettings.save();
      logger.info('Seeded default settings in MongoDB.');
    }
  } catch (err) {
    logger.error('Failed to seed settings in MongoDB', err);
  }
}

export const db = {
  isMongo: () => isMongoConnected,

  // --- USER OPERATIONS ---
  getUser: async (telegramId) => {
    const id = parseInt(telegramId, 10);
    let user = await User.findOne({ telegramId: id });
    if (!user) {
      const role = id === config.adminId ? 'admin' : 'user';
      user = new User({ telegramId: id, role });
      await user.save();
    }
    return user.toObject();
  },

  updateUser: async (telegramId, updateData) => {
    const id = parseInt(telegramId, 10);
    if (id === config.adminId) {
      updateData.role = 'admin';
    }
    const user = await User.findOneAndUpdate(
      { telegramId: id },
      { $set: updateData },
      { returnDocument: 'after', upsert: true }
    );
    return user.toObject();
  },

  getAllUsers: async () => {
    const users = await User.find({});
    return users.map(u => u.toObject());
  },

  // --- SETTINGS OPERATIONS ---
  getSettings: async () => {
    if (!isMongoConnected) {
      logger.warn('[DB] MongoDB is not connected. Returning default fallback settings.');
      return {
        key: 'global',
        payment: {
          autogopay: {
            apiKey: "",
            qrisString: "",
            webhook: "/webhook/autogopay",
            enabled: false
          }
        },
        prices: {
          pterodactyl: 2000,
          mysql: 2000
        },
        bot: {
          maintenance: false,
          maintenanceMessage: "Bot sedang dalam perawatan / maintenance.",
          forceJoin: [],
          contact: "",
          channel: "",
          storeName: "AutoInstaller Bot"
        }
      };
    }
    let settings = await Settings.findOne({ key: 'global' });
    if (!settings) {
      settings = new Settings({
        key: 'global',
        payment: {
          autogopay: {
            apiKey: "",
            qrisString: "",
            webhook: "/api/webhooks/gopay",
            enabled: false
          }
        },
        prices: {
          pterodactyl: 2000,
          mysql: 2000
        },
        bot: {
          maintenance: false,
          maintenanceMessage: "Bot sedang dalam perawatan / maintenance.",
          forceJoin: [],
          contact: "",
          channel: "",
          storeName: "AutoInstaller Bot"
        }
      });
      await settings.save();
    }
    return settings.toObject();
  },

  updateSettings: async (updateData) => {
    const settings = await Settings.findOneAndUpdate(
      { key: 'global' },
      { $set: updateData },
      { returnDocument: 'after', upsert: true }
    );
    return settings.toObject();
  },

  // --- TRANSACTION OPERATIONS ---
  getTransaction: async (txId) => {
    const tx = await Transaction.findOne({ txId });
    return tx ? tx.toObject() : null;
  },

  createTransaction: async (txData) => {
    const tx = new Transaction(txData);
    await tx.save();
    return tx.toObject();
  },

  updateTransaction: async (txId, updateData) => {
    const tx = await Transaction.findOneAndUpdate(
      { txId },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    return tx ? tx.toObject() : null;
  },

  getTransactionsByUserId: async (telegramId) => {
    const id = parseInt(telegramId, 10);
    const txs = await Transaction.find({ telegramId: id }).sort({ createdAt: -1 });
    return txs.map(t => t.toObject());
  },

  getAllTransactions: async () => {
    const txs = await Transaction.find({}).sort({ createdAt: -1 });
    return txs.map(t => t.toObject());
  }
};
