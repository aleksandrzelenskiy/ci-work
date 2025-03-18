# Базовый образ Node.js (20, Alpine)
FROM node:20-alpine

# Устанавливаем необходимые шрифты
RUN sed -i 's|dl-cdn.alpinelinux.org|dl-8.alpinelinux.org|g' /etc/apk/repositories
RUN apk update


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
