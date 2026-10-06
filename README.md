# Cracker Bazaar Order Booking Website

A lightweight, mobile-friendly fireworks/crackers ordering website with a secure Google Sheets + Telegram Bot integration.

## Included
- Frontend storefront with product categories and live cart summary
- Delivery form and order validation
- Google Apps Script backend for secure order storage
- Telegram notifications with order details
- Order confirmation modal with bank/UPI details and WhatsApp payment button

## Local preview
From the project root:

```bash
cd /Users/jai/projects/crakers
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Backend setup (Google Apps Script)
1. Open Google Sheets.
2. Create or open a sheet.
3. Go to Extensions -> Apps Script.
4. Copy the contents of `Code.gs` into the script editor.
5. Add these script properties:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `ORDER_SECRET_KEY`
6. Deploy as a Web App with:
   - Execute as: Me
   - Who has access: Anyone
7. Use the Web App URL in `index.html` by replacing `PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE`.
8. Do not expose the sheet URL, Telegram token, or chat ID in browser code.

## Frontend configuration
In `index.html`, set the following values:

```js
const APP_SCRIPT_URL = "https://script.google.com/macros/s/.../exec";
const ORDER_SECRET = "your-secret-here";
```

For stronger security, prefer a backend proxy route that injects the secret server-side instead of exposing it in public browser code.

## Telegram setup
1. Message `@BotFather` on Telegram.
2. Create a bot with `/newbot`.
3. Copy the token.
4. Add the bot to a group or channel.
5. Use `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates` to find the `chat.id`.

## Notes
- The Google Sheet must be attached to the Apps Script project.
- The script writes into the active sheet.
- The script does not expose secrets to the client browser.
