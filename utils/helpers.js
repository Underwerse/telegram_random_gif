import ffmpeg from 'fluent-ffmpeg';
import path from 'path';

export function escapeMarkdown(text = '') {
  return text
    // экранируем все спецсимволы кроме бэктиков
    .replace(/([_*[\]()~>#+\-=|{}.!\\])/g, '\\$1');
}

export function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

export function generateThumbnail(videoPath, outputPath) {
  try {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .on('end', resolve)
        .on('error', reject)
        .screenshots({
          timestamps: ['5'],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: '320x?',
        });
    });
  } catch (error) {
    console.error('Ошибка при генерации миниатюры:', error);
    throw new Error('Не удалось создать миниатюру видео');
  }
}