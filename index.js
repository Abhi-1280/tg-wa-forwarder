const fs = require("fs");
const path = require("path");
const { Client, LocalAuth } = require("whatsapp-web.js");
const { Dropbox } = require("dropbox");
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
// 🗂 Correct Session Path (.wwebjs_auth/default/session.json)
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
    authStrategy: new LocalAuth({ clientId: "default" }), // ensure session directory is correct
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
        "--single-process"
      ],
    },
  });

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

  client.initialize();
})();
