# Базовый образ Node.js (20, Alpine)
FROM node:20-alpine

# 1. Устанавливаем зеркало для npm (решает проблемы 403/доступа)
RUN npm config set registry https://registry.npmmirror.com/

# 2. Обновляем npm до последней версии
RUN npm install -g npm@11.2.0

# 3. Устанавливаем системные зависимости (шрифты)
RUN echo "https://mirror.yandex.ru/mirrors/alpine/latest-stable/main" > /etc/apk/repositories && \
    apk update && \
    apk add --no-cache ttf-dejavu

# Рабочая директория в контейнере
WORKDIR /app

# 4. Копируем ТОЛЬКО файлы зависимостей (для кэширования слоя)
COPY package*.json ./

# 5. Устанавливаем зависимости с принудительным разрешением конфликтов
RUN npm install --force --legacy-peer-deps && \
    npm cache clean --force

# 6. Копируем остальные файлы проекта
COPY . .

# 7. Сборка приложения
RUN npm run build

# Порт, на котором будет слушать приложение
EXPOSE 3000

# Запуск в production-режиме
CMD ["npm", "run", "start"]