WhatsApp to Telegram Media Bridge
 A Node.js script to forward media messages (images, videos, audio, documents) from a specific WhatsApp number to a Telegram user or group.

 ## Installation

 1. Clone the repository:
    ```bash
    git clone https://github.com/yourusername/whatsapp-telegram-media-bridge.git
    cd whatsapp-telegram-media-bridge
    ```

 2. Install dependencies:
    ```bash
    npm install
    ```

 3. Create a `.env` file based on `.env.example` and fill in your credentials:
    ```bash
    cp .env.example .env
    ```
    Edit `.env` to add your `TELEGRAM_BOT_TOKEN`, `TELEGRAM_USER_ID`, and `WHATSAPP_PHONE`.

 ## Usage

 1. Run the script:
    ```bash
    npm start
    ```

 2. Scan the QR code displayed in the terminal with your WhatsApp app to authenticate.

 3. The script will forward media messages from the specified WhatsApp number to the configured Telegram user or group.

 ## Environment Variables

 - `TELEGRAM_BOT_TOKEN`: Your Telegram bot token from BotFather.
 - `TELEGRAM_USER_ID`: The Telegram user or group ID to receive forwarded messages.
 - `WHATSAPP_PHONE`: The WhatsApp phone number to forward media from (e.g., `+989170000000`).

 ## Notes

 - Ensure the WhatsApp number is in the correct format (with country code, e.g., `+989170000000`).
 - Media files larger than 50MB will be rejected due to Telegram's free bot limitations.
 - Never commit the `.env` file to version control.

 ## License

 MIT
