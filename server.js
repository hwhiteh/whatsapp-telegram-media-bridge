const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// ===== CONFIGURATION & CONSTANTS =====
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_USER_ID = process.env.TELEGRAM_USER_ID;
const WHATSAPP_PHONE = process.env.WHATSAPP_PHONE || '+98XXXXXXXXXX'; // Placeholder phone number
const MAX_FILE_SIZE_MB = 50; // Telegram limit for free bots
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// Validate required environment variables
if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_USER_ID) {
  console.error('❌ TELEGRAM_BOT_TOKEN and TELEGRAM_USER_ID are required in .env');
  process.exit(1);
}

// Initialize Telegram bot (no polling needed)
const telegramBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });

// WhatsApp client with local authentication
const whatsappClient = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { headless: true }
});

// ===== TYPES & INTERFACES =====
const SUPPORTED_MEDIA_TYPES = ['image', 'video', 'audio', 'document', 'sticker'];

// ===== UTILITY FUNCTIONS =====
// Sanitize filename to avoid Telegram errors
function sanitizeFileName(filename) {
  if (!filename) return `media_${Date.now()}.bin`;
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Remove special characters
    .substring(0, 64); // Limit length
}

// Get appropriate Telegram send method based on media type
function getTelegramSendMethod(type) {
  switch (type) {
    case 'image': return 'sendPhoto';
    case 'video': return 'sendVideo';
    case 'audio': return 'sendAudio';
    default: return 'sendDocument';
  }
}

// Estimate file size from base64 data (approximate, assumes padding)
function estimateFileSize(base64Data) {
  const base64Length = base64Data.length;
  return Math.round((base64Length * 3) / 4 / 1024 / 1024); // Size in MB
}

// Retry wrapper for Telegram API calls
async function withRetry(operation, attempts = RETRY_ATTEMPTS) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === attempts - 1) throw error;
      console.warn(`⚠️ Retry ${i + 1}/${attempts} due to error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

// Send media to Telegram with type-specific method
async function sendMediaToTelegram(mediaBuffer, mimeType, fileName, caption, mediaType) {
  const sendMethod = getTelegramSendMethod(mediaType);
  console.log(`📤 Sending ${mediaType} to Telegram (filename: ${fileName}, size: ${estimateFileSize(mediaBuffer)}MB)`);

  await withRetry(async () => {
    await telegramBot[sendMethod](TELEGRAM_USER_ID, Buffer.from(mediaBuffer, 'base64'), {
      caption: caption.substring(0, 200), // Limit caption to 200 characters
      contentType: mimeType,
      filename: fileName
    });
  });
  console.log('✅ Media sent to Telegram successfully');
}

// Generate caption with sender and timestamp
function generateCaption(from, timestamp) {
  const date = new Date(timestamp * 1000).toLocaleString('en-US');
  return `Media from WhatsApp:\nFrom: ${from}\nTime: ${date}`.substring(0, 200);
}

// ===== CORE BUSINESS LOGIC =====
whatsappClient.on('message', async (msg) => {
  // Normalize WHATSAPP_PHONE by removing '+' for comparison
  const normalizedWhatsAppPhone = WHATSAPP_PHONE.replace('+', '');
  // Only process messages from the specified phone number
  if (msg.from !== `${normalizedWhatsAppPhone}@c.us`) {
    console.log(`⏩ Skipping message from ${msg.from}: Not from ${WHATSAPP_PHONE}`);
    return;
  }

  if (SUPPORTED_MEDIA_TYPES.includes(msg.type)) {
    console.log(`📥 Incoming media from ${msg.from}: ${msg.type}`);

    try {
      // Download media
      const media = await msg.downloadMedia();
      if (!media) {
        console.error('❌ Failed to download media');
        msg.reply('❌ Error downloading media.');
        return;
      }

      // Check file size
      const fileSizeMB = estimateFileSize(media.data);
      if (fileSizeMB > MAX_FILE_SIZE_MB) {
        console.error(`❌ File too large: ${fileSizeMB}MB exceeds ${MAX_FILE_SIZE_MB}MB`);
        msg.reply(`❌ File is too large (${fileSizeMB}MB). Maximum allowed is ${MAX_FILE_SIZE_MB}MB.`);
        return;
      }

      // Sanitize filename and generate caption
      const sanitizedFileName = sanitizeFileName(media.filename);
      const caption = generateCaption(msg.from, msg.t);

      // Send to Telegram
      await sendMediaToTelegram(
        media.data,
        media.mimetype,
        sanitizedFileName,
        caption,
        msg.type
      );

      // Acknowledge in WhatsApp
      msg.reply('✅ Media received and sent to Telegram.');
    } catch (error) {
      console.error(`❌ Error processing media: ${error.message}`, {
        type: msg.type,
        from: msg.from,
        errorStack: error.stack
      });
      msg.reply('❌ Error processing media.');
    }
  }
});

// WhatsApp QR code handler
whatsappClient.on('qr', (qr) => {
  console.log('📱 Scan this QR code with your WhatsApp app:');
  qrcode.generate(qr, { small: true });
});

// WhatsApp ready handler
whatsappClient.on('ready', () => {
  console.log(`✅ WhatsApp client ready for phone: ${WHATSAPP_PHONE}`);
  console.log('🔄 Listening for incoming media...');
});

// WhatsApp auth failure handler
whatsappClient.on('auth_failure', (msg) => {
  console.error('❌ WhatsApp authentication failed:', msg);
});

// WhatsApp disconnection handler
whatsappClient.on('disconnected', (reason) => {
  console.log('🔌 WhatsApp disconnected:', reason);
  setTimeout(() => {
    console.log('🔄 Restarting WhatsApp client...');
    whatsappClient.initialize();
  }, 5000);
});

// ===== INITIALIZATION & STARTUP =====
whatsappClient.initialize().catch((error) => {
  console.error('❌ Failed to initialize WhatsApp client:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  whatsappClient.destroy();
  telegramBot.close();
  process.exit(0);
});

console.log(`🚀 Bridge started: WhatsApp -> Telegram (User ID: ${TELEGRAM_USER_ID})`);