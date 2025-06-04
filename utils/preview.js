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

      thumbsToSend = matchedVideos
        .map((videoFile) => {
          const base = path.basename(videoFile, path.extname(videoFile));
          const thumb = thumbs.find(
            (thumb) =>
              path.basename(thumb, path.extname(thumb)).toLowerCase().trim() ===
              base.toLowerCase().trim()
          );
          // фильтруем здесь
          if (thumb && !sentPreviews[chatId].has(thumb)) {
            return thumb;
          }
          return null;
        })
        .filter(Boolean)
        .slice(0, limit);
    }

    if (!thumbsToSend.length) {
      sentPreviews[chatId].clear();
      return bot.sendMessage(
        chatId,
        'Нет подходящих превью, обнуляем статистику.'
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

      await bot.sendPhoto(chatId, path.join(CONFIG.PATHS.THUMBS, thumb), {
        caption: `🎬: ${escapeMarkdown(videoFile)}${escapeMarkdown(
          durationStr
        )}${escapeMarkdown(sizeStr)}`,
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [{ text: '▶ Смотреть', callback_data: `play_${videoId}` }],
          ],
        },
      });

      sentPreviews[chatId].add(thumb);

      logActivity(
        `${username}/${name} запросил ${text} \`show ${
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
