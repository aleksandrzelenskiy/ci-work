# Базовый образ Node.js (20, Alpine)
FROM node:20-alpine

# Устанавливаем необходимые шрифты
RUN echo "https://mirror.yandex.ru/mirrors/alpine/latest-stable/main" > /etc/apk/repositories
RUN apk update && apk add --no-cache ttf-dejavu


# Рабочая директория в контейнере
WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm install

# Копируем весь код в контейнер
COPY . .

# Сборка приложения (если используется Next.js)
RUN npm run build

# Порт, на котором будет слушать наше Next.js-приложение
EXPOSE 3000

# Запуск в production-режиме
CMD ["npm", "run", "start"]
