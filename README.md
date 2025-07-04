# Telegram→WhatsApp Forwarder

## Setup

1. Extract this zip:
   ```bash
   unzip tg-wa-forwarder.zip
   cd tg-wa-forwarder
   ```

2. Install dependencies (requires npm ≥6):
   ```bash
   npm install
   ```

3. Create a `.env` file in the project root:
   ```
   TG_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
   WA_CHAT_ID=YOUR_WHATSAPP_CHAT_ID
   ```

4. Test locally:
   ```bash
   node index.js
   ```
   - Scan the WhatsApp QR code that appears in console.

5. Build Docker image:
   ```bash
   docker build -t tg-wa-forwarder .
   docker run -it \
     -e TG_BOT_TOKEN=$TG_BOT_TOKEN \
     -e WA_CHAT_ID=$WA_CHAT_ID \
     -v $(pwd)/session:/app/session \
     tg-wa-forwarder
   ```

6. Deploy to Fly.io:
   ```bash
   fly auth login
   fly launch     # when prompted, choose 'No' for immediate deploy
   fly volumes create wa-session --size 1
   fly secrets set TG_BOT_TOKEN=... WA_CHAT_ID=...
   fly deploy
   fly logs --follow
   ```
   - When you see the WhatsApp QR prompt in logs, open the URL and scan with your phone.

Enjoy your 24/7 Telegram→WhatsApp forwarder!