# Образ панели YaniVPN (Next.js + Prisma/PostgreSQL).
# Запускается через docker-compose.yml в корне репозитория.
FROM node:20-alpine

WORKDIR /app

# openssl нужен Prisma-движку на Alpine
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
# Кэш npm чистим в том же слое — иначе он раздувает образ на сотни МБ
RUN npm ci --no-audit --no-fund && npm cache clean --force

COPY . .

# Плейсхолдер только для сборки (prisma generate / next build не подключаются
# к базе); настоящий DATABASE_URL приходит из docker-compose при запуске.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# На старте: миграция схемы, сид администратора, запуск панели
CMD ["sh", "deploy/docker-entrypoint.sh"]
