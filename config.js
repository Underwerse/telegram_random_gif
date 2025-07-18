import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const CONFIG = {
  TOKEN: process.env.TELEGRAM_TOKEN,
  BOT_USERNAME: process.env.BOT_USERNAME,
  PASSWORD: process.env.BOT_PASSWORD || 'сиськи',
  LOG_PASSWORD: process.env.LOG_PASSWORD || 'письки',
  MAX_VIDEO_SIZE: (parseInt(process.env.MAX_VIDEO_SIZE_MB || '21') || 21) * 1024 * 1024,
  PATHS: {
    ROOT: __dirname,
    VIDEOS: path.join(__dirname, 'data', 'videos'),
    GIFS: path.join(__dirname, 'data', 'gifs'),
    THUMBS: path.join(__dirname, 'data', 'thumbnails'),
    LOGS: path.join(__dirname, 'data', 'logs', 'activity.log'),
  },
};
