import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { handleMessage } from './handlers/messageHandler.js';
import { handleCallback } from './handlers/callbackHandler.js';

dotenv.config();
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  if ((authorized[chatId] = true)) return;
  else {
    bot.sendMessage(msg.chat.id, 'Добро пожаловать! Введи пароль.');
  }
});

bot.on('message', (msg) => handleMessage(bot, msg));
bot.on('callback_query', (query) => handleCallback(bot, query));
