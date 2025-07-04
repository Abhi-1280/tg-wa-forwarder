// index.js
require('dotenv').config();
const { Telegraf } = require('telegraf');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

// ——— WhatsApp Setup ———
const waClient = new Client({
  authStrategy: new LocalAuth({ dataPath: 'session', clientId: 'forwarder' }),
  puppeteer: { headless: true }
});

waClient.on('qr', qr => {
  console.log('🔶 Scan this QR code:');
  qrcode.generate(qr, { small: true });
});

waClient.on('authenticated', () => {
  console.log('✅ WhatsApp authenticated');
});

waClient.on('ready', () => {
  console.log('✅ WhatsApp client ready');
});

waClient.on('auth_failure', msg => {
  console.error('❌ WhatsApp auth failure:', msg);
});

waClient.on('disconnected', reason => {
  console.log('⚠️ WhatsApp disconnected:', reason);
});

// initialize WhatsApp
waClient.initialize();


// ——— Telegram Setup ———
const tg = new Telegraf(process.env.TG_BOT_TOKEN);

tg.on('channel_post', async (ctx) => {
  const waChatId = process.env.WA_CHAT_ID;
  try {
    const msg = ctx.channelPost;

    // 1) Forward text
    if (msg.text) {
      await waClient.sendMessage(waChatId, msg.text);
    }

    // 2) Forward photo(s)
    if (msg.photo) {
      // take highest‑res photo
      const fileId = msg.photo[msg.photo.length - 1].file_id;
      const url = await ctx.telegram.getFileLink(fileId);
      const media = await MessageMedia.fromUrl(url.href);
      await waClient.sendMessage(waChatId, media, {
        caption: msg.caption || ''
      });
    }

    // 3) Forward document (includes video as document too)
    if (msg.document) {
      const url = await ctx.telegram.getFileLink(msg.document.file_id);
      const media = await MessageMedia.fromUrl(url.href, msg.document.file_name);
      await waClient.sendMessage(waChatId, media, {
        caption: msg.caption || ''
      });
    }

    // 4) Forward video
    if (msg.video) {
      const url = await ctx.telegram.getFileLink(msg.video.file_id);
      const media = await MessageMedia.fromUrl(url.href);
      await waClient.sendMessage(waChatId, media, {
        caption: msg.caption || ''
      });
    }

    // 5) Forward audio / voice
    if (msg.audio || msg.voice) {
      const fileId = msg.audio ? msg.audio.file_id : msg.voice.file_id;
      const url = await ctx.telegram.getFileLink(fileId);
      const media = await MessageMedia.fromUrl(url.href);
      await waClient.sendMessage(waChatId, media);
    }

    // 6) Forward sticker (as image)
    if (msg.sticker) {
      const url = await ctx.telegram.getFileLink(msg.sticker.file_id);
      const media = await MessageMedia.fromUrl(url.href);
      await waClient.sendMessage(waChatId, media);
    }

    console.log(`🔄 Forwarded TG→WA message ${msg.message_id}`);
  } catch (err) {
    console.error('❌ Error forwarding:', err);
  }
});

// start Telegram
tg.launch()
  .then(() => console.log('✅ Telegram bot started'))
  .catch(e => console.error('❌ Telegram launch failed', e));

// graceful shutdown
process.once('SIGINT', () => { tg.stop('SIGINT'); waClient.destroy(); });
process.once('SIGTERM', () => { tg.stop('SIGTERM'); waClient.destroy(); });
