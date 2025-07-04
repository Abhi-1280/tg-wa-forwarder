const fs = require("fs");
const path = require("path");
const { Client, LocalAuth } = require("whatsapp-web.js");
const { Dropbox } = require("dropbox");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require("dotenv").config();

// Setup Dropbox
const dbx = new Dropbox({
  accessToken: process.env.DROPBOX_TOKEN,
  fetch
});

const SESSION_FILE_PATH = path.join(__dirname, "session", "Default", "session.json");
const DROPBOX_FILE_PATH = "/wa-session.json";

// Step 1: Download session from Dropbox before starting client
async function restoreSessionFromDropbox() {
  try {
    const res = await dbx.filesDownload({ path: DROPBOX_FILE_PATH });
    fs.mkdirSync(path.dirname(SESSION_FILE_PATH), { recursive: true });
    fs.writeFileSync(SESSION_FILE_PATH, res.result.fileBinary, 'binary');
    console.log("✅ Session file restored from Dropbox");
  } catch (error) {
    console.log("ℹ️ No existing session found on Dropbox, scan QR");
  }
}

// Step 2: After client is ready, upload session back to Dropbox
async function saveSessionToDropbox() {
  try {
    const sessionData = fs.readFileSync(SESSION_FILE_PATH);
    await dbx.filesUpload({
      path: DROPBOX_FILE_PATH,
      contents: sessionData,
      mode: { '.tag': 'overwrite' }
    });
    console.log("✅ Session file uploaded to Dropbox");
  } catch (err) {
    console.error("❌ Failed to upload session to Dropbox:", err.message);
  }
}

(async () => {
  await restoreSessionFromDropbox();

  const client = new Client({
    authStrategy: new LocalAuth()
  });

  client.on("qr", (qr) => {
    console.log("📸 Scan this QR code:");
    require("qrcode-terminal").generate(qr, { small: true });
  });

  client.on("ready", async () => {
    console.log("🤖 WhatsApp is ready!");
    await saveSessionToDropbox(); // Save session when ready
  });

  client.on("authenticated", async () => {
    console.log("🔐 Authenticated with WhatsApp");
    await saveSessionToDropbox();
  });

  client.initialize();
})();
