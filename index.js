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
const videosDir = path.join(__dirname, 'videos');

const menu = {
  reply_markup: {
    keyboard: [
      [{ text: 'gif' }, { text: 'advice' }],
      [{ text: 'video' }, { text: 'preview' }],
      // [{ text: 'logs' }],
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

  if (!authorizedUsers[chatId]) {
    if (msg.text?.toLowerCase().trim() === PASSWORD.toLowerCase().trim()) {
      authorizedUsers[chatId] = true;
      bot.sendMessage(chatId, 'Авторизация успешна!', menu);
    } else {
      bot.sendMessage(chatId, 'Неверный пароль!');
    }
    return;
  }

  if (msg.video) {
    try {
      const fileId = msg.video.file_id;
      const file = await bot.getFile(fileId);
      const filePath = file.file_path;
      const videoUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
      const fileName = path.basename(filePath);
      const savePath = path.join(videosDir, fileName);

      // Проверка размера файла
      const fileResponse = await axios.head(videoUrl);
      const fileSize = parseInt(fileResponse.headers['content-length']);

      // Если файл больше 20 МБ, не скачиваем напрямую, а отправляем ссылку
      if (fileSize > 20 * 1024 * 1024) {
        // 20 МБ
        bot.sendMessage(
          chatId,
          `Файл слишком большой для прямого скачивания. Вы можете скачать его с облака по ссылке: ${videoUrl}`
        );
        return;
      }

      const response = await axios({
        url: videoUrl,
        method: 'GET',
        responseType: 'stream',
      });

      const fileStream = fs.createWriteStream(savePath);
      response.data.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        bot.sendMessage(
          chatId,
          `Видео сохранено и теперь доступно по команде \`video ${
            fileName.split('.')[0]
          }\``,
          {
            parse_mode: 'MarkdownV2',
          }
        );
      });
    } catch (error) {
      console.error(error);
      bot.sendMessage(chatId, `Ошибка при сохранении видео: ${error.message}`);
    }
  }

  const videoCommand = msg.text?.match(/^video\s+(.+)/);
  if (videoCommand) {
    const requestedVideo = videoCommand[1].trim();
    const videoPath = fs
      .readdirSync(videosDir)
      .find((file) => file.startsWith(requestedVideo));

    if (videoPath) {
      bot.sendVideo(chatId, path.join(videosDir, videoPath));
    } else {
      bot.sendMessage(chatId, `Видео \`${requestedVideo}\` не найдено.`, {
        parse_mode: 'MarkdownV2',
      });
    }
  }

  // Проверка авторизации для логов
  if (msg.text === 'logs' && !logAuthorizedUsers[chatId]) {
    bot.sendMessage(chatId, 'Для доступа к логам нужен специальный пароль:');
    return;
  }

  if (
    !logAuthorizedUsers[chatId] &&
    msg.text?.toLowerCase().trim() === LOG_PASSWORD.toLowerCase().trim()
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
  } else if (msg.text === 'preview') {
    const previewsDir = path.join(__dirname, 'thumbnails');
    const allThumbs = fs.readdirSync(previewsDir);
    const randomThumbs = allThumbs.sort(() => 0.5 - Math.random()).slice(0, 5);

    for (const thumb of randomThumbs) {
      const videoName = thumb.split('.')[0];
      const thumbPath = path.join(previewsDir, thumb);

      await bot.sendPhoto(chatId, thumbPath, {
        caption: `Видео: ${videoName}`,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '▶ Смотреть',
                callback_data: `play_${videoName}`,
              },
            ],
          ],
        },
      });
    }
  }
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data.startsWith('preview_')) {
    const filename = data.replace('preview_', '');
    const videoName = filename.split('.')[0];
    const videoFile = fs
      .readdirSync(videosDir)
      .find((v) => v.startsWith(videoName));

    if (videoFile) {
      await bot.sendVideo(chatId, path.join(videosDir, videoFile));
    } else {
      await bot.sendMessage(chatId, 'Видео не найдено');
    }
    await bot.answerCallbackQuery({ callback_query_id: query.id });
  }

  if (data.startsWith('play_')) {
    const videoName = data.replace('play_', '');
    const videoFile = fs
      .readdirSync(videosDir)
      .find((v) => v.startsWith(videoName));

    if (videoFile) {
      await bot.sendVideo(chatId, path.join(videosDir, videoFile));
    } else {
      await bot.sendMessage(chatId, `Видео ${videoName} не найдено`);
    }
    await bot.answerCallbackQuery({ callback_query_id: query.id });
  }
});
