import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CONFIG } from '../config.js';
import {
  escapeMarkdown,
  formatDuration,
  formatSize,
  getVideoDuration,
  getVideoSize,
} from './helpers.js';
import { logActivity } from './logger.js';

export const videoIdMap = new Map();
export const sentPreviews = new Set();

export async function sendVideoPreviews(
  bot,
  msg,
  filterFn = () => true,
  limit = 5
) {
  try {
    const { chat, text, from, show } = msg;
    const chatId = chat.id;
    const me = await bot.getMe();
    const botUsername = me.username;
    const username = from.username || 'user';
    const name = from.first_name || 'anon';
    let thumbsToSend = [];
    const thumbs = fs.readdirSync(CONFIG.PATHS.THUMBS);

    if (!sentPreviews[chatId]) sentPreviews[chatId] = new Set();

    if (!show) {
      thumbsToSend = thumbs
        .filter((thumb) => {
          const base = path.basename(thumb, path.extname(thumb));
          const videoFile = fs
            .readdirSync(CONFIG.PATHS.VIDEOS)
            .find((v) => v.startsWith(base));
          return (
            videoFile && filterFn(videoFile) && !sentPreviews[chatId].has(thumb)
          );
        })
        .sort(() => 0.5 - Math.random())
        .slice(0, limit);
    } else {
      const videos = fs.readdirSync(CONFIG.PATHS.VIDEOS);
      const matchedVideos = videos.filter((videoFile) =>
        videoFile.toLowerCase().includes(text.toLowerCase())
      );

      const notSeenThumbs = [];
      const alreadySeenThumbs = [];

      for (const videoFile of matchedVideos) {
        const base = path.basename(videoFile, path.extname(videoFile));
        const thumb = thumbs.find(
          (thumb) =>
            path.basename(thumb, path.extname(thumb)).toLowerCase().trim() ===
            base.toLowerCase().trim()
        );
        if (thumb) {
          if (!sentPreviews[chatId].has(thumb)) {
            notSeenThumbs.push(thumb);
          } else {
            alreadySeenThumbs.push(thumb);
          }
        }
      }

      if (notSeenThumbs.length > 0) {
        thumbsToSend = notSeenThumbs.slice(0, limit);
      } else if (alreadySeenThumbs.length > 0) {
        // Вернём 1 уже просмотренное
        thumbsToSend = alreadySeenThumbs.slice(0, 1);
        msg._alreadySeen = true; // 👈 кастомная метка, чтобы дальше в коде отреагировать
      }
    }

    if (!thumbsToSend.length && !show) {
      sentPreviews[chatId].clear();
      return bot.sendMessage(
        chatId,
        'Нет подходящих превью, обнуляем статистику.'
      );
    } else if (!thumbsToSend.length) {
      return bot.sendMessage(
        chatId,
        'Нет подходящих превью по запросу. Попробуй другой запрос.'
      );
    }

    for (const thumb of thumbsToSend) {
      const base = path.basename(thumb, path.extname(thumb));
      const videoFile = fs
        .readdirSync(CONFIG.PATHS.VIDEOS)
        .find((v) => v.startsWith(base));

      if (!videoFile) continue;

      const videoPath = path.join(CONFIG.PATHS.VIDEOS, videoFile);

      let durationStr = '';
      try {
        const durationSec = await getVideoDuration(videoPath);
        durationStr = `\n⏱️: ${formatDuration(durationSec)}`;
      } catch (e) {
        console.warn(
          `Не удалось получить длительность: ${videoFile}`,
          e.message
        );
      }

      let sizeStr = '';
      try {
        const sizeBits = await getVideoSize(videoPath);
        sizeStr = `  📦: ${formatSize(sizeBits)}`;
      } catch (e) {
        console.warn(`Не удалось получить размер: ${videoFile}`, e.message);
      }

      const videoId = crypto.randomBytes(6).toString('hex');
      videoIdMap.set(videoId, videoFile);

      const playLink = `https://t.me/${botUsername}?start=play_${videoId}`;

      const alreadySeen = msg._alreadySeen === true;

      await bot.sendPhoto(chatId, path.join(CONFIG.PATHS.THUMBS, thumb), {
        caption: `${
          alreadySeen
            ? '👀 Кажется, вы уже смотрели это видео ранее'
            : `🎬: \`show ${escapeMarkdown(videoFile.split('.')[0])}\``
        }${escapeMarkdown(durationStr)}${escapeMarkdown(
          sizeStr
        )}\n[▶ Смотреть в боте](${playLink})`,
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [{ text: '▶ Смотреть', callback_data: `play_${videoId}` }],
          ],
        },
      });

      sentPreviews[chatId].add(thumb);

      logActivity(
        `👤 ${username}/${name} запросил ${text} \`show ${
          thumb.split('.')[0]
        }\` ${new Date().toLocaleString('ru-RU', {
          timeZone: 'Europe/Moscow',
        })}`
      );
    }
  } catch (error) {
    console.error('Ошибка при отправке превью видео:', error.message);
    bot.sendMessage(msg.chat.id, 'Произошла ошибка при отправке превью видео.');
  }
}

export function getVideoById(videoId) {
  return videoIdMap.get(videoId);
}
