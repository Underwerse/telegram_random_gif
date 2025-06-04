import path from 'path';
import { CONFIG } from '../config.js';
import { getVideoById } from '../utils/preview.js';
import { logActivity } from '../utils/logger.js';
import { escapeMarkdown, formatDuration, formatSize, getVideoDuration, getVideoSize } from '../utils/helpers.js';

export async function handleCallback(bot, query) {
  const chatId = query.message.chat.id;
  const data = query.data;
  const username = query.from.username || 'user';
  const name = query.from.first_name || 'anon';

  if (data.startsWith('play_')) {
    const videoId = data.replace('play_', '');
    const videoFile = getVideoById(videoId);

    if (videoFile) {
      try {
        const videoPath = path.join(CONFIG.PATHS.VIDEOS, videoFile);

        // Получаем длительность
        let durationStr = '';
        try {
          const durationSec = await getVideoDuration(videoPath);
          durationStr = `⏱️: ${formatDuration(durationSec)}`;
        } catch (e) {
          console.warn(
            `Не удалось получить длительность: ${videoFile}`,
            e.message
          );
        }

        // Получаем размер
        let sizeStr = '';
        try {
          const sizeBits = await getVideoSize(videoPath);
          sizeStr = `  📦: ${formatSize(sizeBits)}`;
        } catch (e) {
          console.warn(`Не удалось получить размер: ${videoFile}`, e.message);
        }

        // Отправляем инфо перед самим видео
        const infoMsg =
          `🎬: \`${videoFile}\`\n` + `${durationStr}` + `${sizeStr}`;

        await bot.sendMessage(chatId, escapeMarkdown(infoMsg), { parse_mode: 'MarkdownV2' });

        // НЕ вызываем answerCallbackQuery до отправки видео
        await bot.sendVideo(chatId, videoPath);

        // Логируем
        logActivity(
          `${username}/${name} посмотрел \`show ${
            videoFile.split('.')[0]
          }\` ${new Date().toLocaleString('ru-RU', {
            timeZone: 'Europe/Moscow',
          })}`
        );
      } catch (err) {
        console.error('Ошибка при отправке видео:', err);
        await bot.sendMessage(chatId, '⚠ Не удалось отправить видео.');
      }
    } else {
      await bot.sendMessage(chatId, '⚠ Видео не найдено или устарел ID');
    }

    // ВЫЗЫВАЕМ ТОЛЬКО ПОСЛЕ отправки видео
    try {
      await bot.answerCallbackQuery({ callback_query_id: query.id });
    } catch (err) {
      // Иногда это может выбросить ошибку, если прошло слишком много времени — игнорируем
      console.warn(
        'answerCallbackQuery: query is too old — безопасно игнорируем'
      );
    }
  }
}
