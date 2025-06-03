import fs from 'fs';
import { CONFIG } from '../config.js';

export function logActivity(message) {
  const logDir = CONFIG.PATHS.LOGS;
  fs.appendFile(logDir, `${message}\n`, (err) => {
    if (err) console.error(err);
  });
}
