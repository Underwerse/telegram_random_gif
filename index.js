import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();
const __dirname = path.resolve();
const token = process.env.TELEGRAM_TOKEN;
const adviceUrl = 'http://fucking-great-advice.ru/api/random';
const bot = new TelegramBot(token, { polling: true });

const sentGifs = {};
const sentVideos = {}; // Храним информацию об отправленных видео
const authorizedUsers = {}; // Список авторизованных пользователей
const logAuthorizedUsers = {}; // Список пользователей, авторизованных для логов
const MAX_VIDEO_SIZE_MB = +process.env.MAX_VIDEO_SIZE_MB * 1024 * 1024;
const PASSWORD = process.env.BOT_PASSWORD || 'сиськи'; // Пароль для авторизации
const LOG_PASSWORD = process.env.LOG_PASSWORD || 'письки'; // Пароль для авторизации логов

const menu = {
  reply_markup: {
    keyboard: [
      [{ text: 'gif' }, { text: 'advice' }],
      [{ text: 'video' }, { text: 'logs' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
    disable_web_page_preview: true,
  },
};

let isButtonDisabled = false;

const logsDir = path.join(__dirname, 'logs');
const logPath = path.join(logsDir, 'activity.log');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  if (authorizedUsers[chatId]) {
    bot.sendMessage(chatId, 'Хэлоу странник! Захотелось клубнички?', menu);
  } else {
    bot.sendMessage(chatId, 'Тут у меня пароль требуется, ну ты знаешь:');
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  if (msg.video) {
    const fileId = msg.video.file_id;
    const file = await bot.getFile(fileId);
    const filePath = file.file_path;
    const videoUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
    const fileName = path.basename(filePath);
    const savePath = path.join(videosDir, fileName);
    
    const fileStream = fs.createWriteStream(savePath);
    https.get(videoUrl, (response) => {
      response.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        bot.sendMessage(chatId, `Видео сохранено и теперь доступно по команде video!`);
      });
    }).on('error', (err) => {
      console.error(err);
      bot.sendMessage(chatId, `Ошибка при сохранении видео.`);
    });
  }

  // Проверка авторизации для основного функционала
  if (!authorizedUsers[chatId]) {
    if (msg.text.toLowerCase().trim() === PASSWORD.toLowerCase().trim()) {
      authorizedUsers[chatId] = true;
      bot.sendMessage(chatId, 'Отлично, теперь погнали!', menu);
    } else {
      bot.sendMessage(
        chatId,
        'Ну что, родимый, обознался? Тут пароль требуется (перезапусти бота).'
      );
    }
    return;
  }

  // Проверка авторизации для логов
  if (msg.text === 'logs' && !logAuthorizedUsers[chatId]) {
    bot.sendMessage(chatId, 'Для доступа к логам нужен специальный пароль:');
    return;
  }

  if (
    !logAuthorizedUsers[chatId] &&
    msg.text.toLowerCase().trim() === LOG_PASSWORD.toLowerCase().trim()
  ) {
    logAuthorizedUsers[chatId] = true;
    bot.sendMessage(
      chatId,
      'Теперь у тебя есть доступ к логам! Выбирай в меню.',
      menu
    );
    return;
  }

  if (msg.text === 'logs') {
    if (!fs.existsSync(logPath)) {
      return bot.sendMessage(chatId, 'Логов пока нет', menu);
    }

    const logs = fs.readFileSync(logPath, 'utf-8').split('\n').filter(Boolean);
    const lastLogs = logs.slice(-10).join('\n') || 'Чот пока нет ничего.';

    bot.sendMessage(chatId, `Последние 10 действий:\n\n${lastLogs}`, menu);
    return;
  }

  // Основной функционал бота
  if (msg.text === 'gif' && !isButtonDisabled) {
    isButtonDisabled = true;
    setTimeout(() => {
      isButtonDisabled = false;
    }, 5000);

    if (!sentGifs[chatId]) {
      sentGifs[chatId] = [];
    }

    const gifs = fs.readdirSync(path.join(__dirname, 'gifs'));
    const filteredGifs = gifs.filter(
      (gif, index) => !sentGifs[chatId].includes(index)
    );

    if (filteredGifs.length === 0) {
      sentGifs[chatId] = [];
      return bot.sendMessage(
        chatId,
        'Ты все гифки уже пересмотрел, давай по-новой',
        menu
      );
    }

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    for (let i = 0; i < 5; i++) {
      const randomGif =
        filteredGifs[Math.floor(Math.random() * filteredGifs.length)];

      await delay(2000);
      await bot.sendDocument(chatId, path.join(__dirname, 'gifs', randomGif), {
        contentType: 'image/gif',
      });

      sentGifs[chatId].push(gifs.indexOf(randomGif));
    }

    const username = msg.from.username || 'Unknown username';
    const first_name = msg.from.first_name || 'Unknown first_name';
    const logMsg = `${username}/${first_name} запросил gif ${
      new Date().toISOString().split('T')[0]
    } в ${new Date().toISOString().split('T')[1].split('.')[0]}
`;
    fs.appendFile(path.join(logsDir, 'activity.log'), logMsg, (err) => {
      if (err) console.error(err);
    });
  } else if (msg.text === 'video') {
    if (!sentVideos[chatId]) {
      sentVideos[chatId] = [];
    }

    const videos = fs.readdirSync(path.join(__dirname, 'videos'));
    const filteredVideos = videos.filter(
      (video, index) => !sentVideos[chatId].includes(index)
    );

    if (filteredVideos.length === 0) {
      sentVideos[chatId] = [];
      return bot.sendMessage(
        chatId,
        'Ты все видосы уже пересмотрел, давай по-новой',
        menu
      );
    }

    const randomVideo =
      filteredVideos[Math.floor(Math.random() * filteredVideos.length)];

    const videoPath = path.join(__dirname, 'videos', randomVideo);
    const fileSize = fs.statSync(videoPath).size;
    console.log(
      `typeof fileSize: ${typeof fileSize}, limit: ${MAX_VIDEO_SIZE_MB}`
    );
    console.log(`Отправка видео: ${randomVideo} размером ${fileSize} байт`);

    if (fileSize > MAX_VIDEO_SIZE_MB) {
      await bot.sendMessage(
        chatId,
        `Что-то не удалось отправить, попробуй еще раз`
      );
    } else {
      await bot.sendVideo(chatId, videoPath, { caption: '' });
    }

    sentVideos[chatId].push(videos.indexOf(randomVideo));

    const username = msg.from.username || 'Unknown username';
    const first_name = msg.from.first_name || 'Unknown first_name';
    const logMsg = `${username}/${first_name} запросил видео ${
      new Date().toISOString().split('T')[0]
    } в ${new Date().toISOString().split('T')[1].split('.')[0]}
`;
    fs.appendFile(path.join(logsDir, 'activity.log'), logMsg, (err) => {
      if (err) console.error(err);
    });
  } else if (msg.text === 'advice') {
    await axios
      .get(adviceUrl)
      .then((response) => {
        const advice = response.data.text;
        bot.sendMessage(chatId, advice);
      })
      .catch((error) => {
        console.error(error);
        bot.sendMessage(
          chatId,
          'Советы пока недоступны, видимо что-то случилось с апи.'
        );
      });
  } else if (msg.text === 'gif' && isButtonDisabled) {
    bot.sendMessage(
      chatId,
      `Надо 5 секунд подождать перез новым запросом-то`,
      menu
    );
  }
});
