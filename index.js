import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();
const __dirname = path.resolve();
const token = process.env.TELEGRAM_TOKEN;
const adviceUrl = 'http://fucking-great-advice.ru/api/random';
const bot = new TelegramBot(token, { polling: true });

const sentGifs = {};
const sentVideos = {}; // Храним информацию об отправленных видео

const menu = {
  reply_markup: {
    keyboard: [
      [{ text: 'Get GIF' }, { text: 'Get advice' }],
      [{ text: 'Get Video' }, { text: 'Get Logs' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
    disable_web_page_preview: true,
  },
};

let isButtonDisabled = false;

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    "Hi! I'm a bot that can send random GIFs, videos, and great advice!",
    menu
  );
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  if (msg.text === 'Get GIF' && !isButtonDisabled) {
    isButtonDisabled = true;
    setTimeout(() => {
      isButtonDisabled = false;
    }, 5000);

    if (!sentGifs[chatId]) {
      sentGifs[chatId] = [];
    }

    const gifs = fs.readdirSync(path.join(__dirname, 'gifs'));
    const filteredGifs = gifs.filter(
      (gif, index) => !sentGifs[chatId].includes(index)
    );

    if (filteredGifs.length === 0) {
      sentGifs[chatId] = [];
      return bot.sendMessage(
        chatId,
        'You got all GIFs, now begin from start',
        menu
      );
    }

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    for (let i = 0; i < 5; i++) {
      const randomGif =
        filteredGifs[Math.floor(Math.random() * filteredGifs.length)];

      await delay(2000);
      await bot.sendDocument(chatId, path.join(__dirname, 'gifs', randomGif), {
        contentType: 'image/gif',
      });

      sentGifs[chatId].push(gifs.indexOf(randomGif));
    }

    const username = msg.from.username || 'Unknown username';
    const first_name = msg.from.first_name || 'Unknown first_name';
    const logMsg = `User ${username}/${first_name} requested a gif at ${new Date().toISOString()}
`;
    fs.appendFile(path.join(logsDir, 'activity.log'), logMsg, (err) => {
      if (err) console.error(err);
    });
  } else if (msg.text === 'Get Video') {
    if (!sentVideos[chatId]) {
      sentVideos[chatId] = [];
    }

    const videos = fs.readdirSync(path.join(__dirname, 'videos'));
    const filteredVideos = videos.filter(
      (video, index) => !sentVideos[chatId].includes(index)
    );

    if (filteredVideos.length === 0) {
      sentVideos[chatId] = [];
      return bot.sendMessage(
        chatId,
        'You got all videos, now begin from start',
        menu
      );
    }

    const randomVideo =
      filteredVideos[Math.floor(Math.random() * filteredVideos.length)];
    await bot.sendVideo(chatId, path.join(__dirname, 'videos', randomVideo), {
      caption: '',
    });

    sentVideos[chatId].push(videos.indexOf(randomVideo));

    const username = msg.from.username || 'Unknown username';
    const first_name = msg.from.first_name || 'Unknown first_name';
    const logMsg = `User ${username}/${first_name} requested a video at ${new Date().toISOString()}
`;
    fs.appendFile(path.join(logsDir, 'activity.log'), logMsg, (err) => {
      if (err) console.error(err);
    });
  } else if (msg.text === 'Get Logs') {
    const logPath = path.join(logsDir, 'activity.log');

    if (!fs.existsSync(logPath)) {
      return bot.sendMessage(chatId, 'No logs available yet.', menu);
    }

    const logs = fs.readFileSync(logPath, 'utf-8').split('\n').filter(Boolean);
    const lastLogs = logs.slice(-10).join('\n') || 'No recent activity.';

    bot.sendMessage(chatId, `Last 10 log entries:\n\n${lastLogs}`, menu);
  } else if (msg.text === 'Get advice') {
    await axios
      .get(adviceUrl)
      .then((response) => {
        const advice = response.data.text;
        bot.sendMessage(chatId, advice);
      })
      .catch((error) => {
        console.error(error);
        bot.sendMessage(chatId, 'Advices are not available right now');
      });
  } else if (msg.text === 'Get GIF' && isButtonDisabled) {
    bot.sendMessage(
      chatId,
      `Please be patient and wait 5 sec before next request`,
      menu
    );
  }
});
