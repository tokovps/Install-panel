import express from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { db } from '../config/db.js';
import { AutoGoPayService } from '../services/autogopay.js';

const router = express.Router();

// --- API ROUTE: Health Check ---
router.get('/api/health', async (req, res) => {
  try {
    const { getBotStatus } = await import('../index.js');
    const status = getBotStatus();
    res.json(status);
  } catch (err) {
    logger.error('Failed to retrieve health status', err);
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// --- API ROUTE: AutoGoPay Webhook ---
router.post('/api/webhooks/gopay', async (req, res) => {
  // Comprehensive detailed log of incoming webhook headers and body
  logger.info('[WEBHOOK MASUK] AutoGoPay Webhook Triggered');
  logger.info(`[WEBHOOK MASUK] Headers: ${JSON.stringify(req.headers, null, 2)}`);
  logger.info(`[WEBHOOK MASUK] Parsed Body: ${JSON.stringify(req.body, null, 2)}`);
  logger.info(`[WEBHOOK MASUK] Raw Body Length: ${req.rawBody ? req.rawBody.length : 0} bytes`);

  try {
    const settings = await db.getSettings();
    const gopay = settings.payment?.autogopay || {};

    // Retrieve signature safely (case-insensitive check)
    const signature = req.headers['x-signature'] || req.headers['X-Signature'] || req.headers['x-signature-hex'] || req.headers['x-gopay-signature'];
    
    // Check if live API Key check is active and required
    if (gopay.apiKey && typeof gopay.apiKey === 'string' && gopay.apiKey.trim() !== '' && gopay.apiKey !== 'gopay_test_key_123' && gopay.enabled) {
      if (!signature) {
        logger.warn('[WEBHOOK MASUK] Rejected: Missing X-Signature header.');
        return res.status(401).json({ 
          success: false, 
          error: 'Unauthorized: Missing X-Signature header' 
        });
      }

      const cleanSignature = String(signature).trim().toLowerCase();

      // 1. Calculate signature based on Raw Body buffer if available
      let rawBodyStr = '';
      if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
        rawBodyStr = req.rawBody.toString('utf8');
      } else {
        rawBodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      }

      const hmacRaw = crypto.createHmac('sha256', gopay.apiKey);
      const calculatedSignatureRaw = hmacRaw.update(rawBodyStr).digest('hex').toLowerCase();

      // 2. Fallback check: Calculate signature on parsed JSON stringified body
      const hmacJson = crypto.createHmac('sha256', gopay.apiKey);
      const calculatedSignatureJson = hmacJson.update(JSON.stringify(req.body || {})).digest('hex').toLowerCase();

      logger.info(`[WEBHOOK MASUK] Header Signature: "${cleanSignature}"`);
      logger.info(`[WEBHOOK MASUK] Calculated rawBody Signature: "${calculatedSignatureRaw}"`);
      logger.info(`[WEBHOOK MASUK] Calculated JSON Signature: "${calculatedSignatureJson}"`);

      const isValidSignature = (cleanSignature === calculatedSignatureRaw) || (cleanSignature === calculatedSignatureJson);

      if (!isValidSignature) {
        logger.warn('[WEBHOOK MASUK] Rejected: Signature verification failed.');
        return res.status(401).json({ 
          success: false, 
          error: 'Unauthorized: Invalid X-Signature verification' 
        });
      }
      logger.info('[WEBHOOK MASUK] Signature validated successfully.');
    } else {
      logger.info('[WEBHOOK MASUK] Bypassing signature validation (Running in test mode or API Key not configured / enabled).');
    }

    // Safety fallback for empty request body
    const requestBody = req.body || {};

    // Process webhook logic
    const result = await AutoGoPayService.processWebhook(requestBody);
    
    logger.info('[WEBHOOK MASUK] Webhook processed successfully. Result:', result);
    return res.status(200).json(result);

  } catch (err) {
    // Log the entire error stack as requested
    logger.error('[WEBHOOK MASUK] CRITICAL ERROR / EXCEPTION caught in route try-catch:', err);
    if (err.stack) {
      logger.error(`[WEBHOOK MASUK] Error Stack: ${err.stack}`);
    }

    // Never return 500 to third parties unless truly an unrecoverable server failure.
    // Instead return a successful error payload or a client error depending on nature.
    return res.status(200).json({ 
      success: false, 
      error: 'Exception occurred but gracefully handled', 
      message: err.message 
    });
  }
});

export default router;
