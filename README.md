# 📋 Канбан-дашборд / Kanban Dashboard

Персональный канбан-планировщик задач — одностраничное веб-приложение без сервера, зависимостей и регистраций. Работает прямо в браузере, данные хранятся локально.

> Personal kanban task manager — a single-file web app with no server, no dependencies, no accounts. Runs in the browser, data stored locally.

---

## ✨ Возможности

- **Канбан-доска** — 4 колонки: Backlog → Sprint → In Progress → Done
- **Направления** — категории задач с цветами и emoji (настраиваемые)
- **Дедлайны** — с временем, визуальной индикацией: просрочено / сегодня / скоро
- **Описания** — свободное поле с кликабельными ссылками
- **Автоархив** — задачи «Сделано» уходят в архив после текущей недели
- **Архив** — отдельная страница с группировкой, фильтрами и статистикой
- **Сортировка** — независимая для каждой колонки
- **Фильтрация** — по направлениям через чипы в тулбаре
- **Уведомления** — браузерные push о просроченных задачах (раз в час)
- **Экспорт / Импорт** — бэкап в JSON одной кнопкой
- **Google Calendar** — двусторонняя синхронизация через OAuth 2.0

---

## 🚀 Быстрый старт

### Без Google Calendar (просто и быстро)

```bash
git clone https://github.com/YOUR_USERNAME/kanban-dashboard.git
cd kanban-dashboard
open dashboard.html
```

### С Google Calendar (через локальный сервер)

```bash
git clone https://github.com/YOUR_USERNAME/kanban-dashboard.git
cd kanban-dashboard
chmod +x launch.command
double-click launch.command   # или: python3 -m http.server 8080
```

Откроется `http://localhost:8080/dashboard.html`

---

## 📋 Требования

- macOS (для `launch.command`)
- Python 3 (предустановлен на macOS 12+)
- Safari или Chrome

---

## 🗂 Структура проекта

```
kanban-dashboard/
├── dashboard.html      # Основная страница — вся логика здесь
├── archive.html        # Страница архива
├── launch.command      # Скрипт запуска (macOS)
├── README.md
├── LICENSE
└── docs/
    ├── agreements.md   # Принятые решения по проекту
    ├── requirements.md # Требования к продукту
    ├── spec.md         # Техническое задание
    ├── user-guide.md   # Руководство пользователя
    ├── installation.md # Установка и настройка
    ├── migration.md    # Перенос на другой компьютер
    ├── technical.md    # Техдокументация для разработчика
    └── changelog.md    # История версий
```

---

## 🔄 Google Calendar — синхронизация

Двусторонняя синхронизация через Google Calendar API v3:

- Задачи с дедлайном → события в Calendar (цвет = статус задачи)
- События из Calendar → задачи в Backlog (принятые приглашения тоже)
- Конфликты: побеждает более свежая запись (`lastModified`)
- Автосинк при открытии страницы + ручная кнопка 🔄

Подробная инструкция настройки — в [`docs/installation.md`](docs/installation.md).

---

## 💾 Хранение данных

Все данные хранятся в `localStorage` браузера. Никуда не передаются кроме Google Calendar (по явному запросу пользователя).

| Ключ | Содержимое |
|------|-----------|
| `tasks_v2` | Массив задач |
| `areas_v1` | Объект направлений |
| `gcal_config` | Настройки Google Calendar |

Резервная копия — кнопка 📤 в тулбаре, скачивается `kanban_backup_ДАТА.json`.

---

## 📦 Структура задачи

```json
{
  "id": "mq9g9dcb...",
  "area": 1,
  "text": "Описание задачи",
  "status": "todo",
  "deadline": "2026-06-15",
  "deadlineTime": "14:00",
  "description": "Заметки, ссылки...",
  "completedAt": null,
  "gcalEventId": null,
  "lastModified": 1749654948082,
  "createdAt": 1749654948082
}
```

---

## 🛠 Технологии

- Vanilla JS (ES2020+), HTML5, CSS3
- Без фреймворков, без сборщиков, без зависимостей
- Google Identity Services для OAuth
- Google Calendar API v3

---

## 📄 Лицензия

MIT — подробнее в файле [LICENSE](LICENSE).

---

## 👤 Автор

Рушан Умеров — [rumerov@gmail.com](mailto:rumerov@gmail.com) | [@SENSE-AI](https://github.com/SENSE-AI)
