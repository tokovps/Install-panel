import mongoose from 'mongoose';

const SettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'global' },
  payment: {
    autogopay: {
      apiKey: { type: String, default: "" },
      qrisString: { type: String, default: "" },
      webhook: { type: String, default: "/api/webhooks/gopay" },
      enabled: { type: Boolean, default: false }
    }
  },
  prices: {
    pterodactyl: { type: Number, default: 2000 },
    mysql: { type: Number, default: 2000 }
  },
  bot: {
    maintenance: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: "" },
    forceJoin: { type: [String], default: [] },
    contact: { type: String, default: "" },
    channel: { type: String, default: "" },
    storeName: { type: String, default: "Bot AutoInstaller" }
  },
  updatedAt: { type: Date, default: Date.now }
});

SettingsSchema.pre('save', async function() {
  this.updatedAt = new Date();
});

export const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);
