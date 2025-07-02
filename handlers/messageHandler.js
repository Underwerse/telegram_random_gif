import fs from 'fs';
import axios from 'axios';
import path from 'path';
import { CONFIG } from '../config.js';
import {
  sendVideoPreviews,
  sentPreviews,
  videoIdMap,
} from '../utils/preview.js';
import {
  escapeMarkdown,
  formatDuration,
  formatSize,
  generateThumbnail,
  getVideoDuration,
  getVideoSize,
  shuffleArray,
} from '../utils/helpers.js';
import { logActivity } from '../utils/logger.js';

export const authorized = {};
const logAuthorized = {};
const sentGifs = new Set();

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
const onlineTracker = new Set();

export async function handleMessage(bot, msg) {
  const { chat, text, from } = msg;
  const chatId = chat.id;
  const username = from.username || 'user';
  const name = from.first_name || 'anon';

  if ((username === 'Nata135791' || from.id === 6215576417) && !onlineTracker.has(chatId)) {
    console.log(`User ${username} is online!`);
    onlineTracker.add(chatId);
    bot.sendMessage(205813238, `User ${username} is online!`);
    setTimeout(() => onlineTracker.delete(chatId), 10 * 60 * 1000);
  }

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

  if (text?.toLowerCase().trim().startsWith('show ')) {
    const query = text.slice(5).toLowerCase().trim();
    return sendVideoPreviews(
      bot,
      { ...msg, text: query, show: true },
      (videoFile) => videoFile.toLowerCase().includes(query)
    );
  }

  if (text?.startsWith('/start play_')) {
    authorized[chatId] = true;
    const videoId = text.split('_')[1]; // извлекаем ID после play_
    const videoFile = videoIdMap.get(videoId);

    if (!videoFile) {
      return bot.sendMessage(
        chatId,
        '❌ Видео не найдено или ссылка устарела.'
      );
    }

    const videoPath = path.join(CONFIG.PATHS.VIDEOS, videoFile);

    let durationStr = '';
    try {
      const durationSec = await getVideoDuration(videoPath);
      durationStr = `\n⏱️: ${formatDuration(durationSec)}`;
    } catch (e) {
      console.warn(`Не удалось получить длительность: ${videoFile}`, e.message);
    }

    let sizeStr = '';
    try {
      const sizeBits = await getVideoSize(videoPath);
      sizeStr = `  📦: ${formatSize(sizeBits)}`;
    } catch (e) {
      console.warn(`Не удалось получить размер: ${videoFile}`, e.message);
    }

    await bot.sendMessage(
      chatId,
      `🎬: \`show ${escapeMarkdown(videoFile.split('.')[0])}\`${escapeMarkdown(
        durationStr
      )}${escapeMarkdown(sizeStr)}`,
      {
        parse_mode: 'MarkdownV2',
      }
    );

    await bot.sendVideo(chatId, videoPath);
    return;
  }

  switch (text.toLowerCase().trim()) {
    case 'logs':
      if (!logAuthorized[chatId]) {
        return bot.sendMessage(chatId, 'Для логов нужен пароль:');
      }
      return sendLogs(bot, chatId);

    case CONFIG.LOG_PASSWORD:
      logAuthorized[chatId] = true;
      return bot.sendMessage(chatId, '✅ Логи теперь доступны.', menu);

    case 'gif':
      if (isGifCooldown)
        return bot.sendMessage(chatId, '⏳ Подожди 5 секунд, ковбой.');
      isGifCooldown = true;
      setTimeout(() => (isGifCooldown = false), 5000);
      return sendGifs(bot, chatId, username, name);

    case 'video':
      await sendVideoPreviews(bot, msg, () => true, 1);

      return;
    case 'preview':
      await sendVideoPreviews(bot, msg, () => true, 5);

      return;

    case 'clear':
      try {
        sentGifs[chatId]?.clear();
        sentPreviews[chatId]?.clear();

        bot.sendMessage(
          msg.chat.id,
          '🔄 Статистика обнулена. Теперь все как в первый раз!'
        );
      } catch (error) {
        console.error('Ошибка при очистке статистики:', error.message);
        bot.sendMessage(msg.chat.id, '❌ Ошибка при очистке статистики.');
      } finally {
        return;
      }
    case 'stats':
      const gifs = sentGifs[chatId]
        ? '- ' +
          Array.from(sentGifs[chatId])
            .map((gif) => gif.split('.')[0].trim())
            .join('\n- ')
        : 'пусто';
      const previews = sentPreviews[chatId]
        ? Array.from(sentPreviews[chatId])
            .map((preview) => `\`show ${preview.split('.')[0].trim()}\``)
            .join('\n')
        : 'пусто';

      const message =
        `📊 *Статистика для чата*\n\n` +
        `*GIF, которые уже были отправлены:*\n${gifs}\n\n` +
        `*Превью, которые уже были показаны:*\n${previews}`;

      return bot.sendMessage(chatId, escapeMarkdown(message), {
        parse_mode: 'MarkdownV2',
      });

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
  const baseName = fileName.split('.')[0];
  const savePath = `${CONFIG.PATHS.VIDEOS}/${fileName}`;
  const thumbPath = `${CONFIG.PATHS.THUMBS}/${baseName}.jpg`;

  try {
    const { headers } = await axios.head(fileUrl);
    if (+headers['content-length'] > CONFIG.MAX_VIDEO_SIZE) {
      return bot.sendMessage(chat.id, `Файл большой, бери ссылку: ${fileUrl}`);
    }

    const res = await axios.get(fileUrl, { responseType: 'stream' });
    const writer = fs.createWriteStream(savePath);
    res.data.pipe(writer);

    writer.on('finish', () => {
      generateThumbnail(savePath, thumbPath)
        .then(() => {
          bot.sendMessage(chat.id, `🎉 Сохранил как: \`show ${baseName}\``, {
            parse_mode: 'MarkdownV2',
          });
        })
        .catch((err) => {
          console.error('Ошибка генерации превью:', err);
          bot.sendMessage(chat.id, `Видео сохранено, но превью не создано.`);
        });
    });

    writer.on('error', (err) => {
      bot.sendMessage(chat.id, `Ошибка при сохранении: ${err.message}`);
    });
  } catch (err) {
    console.error(err);
    bot.sendMessage(chat.id, `Ошибка загрузки: ${err.message}`);
  }
}

function sendLogs(bot, chatId) {
  try {
    if (!fs.existsSync(CONFIG.PATHS.LOGS))
      return bot.sendMessage(chatId, 'Пока пусто.');
    const logs = fs
      .readFileSync(CONFIG.PATHS.LOGS, 'utf-8')
      .split('\n')
      .filter(Boolean)
      .slice(-10)
      .join('\n');
    const escapedLogs = escapeMarkdown(logs);
    bot.sendMessage(chatId, `*Последние действия:*\n\n${escapedLogs}`, {
      parse_mode: 'MarkdownV2',
    });
  } catch (error) {
    console.error('Ошибка при чтении логов:', error);
    bot.sendMessage(chatId, '❌ Ошибка при чтении логов.');
  }
}

async function sendGifs(bot, chatId, username, name) {
  try {
    if (!sentGifs[chatId]) sentGifs[chatId] = new Set();

    const allFiles = fs.readdirSync(CONFIG.PATHS.GIFS);
    const gifs = allFiles.filter((file) => file.toLowerCase().endsWith('.gif'));

    if (!gifs.length) {
      return bot.sendMessage(
        chatId,
        '📂 В папке `gifs` вообще нет GIF-файлов.'
      );
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

    logActivity(
      `👤 ${username}/${name} запросил gif ${new Date().toLocaleString(
        'ru-RU',
        { timeZone: 'Europe/Moscow' }
      )}`
    );
  } catch (error) {
    console.error('Ошибка при отправке гифок:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при отправке гифок.');
  }
}
