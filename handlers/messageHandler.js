import fs from 'fs';
import axios from 'axios';
import path from 'path';
import { CONFIG } from '../config.js';
import { sendVideoPreviews } from '../utils/preview.js';
import { shuffleArray } from '../utils/helpers.js';
import { logActivity } from '../utils/logger.js';

const authorized = {};
const logAuthorized = {};
const sentGifs = {};

const menu = {
  reply_markup: {
    keyboard: [
      [{ text: 'gif' }, { text: 'advice' }],
      [{ text: 'video' }, { text: 'preview' }],
    ],
    resize_keyboard: true,
  },
};

let isGifCooldown = false;

export async function handleMessage(bot, msg) {
  const { chat, text, from } = msg;
  const chatId = chat.id;
  const username = from.username || 'user';
  const name = from.first_name || 'anon';

  if (!authorized[chatId]) {
    if ((text || '').trim().toLowerCase() === CONFIG.PASSWORD.toLowerCase()) {
      authorized[chatId] = true;
      return bot.sendMessage(chatId, '✅ Авторизация успешна!', menu);
    } else {
      return bot.sendMessage(chatId, '🚫 Неверный пароль!');
    }
  }

  if (msg.video) {
    return handleVideoUpload(bot, msg);
  }

  if (text?.startsWith('show ')) {
    const query = text.slice(6).toLowerCase().trim();
    return sendVideoPreviews(bot, chatId, (name) =>
      name.toLowerCase().includes(query), 1
    );
  }

  switch (text) {
    case 'logs':
      if (!logAuthorized[chatId]) {
        return bot.sendMessage(chatId, 'Для логов нужен пароль:');
      }
      return sendLogs(bot, chatId);

    case CONFIG.LOG_PASSWORD:
      logAuthorized[chatId] = true;
      return bot.sendMessage(chatId, '✅ Логи теперь доступны.', menu);

    case 'gif':
      if (isGifCooldown) return bot.sendMessage(chatId, '⏳ Подожди немного.');
      isGifCooldown = true;
      setTimeout(() => (isGifCooldown = false), 5000);
      return sendGifs(bot, chatId, username, name);

    case 'video':
			await sendVideoPreviews(bot, msg, () => true, 1);
      
      return;
    case 'preview':
      await sendVideoPreviews(bot, msg, () => true, 5);
      
      return;

    case 'advice':
      try {
        const { data } = await axios.get(
          'https://fucking-great-advice.ru/api/random'
        );
        return bot.sendMessage(chatId, data.text);
      } catch (e) {
        return bot.sendMessage(chatId, '💩 Советы не работают.');
      }

    default:
      break;
  }
}

async function handleVideoUpload(bot, msg) {
  const { video, chat } = msg;
  const file = await bot.getFile(video.file_id);
  const fileUrl = `https://api.telegram.org/file/bot${CONFIG.TOKEN}/${file.file_path}`;
  const fileName = file.file_path.split('/').pop();
  const savePath = `${CONFIG.PATHS.VIDEOS}/${fileName}`;

  const { headers } = await axios.head(fileUrl);
  if (+headers['content-length'] > CONFIG.MAX_VIDEO_SIZE) {
    return bot.sendMessage(chat.id, `Файл большой, бери ссылку: ${fileUrl}`);
  }

  const res = await axios.get(fileUrl, { responseType: 'stream' });
  const writer = fs.createWriteStream(savePath);
  res.data.pipe(writer);

  writer.on('finish', () => {
    bot.sendMessage(
      chat.id,
      `🎉 Сохранил как: \`video ${fileName.split('.')[0]}\``,
      { parse_mode: 'MarkdownV2' }
    );
  });

  writer.on('error', (err) => {
    bot.sendMessage(chat.id, `Ошибка при сохранении: ${err.message}`);
  });
}

function sendLogs(bot, chatId) {
  if (!fs.existsSync(CONFIG.PATHS.LOGS))
    return bot.sendMessage(chatId, 'Пока пусто.');
  const logs = fs
    .readFileSync(CONFIG.PATHS.LOGS, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .slice(-10)
    .join('\n');
  bot.sendMessage(chatId, `*Последние действия:*\n\n${logs}`, {
    parse_mode: 'Markdown',
  });
}

async function sendGifs(bot, chatId, username, name) {
  if (!sentGifs[chatId]) sentGifs[chatId] = new Set();

  const allFiles = fs.readdirSync(CONFIG.PATHS.GIFS);
  const gifs = allFiles.filter((file) => file.toLowerCase().endsWith('.gif'));

  if (!gifs.length) {
    return bot.sendMessage(chatId, '📂 В папке `gifs` вообще нет GIF-файлов.');
  }

  const unseen = gifs.filter((gif) => !sentGifs[chatId].has(gif));

  if (unseen.length === 0) {
    sentGifs[chatId].clear();
    return bot.sendMessage(
      chatId,
      '🌀 Всё уже показано. Обнулил, начинай заново.',
      menu
    );
  }

  const selected = shuffleArray(unseen).slice(0, 5);
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  for (const gif of selected) {
		const fullPath = path.join(CONFIG.PATHS.GIFS, gif);

    try {
      await delay(2000);
      if (!fs.existsSync(fullPath)) {
        console.warn(`Файл не найден: ${fullPath}`);
        continue;
      }

      await bot.sendDocument(chatId, fullPath, {
        contentType: 'image/gif',
      });

      sentGifs[chatId].add(gif);
    } catch (err) {
      console.error(`Ошибка при отправке гифки ${gif}:`, err.message);
      await bot.sendMessage(chatId, `❌ Не удалось отправить гифку: ${gif}`);
    }
  }

  logActivity(`${username}/${name} запросил gif ${new Date().toISOString()}`);
}
