FROM node:22

# Установка ffmpeg вместе с ffprobe
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    ln -s /usr/bin/ffprobe /usr/local/bin/ffprobe && \
    ln -s /usr/bin/ffmpeg /usr/local/bin/ffmpeg && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Command to run the bot
CMD ["node", "index.js"]