import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();
const __dirname = path.resolve();
const token = process.env.TELEGRAM_TOKEN;

const bot = new TelegramBot(token, {polling: true});

const sentGifs = {};

const menu = {
  reply_markup: {
    keyboard: [
      [
        { text: 'Получить гиф' },
      ],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  },
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Привет! Я бот, который отправляет случайный gif из папки 'gifs'. Нажми кнопку 'Получить гиф', чтобы начать.", menu);
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  if (msg.text === 'Получить гиф') {
    if (!sentGifs[chatId]) {
      sentGifs[chatId] = [];
    }

    const gifs = fs.readdirSync(path.join(__dirname, 'gifs'));

    const filteredGifs = gifs.filter((gif, index) => !sentGifs[chatId].includes(index));

    if (filteredGifs.length === 0) {
      sentGifs[chatId] = [];
      return bot.sendMessage(chatId, 'Все gif уже были отправлены, начинаю сначала');
    }

    const randomGif = filteredGifs[Math.floor(Math.random() * filteredGifs.length)];

    bot.sendDocument(chatId, path.join(__dirname, 'gifs', randomGif));

    sentGifs[chatId].push(gifs.indexOf(randomGif));
  }
});