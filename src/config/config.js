import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  telegramToken: process.env.BOT_TOKEN || '',
  adminId: parseInt(process.env.ADMIN_ID || '0', 10),
  mongodbUri: process.env.MONGODB_URI || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  
  defaults: {
    pricePterodactyl: 2000, // IDR
    priceMysql: 2000,       // IDR
    autoGoPayWebhook: '/api/webhooks/gopay'
  }
};
