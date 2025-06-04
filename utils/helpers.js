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

export function getVideoDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const duration = metadata.format.duration;
      resolve(duration);
    });
  });
}

export function getVideoSize(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const size = metadata.format.size;
      resolve(size);
    });
  });
}

export function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function formatSize(bits) {
  if (typeof bits !== 'number' || isNaN(bits)) return '0 B';

  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bits === 0) return '0 B';

  const i = Math.floor(Math.log(bits) / Math.log(1024));
  const value = bits / Math.pow(1024, i);

  return `${value.toFixed(value < 10 ? 2 : 1)} ${sizes[i]}`;
}