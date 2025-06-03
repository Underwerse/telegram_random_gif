#!/bin/bash

VIDEOS_DIR="./videos"
THUMBS_DIR="./thumbnails"

mkdir -p "$THUMBS_DIR"

# проходим по всем видеофайлам в папке
for video in "$VIDEOS_DIR"/*; do
  # получаем имя файла без пути и расширения
  filename=$(basename "$video")
  name="${filename%.*}"
  thumb="$THUMBS_DIR/$name.jpg"

  # если превью уже есть, пропускаем
  if [ -f "$thumb" ]; then
    echo "Превью уже есть: $thumb"
    continue
  fi

  echo "Создаю превью для: $filename"

  # ffmpeg: берем кадр с 5-й секунды, 1 кадр, высокое качество
  "/c/Program Files/ffmpeg/bin/ffmpeg.exe" -ss 00:00:05 -i "$video" -vframes 1 -q:v 2 "$thumb"
  if [ $? -eq 0 ]; then
    echo "✅ Превью создано: $thumb"
  else
    echo "❌ Ошибка при создании превью для: $filename"
  fi
done

echo "Готово."
