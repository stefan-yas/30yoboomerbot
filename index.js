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
const kafaImageDir = path.join(__dirname, 'img', 'kafa'); // Path for /kafa images
const webhookPath = `/webhook/${token}`; // Unique path for the webhook
const timezone = "Europe/Belgrade"; // Set timezone
const saturdayImageFilename = "saturday.jpg"; // Specific image for Saturdays
const sundayImageFilename = "sunday.jpg";   // Specific image for Sundays

if (!token || !webhookUrl || !targetChatId) {
    console.error("Error: BOT_TOKEN, WEBHOOK_URL, and TARGET_CHAT_ID must be set in environment variables.");
    process.exit(1);
}

// --- Initialize Bot (Webhook Mode) ---
const bot = new TelegramBot(token);

// --- Initialize Express App ---
const app = express();
app.use(express.json());

// --- Webhook Endpoint ---
app.post(webhookPath, (req, res) => {
    try {
        bot.processUpdate(req.body);
        res.sendStatus(200);
    } catch (error) {
        console.error("Error processing webhook update:", error);
        res.sendStatus(500);
    }
});

// --- Basic root route ---
app.get('/', (req, res) => {
    res.send('Telegram Bot is running!');
});

// --- Bot Command Handlers ---
// /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    console.log(`Received /start from chat ID: ${chatId}`);
    bot.sendMessage(chatId, "Hello! I'm your friendly scheduler bot.");
});

// /kafa command - Now sends text AND a random image from img/kafa/
bot.onText(/\/kafa/, (msg) => {
    const chatId = msg.chat.id;

    // 1. Send textual reply
    const replies = [
        "vreme je za kafindžonku!",
        "kaficaaaaa",
        "je li bre oćeš li ti da skuvaš više tu kafu??",
        "kafa je uvek dobra ideja!",
        "kafa, kafa, kafa!",
    ];
    const randomReply = replies[Math.floor(Math.random() * replies.length)];
    bot.sendMessage(chatId, randomReply);

    // 2. Send random image from img/kafa/
    try {
        if (!fs.existsSync(kafaImageDir)) {
             console.warn(`[/kafa command] Kafa image directory not found: ${kafaImageDir}`);
             return; // Don't proceed if folder doesn't exist
        }

        const files = fs.readdirSync(kafaImageDir).filter(file => /\.(jpe?g|png|gif)$/i.test(file));

        if (files.length > 0) {
            const randomKafaImage = files[Math.floor(Math.random() * files.length)];
            const imagePath = path.join(kafaImageDir, randomKafaImage);
            console.log(`[/kafa command] Sending Kafa image ${randomKafaImage} to ${chatId}`);
            bot.sendPhoto(chatId, imagePath)
               .catch(err => console.error(`[/kafa command] Error sending photo to ${chatId}:`, err.response ? err.response.body : err.message));
        } else {
            console.warn(`[/kafa command] No images found in ${kafaImageDir}`);
        }
    } catch (error) {
        console.error("[/kafa command] Error reading Kafa image directory:", error);
        // Optionally send a message to the user, but might be noisy
        // bot.sendMessage(chatId, "Sorry, I had trouble finding a Kafa image right now.");
    }
});

// --- Scheduled Message Functions ---

// Function for sending a random image on weekdays
const sendRandomWeekdayImage = () => {
    const taskName = "[Weekday Scheduler]";
    console.log(`${taskName} [${new Date().toISOString()}] Running task for chat ID: ${targetChatId}`);
    try {
        const files = fs.readdirSync(imageDir).filter(file =>
            /\.(jpe?g|png|gif)$/i.test(file) &&
            file !== saturdayImageFilename && // Exclude specific weekend files
            file !== sundayImageFilename
        );

        if (files.length === 0) {
            console.warn(`${taskName} No suitable weekday images found in ${imageDir}. Skipping message.`);
            return;
        }

        const randomImage = files[Math.floor(Math.random() * files.length)];
        const imagePath = path.join(imageDir, randomImage);
        const caption = "Dobro jutro! Evo današnje slike."; // Weekday caption

        console.log(`${taskName} Sending random image ${randomImage} to ${targetChatId}`);
        bot.sendPhoto(targetChatId, imagePath, { caption: caption })
            .then(() => console.log(`${taskName} Successfully sent ${randomImage} to ${targetChatId}`))
            .catch((error) => logSendError(taskName, error, targetChatId));

    } catch (error) {
        console.error(`${taskName} Error reading image directory or processing schedule:`, error);
    }
};

// Function for sending the specific Saturday image
const sendSaturdayImage = () => {
    const taskName = "[Saturday Scheduler]";
    console.log(`${taskName} [${new Date().toISOString()}] Running task for chat ID: ${targetChatId}`);
    try {
        const imagePath = path.join(imageDir, saturdayImageFilename);

        if (!fs.existsSync(imagePath)) {
            console.error(`${taskName} Specific Saturday image not found: ${imagePath}. Skipping message.`);
            return;
        }

        const caption = "Dobro jutro! Uživajte u suboti!"; // Saturday caption

        console.log(`${taskName} Sending specific Saturday image ${saturdayImageFilename} to ${targetChatId}`);
        bot.sendPhoto(targetChatId, imagePath, { caption: caption })
            .then(() => console.log(`${taskName} Successfully sent ${saturdayImageFilename} to ${targetChatId}`))
            .catch((error) => logSendError(taskName, error, targetChatId));

    } catch (error) {
        console.error(`${taskName} Error processing Saturday schedule:`, error);
    }
};

// Function for sending the specific Sunday image
const sendSundayImage = () => {
    const taskName = "[Sunday Scheduler]";
    console.log(`${taskName} [${new Date().toISOString()}] Running task for chat ID: ${targetChatId}`);
    try {
        const imagePath = path.join(imageDir, sundayImageFilename);

        if (!fs.existsSync(imagePath)) {
            console.error(`${taskName} Specific Sunday image not found: ${imagePath}. Skipping message.`);
            return;
        }

        const caption = "Dobro jutro! Uživajte u nedelji!"; // Sunday caption

        console.log(`${taskName} Sending specific Sunday image ${sundayImageFilename} to ${targetChatId}`);
        bot.sendPhoto(targetChatId, imagePath, { caption: caption })
            .then(() => console.log(`${taskName} Successfully sent ${sundayImageFilename} to ${targetChatId}`))
            .catch((error) => logSendError(taskName, error, targetChatId));

    } catch (error) {
        console.error(`${taskName} Error processing Sunday schedule:`, error);
    }
};


// Helper function for logging send errors
const logSendError = (taskName, error, chatId) => {
    console.error(`${taskName} Error sending photo to ${chatId}:`, error.response ? error.response.body : error.message);
    if (error.response && error.response.body) {
        console.error(`${taskName} Telegram API Error Code: ${error.response.body.error_code}`);
        console.error(`${taskName} Telegram API Description: ${error.response.body.description}`);
    }
}


// --- Cron Job Scheduling ---

// Schedule 1: Weekdays (Monday-Friday) at 9:00 AM Belgrade time
const weekdayCron = '0 9 * * 1-5'; // 9:00 AM Monday to Friday
if (cron.validate(weekdayCron)) {
    cron.schedule(weekdayCron, sendRandomWeekdayImage, {
        scheduled: true,
        timezone: timezone
    });
    console.log(`Weekday task scheduled with pattern: ${weekdayCron} in timezone ${timezone}`);
} else {
    console.error(`Invalid weekday cron schedule pattern: ${weekdayCron}. Weekday scheduler not started.`);
}

// Schedule 2: Saturday at 9:00 AM Belgrade time
const saturdayCron = '0 9 * * 6'; // 9:00 AM Saturday
if (cron.validate(saturdayCron)) {
    cron.schedule(saturdayCron, sendSaturdayImage, {
        scheduled: true,
        timezone: timezone
    });
    console.log(`Saturday task scheduled with pattern: ${saturdayCron} in timezone ${timezone}`);
} else {
    console.error(`Invalid Saturday cron schedule pattern: ${saturdayCron}. Saturday scheduler not started.`);
}

// Schedule 3: Sunday at 9:00 AM Belgrade time
const sundayCron = '0 9 * * 0'; // 9:00 AM Sunday
if (cron.validate(sundayCron)) {
    cron.schedule(sundayCron, sendSundayImage, {
        scheduled: true,
        timezone: timezone
    });
    console.log(`Sunday task scheduled with pattern: ${sundayCron} in timezone ${timezone}`);
} else {
    console.error(`Invalid Sunday cron schedule pattern: ${sundayCron}. Sunday scheduler not started.`);
}


// --- Start Server and Set Webhook ---
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    const fullWebhookUrl = `${webhookUrl}${webhookPath}`;
    console.log(`Setting webhook to: ${fullWebhookUrl}`);

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
    cron.getTasks().forEach(task => task.stop()); // Stop cron tasks
    bot.deleteWebHook({ drop_pending_updates: true }) // Remove webhook, drop pending updates
       .then(() => {
           console.log("Webhook removed.");
           process.exit(0);
        }).catch(err => {
           console.error("Error removing webhook:", err);
           process.exit(1);
        });
});
process.on('SIGTERM', () => {
    console.log("SIGTERM received. Shutting down gracefully...");
    cron.getTasks().forEach(task => task.stop()); // Stop cron tasks
    bot.deleteWebHook({ drop_pending_updates: true })
       .then(() => {
           console.log("Webhook removed.");
           process.exit(0);
        }).catch(err => {
           console.error("Error removing webhook:", err);
           process.exit(1);
        });
});