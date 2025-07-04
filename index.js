const fs = require("fs");
const path = require("path");
const { Client, LocalAuth } = require("whatsapp-web.js");
const { Dropbox } = require("dropbox");
const TelegramBot = require("node-telegram-bot-api");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
require("dotenv").config();

// =====================
// 🔐 Dropbox Config
// =====================
const dbx = new Dropbox({
  accessToken: process.env.DROPBOX_TOKEN,
  fetch,
});

// =====================
// 🗂 Session Path (Fixed to .wwebjs_auth)
// =====================
const SESSION_FILE_PATH = path.join(__dirname, ".wwebjs_auth", "default", "session.json");
const DROPBOX_FILE_PATH = "/wa-session.json";

// =====================
// ⬇️ Restore Session from Dropbox
// =====================
async function restoreSessionFromDropbox() {
  try {
    const res = await dbx.filesDownload({ path: DROPBOX_FILE_PATH });
    fs.mkdirSync(path.dirname(SESSION_FILE_PATH), { recursive: true });
    fs.writeFileSync(SESSION_FILE_PATH, res.result.fileBinary, "binary");
    console.log("✅ Session file restored from Dropbox");
  } catch (error) {
    console.log("ℹ️ No existing session found on Dropbox, scan QR");
  }
}

// =====================
// ⬆️ Save Session to Dropbox
// =====================
async function saveSessionToDropbox() {
  try {
    if (fs.existsSync(SESSION_FILE_PATH)) {
      const sessionData = fs.readFileSync(SESSION_FILE_PATH);
      await dbx.filesUpload({
        path: DROPBOX_FILE_PATH,
        contents: sessionData,
        mode: { ".tag": "overwrite" },
      });
      console.log("✅ Session file uploaded to Dropbox");
    } else {
      console.warn("⚠️ Session file not found to upload");
    }
  } catch (err) {
    console.error("❌ Failed to upload session to Dropbox:", err.message);
  }
}

// =====================
// 🚀 Main WhatsApp Client
// =====================
(async () => {
  await restoreSessionFromDropbox();

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: "default" }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--single-process'
      ],
    },
  });

  const telegramBot = new TelegramBot(process.env.TG_BOT_TOKEN, { polling: true });
  const WHATSAPP_CHAT_ID = process.env.WA_CHAT_ID; // like 1234567890@g.us

  client.on("qr", (qr) => {
    console.log("📸 Scan this QR code:");
    require("qrcode-terminal").generate(qr, { small: true });
  });

  client.on("ready", async () => {
    console.log("🤖 WhatsApp is ready!");
    await saveSessionToDropbox();
  });

  client.on("authenticated", async () => {
    console.log("🔐 Authenticated with WhatsApp");
    await saveSessionToDropbox();
  });

  client.on("auth_failure", (msg) => {
    console.error("❌ Authentication failure:", msg);
  });

  client.on("disconnected", (reason) => {
    console.warn("⚠️ Client was disconnected:", reason);
  });

  telegramBot.on("message", async (msg) => {
    const chatId = msg.chat.id;

    if (msg.text) {
      await client.sendMessage(WHATSAPP_CHAT_ID, msg.text);
      console.log("➡️ Forwarded text to WhatsApp:", msg.text);
    }

    if (msg.photo || msg.document || msg.video || msg.audio || msg.voice) {
      const fileId = msg.photo?.slice(-1)[0]?.file_id || msg.document?.file_id || msg.video?.file_id || msg.audio?.file_id || msg.voice?.file_id;
      const file = await telegramBot.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${process.env.TG_BOT_TOKEN}/${file.file_path}`;

      const mediaBuffer = await fetch(fileUrl).then(res => res.buffer());
      const fileName = path.basename(file.file_path);

      await client.sendMessage(WHATSAPP_CHAT_ID, mediaBuffer, { filename: fileName, caption: msg.caption || "" });
      console.log("➡️ Forwarded media to WhatsApp:", fileName);
    }
  });

  client.initialize();
})();
