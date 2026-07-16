#!/bin/sh
# Старт панели в контейнере: схема БД → сид администратора → Next.js.
set -e

echo "[panel] Применение схемы базы данных..."
npx prisma db push --skip-generate

echo "[panel] Сид (администратор)..."
npm run db:seed

echo "[panel] Запуск..."
exec npm start
