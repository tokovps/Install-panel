import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true, index: true },
  username: { type: String, default: '' },
  balance: { type: Number, default: 0 },
  anchorMessageId: { type: Number, default: null },
  anchorChatId: { type: Number, default: null },
  currentPage: { type: String, default: 'home' },
  navigationHistory: { type: [String], default: [] },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isInstalling: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

UserSchema.pre('save', async function() {
  this.updatedAt = new Date();
});

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
