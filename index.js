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

// Добавляем флаг disable_web_page_preview: true, чтобы кнопка была кликабельна
const menu = {
  reply_markup: {
    keyboard: [[{ text: 'Get GIF' }, { text: 'Get advice' }]],
    resize_keyboard: true,
    one_time_keyboard: false,
    disable_web_page_preview: true,
  },
};

// Создаем переменную isButtonDisabled
let isButtonDisabled = false;

// Создаем папку logs, если она не существует
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    "Hi! I'm a bot that searches your smartphone's memory and sends a random gif.' Click the 'Get Gif' button to get started.",
    menu
  );
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  // Добавляем проверку на значение флага isButtonDisabled
  if (msg.text === 'Get GIF' && !isButtonDisabled) {
    // Задаем значение флага isButtonDisabled в true на 5 секунд
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

    const randomGif =
      filteredGifs[Math.floor(Math.random() * filteredGifs.length)];

    bot.sendDocument(chatId, path.join(__dirname, 'gifs', randomGif), {
      contentType: 'image/gif',
    });

    sentGifs[chatId].push(gifs.indexOf(randomGif));

    // Записываем активность пользователя в файл activity.log
    const username = msg.from.username || 'Unknown username';
    const first_name = msg.from.first_name || 'Unknown first_name';
    const logMsg = `User ${username}/${first_name} requested a gif at ${new Date().toISOString()}\n`;
    fs.appendFile(path.join(logsDir, 'activity.log'), logMsg, (err) => {
      if (err) console.error(err);
    });
  } else if (msg.text === 'Get GIF' && isButtonDisabled) {
    // Если кнопка заблокирована, сообщаем пользователю об этом
    bot.sendMessage(
      chatId,
      `Please be patient and wait 5 sec before next request`,
      menu
    );
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
  }
});
