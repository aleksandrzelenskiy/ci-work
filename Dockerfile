# Используем легковесный Node-образ
FROM node:18-alpine AS builder

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package*.json и устанавливаем зависимости
COPY package.json package-lock.json ./
RUN npm install

# Копируем исходный код
COPY . .

# Сборка Next.js приложения
RUN npm run build

# Теперь создадим production-образ
FROM node:18-alpine AS runner

WORKDIR /app

# Копируем node_modules и build-артефакты из builder-слоя
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/public ./public

# Переменные окружения
ENV NODE_ENV=production

# Пробрасываем порт 3000
EXPOSE 3000

# Команда запуска
CMD ["npm", "run", "start"]
