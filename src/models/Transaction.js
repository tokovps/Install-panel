import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
  txId: { type: String, required: true, unique: true, index: true },
  telegramId: { type: Number, required: true, index: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['topup', 'purchase'], required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed', 'PAID'], default: 'pending' },
  description: { type: String, default: '' },
  qrUrl: { type: String, default: '' },
  transaction_id: { type: String, default: '' },
  order_id: { type: String, default: '' },
  transaction_status: { type: String, default: '' },
  expiry_time: { type: Date, default: null },
  checkout_url: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

TransactionSchema.pre('save', async function() {
  this.updatedAt = new Date();
});

export const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);
