require('dotenv').config(); // Load environment variables from .env file
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const token = process.env.BOT_TOKEN;
const webhookUrl = process.env.WEBHOOK_URL; // Base URL from Render
const targetChatId = process.env.TARGET_CHAT_ID;
const port = process.env.PORT || 3000; // Use Render's port or default to 3000
const imageDir = path.join(__dirname, 'img');
const webhookPath = `/webhook/${token}`; // Unique path for the webhook

if (!token || !webhookUrl || !targetChatId) {
    console.error("Error: BOT_TOKEN, WEBHOOK_URL, and TARGET_CHAT_ID must be set in environment variables.");
    process.exit(1);
}

// --- Initialize Bot (Webhook Mode) ---
const bot = new TelegramBot(token); // No polling: { polling: false } is default if no options object passed

// --- Initialize Express App ---
const app = express();
// Middleware to parse JSON request bodies (Telegram sends updates as JSON)
app.use(express.json());

// --- Webhook Endpoint ---
// Telegram will POST updates to this route
app.post(webhookPath, (req, res) => {
    try {
        bot.processUpdate(req.body); // Forward the update to the bot library
        res.sendStatus(200); // Acknowledge receipt to Telegram
    } catch (error) {
        console.error("Error processing webhook update:", error);
        res.sendStatus(500);
    }
});

// --- Basic root route (optional, for health check) ---
app.get('/', (req, res) => {
    res.send('Telegram Bot is running!');
});

// --- Bot Command Handlers ---

// /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    console.log(`Received /start from chat ID: ${chatId}`); // Log chat ID for debugging/setup
    bot.sendMessage(chatId, "Hello! I'm your friendly scheduler bot.");
});

// /kafa command
bot.onText(/\/kafa/, (msg) => {
    const chatId = msg.chat.id;
    // Placeholder reply - you can customize this
    const replies = [
        "vreme je za kafindžonku!",
        "kaficaaaaa",
        "je li bre oćeš li ti da skuvaš više tu kafu??",
        "kafa je uvek dobra ideja!",
        "kafa, kafa, kafa!",
    ];
    const randomReply = replies[Math.floor(Math.random() * replies.length)];
    bot.sendMessage(chatId, randomReply);

    // --- Optional: Send an image instead/as well ---
    /*
    try {
        const files = fs.readdirSync(imageDir).filter(file => /\.(jpe?g|png|gif)$/i.test(file)); // Basic image filter
        if (files.length > 0) {
            const randomImage = files[Math.floor(Math.random() * files.length)];
            const imagePath = path.join(imageDir, randomImage);
            bot.sendPhoto(chatId, imagePath, { caption: "Here's a random image!" })
               .catch(err => console.error("Error sending photo for /kafa:", err));
        } else {
            bot.sendMessage(chatId, "Hmm, I couldn't find any images for the /kafa command right now.");
        }
    } catch (error) {
        console.error("Error reading image directory for /kafa:", error);
        bot.sendMessage(chatId, "Sorry, something went wrong trying to find an image.");
    }
    */
});

// --- Scheduled Message Function ---
const sendScheduledImage = () => {
    console.log(`[${new Date().toISOString()}] Running scheduled task for chat ID: ${targetChatId}`);
    try {
        // Read images from the img directory
        const files = fs.readdirSync(imageDir).filter(file => /\.(jpe?g|png|gif)$/i.test(file)); // Basic image filter

        if (files.length === 0) {
            console.warn(`[Scheduler] No images found in ${imageDir}. Skipping scheduled message.`);
            // Optionally send a text message if no image found
            // bot.sendMessage(targetChatId, "Scheduled check: No images found today!");
            return;
        }

        // Select a random image
        const randomImage = files[Math.floor(Math.random() * files.length)];
        const imagePath = path.join(imageDir, randomImage);
        const caption = "Your scheduled image has arrived!"; // Customize caption

        console.log(`[Scheduler] Sending image ${randomImage} to ${targetChatId}`);

        // Send the photo
        bot.sendPhoto(targetChatId, imagePath, { caption: caption })
            .then(() => {
                console.log(`[Scheduler] Successfully sent ${randomImage} to ${targetChatId}`);
            })
            .catch((error) => {
                console.error(`[Scheduler] Error sending photo to ${targetChatId}:`, error.response ? error.response.body : error.message);
                 // Log more details if available
                 if (error.response && error.response.body) {
                     console.error(`[Scheduler] Telegram API Error Code: ${error.response.body.error_code}`);
                     console.error(`[Scheduler] Telegram API Description: ${error.response.body.description}`);
                 }
            });

    } catch (error) {
        console.error("[Scheduler] Error reading image directory or processing schedule:", error);
        // Optionally notify an admin or log centrally
        // bot.sendMessage(ADMIN_CHAT_ID, `Error in scheduler: ${error.message}`);
    }
};

// --- Cron Job Scheduling ---
// Example: Send a message every day at 9:00 AM server time
// Cron pattern: second minute hour day-of-month month day-of-week
// '0 9 * * *' means at 0 minutes past 9 AM, every day, every month, every day of the week.
// Use https://crontab.guru/ to build your schedule
const cronSchedule = '0 9 * * *'; // Default: 9 AM daily - CHANGE AS NEEDED
if (cron.validate(cronSchedule)) {
    cron.schedule(cronSchedule, sendScheduledImage, {
        scheduled: true,
        // Optional: Set timezone, e.g., 'Europe/Belgrade'
        // timezone: "Europe/Belgrade"
    });
    console.log(`Scheduled task configured with pattern: ${cronSchedule}`);
} else {
    console.error(`Invalid cron schedule pattern: ${cronSchedule}. Scheduler not started.`);
}


// --- Start Server and Set Webhook ---
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    // Construct the full webhook URL
    const fullWebhookUrl = `<span class="math-inline">\{webhookUrl\}</span>{webhookPath}`;
    console.log(`Setting webhook to: ${fullWebhookUrl}`);

    // Set the webhook; Telegram will send updates to your Render app URL
    bot.setWebHook(fullWebhookUrl)
        .then(success => {
            if (success) {
                console.log(`Webhook set successfully to ${fullWebhookUrl}`);
            } else {
                console.error('Webhook setting failed, but no error thrown.');
            }
        })
        .catch(err => {
            console.error('Error setting webhook:', err);
        });
});

// Optional: Graceful shutdown handling
process.on('SIGINT', () => {
    console.log("SIGINT received. Shutting down gracefully...");
    bot.deleteWebHook().then(() => { // Remove webhook before exiting
       console.log("Webhook removed.");
       process.exit(0);
    }).catch(err => {
       console.error("Error removing webhook:", err);
       process.exit(1);
    });
});
process.on('SIGTERM', () => {
    console.log("SIGTERM received. Shutting down gracefully...");
     bot.deleteWebHook().then(() => {
       console.log("Webhook removed.");
       process.exit(0);
    }).catch(err => {
       console.error("Error removing webhook:", err);
       process.exit(1);
    });
});