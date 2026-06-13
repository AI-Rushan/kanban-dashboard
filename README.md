<div align="center">

# 📋 Канбан-дашборд

**Персональный планировщик задач — один HTML-файл, никаких зависимостей**

[![Version](https://img.shields.io/badge/версия-1.1-2563eb?style=flat-square)](https://github.com/AI-Rushan/kanban-dashboard/releases)
[![License](https://img.shields.io/badge/лицензия-MIT-16a34a?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/платформа-macOS-lightgrey?style=flat-square&logo=apple)](https://github.com/AI-Rushan/kanban-dashboard)
[![No Framework](https://img.shields.io/badge/фреймворк-нет-f97316?style=flat-square)](https://github.com/AI-Rushan/kanban-dashboard)
[![Google Calendar](https://img.shields.io/badge/Google_Calendar-синхронизация-4285F4?style=flat-square&logo=googlecalendar&logoColor=white)](https://github.com/AI-Rushan/kanban-dashboard/blob/main/docs/installation.md)

> Personal kanban task manager — a single HTML file with no server, no dependencies, no accounts required.

[🚀 Быстрый старт](#-быстрый-старт) · [✨ Возможности](#-возможности) · [📅 Google Calendar](#-google-calendar) · [📖 Документация](#-документация) · [🗺 Роадмап](#-роадмап)

</div>

---

## ✨ Возможности

- **Канбан-доска** — 4 колонки: Backlog → Todo → In Progress → Done
- **Направления** — категории задач с цветами и emoji, настраиваемые
- **Дедлайны** — с временем, визуальная индикация: просрочено / сегодня / скоро
- **Описания** — свободный текст с кликабельными ссылками
- **Автоархив** — выполненные задачи уходят в архив после текущей ISO-недели
- **Архив** — отдельная страница с группировкой, фильтрами и статистикой
- **Сортировка** — независимая для каждой колонки
- **Фильтрация** — по направлениям через чипы в тулбаре
- **Уведомления** — браузерные push о просроченных задачах (раз в час)
- **Экспорт / Импорт** — резервная копия в JSON одной кнопкой
- **Google Calendar** — двусторонняя синхронизация через OAuth 2.0

---

## 🚀 Быстрый старт

### Без Google Calendar (просто и быстро)

```bash
git clone https://github.com/AI-Rushan/kanban-dashboard.git
cd kanban-dashboard
open dashboard.html
```

### С Google Calendar (через локальный сервер)

```bash
git clone https://github.com/AI-Rushan/kanban-dashboard.git
cd kanban-dashboard
chmod +x launch.command
```

Дважды кликни `launch.command` — сервер запустится и откроется браузер на `http://localhost:8080/dashboard.html`

Подробная инструкция по настройке Google Calendar → [`docs/installation.md`](docs/installation.md)

---

## 📋 Требования

| | Базовая установка | С Google Calendar |
|---|---|---|
| Система | macOS | macOS |
| Python | Python 3 (есть на macOS 12+) | Python 3 |
| Браузер | Safari или Chrome | Safari или Chrome |
| Google аккаунт | не нужен | нужен |

---

## 🗂 Структура проекта

```
kanban-dashboard/
├── dashboard.html      # Вся логика приложения — один файл
├── archive.html        # Страница архива
├── launch.command      # Скрипт запуска (macOS, двойной клик)
├── ROADMAP.md          # Планы развития
├── README.md
├── LICENSE
└── docs/
    ├── user-guide.md       # Руководство пользователя
    ├── installation.md     # Установка и настройка Google Calendar
    ├── migration.md        # Перенос на другой компьютер
    ├── technical.md        # Техдокументация для разработчика
    ├── spec.md             # Техническое задание
    ├── changelog.md        # История версий
    ├── agreements.md       # Принятые решения по проекту
    ├── requirements.md     # Требования к продукту
    └── project-journal.md  # Журнал разработки
```

---

## 📅 Google Calendar

Двусторонняя синхронизация через Google Calendar API v3:

- Задачи с дедлайном → события в Calendar (цвет события = статус задачи)
- События из Calendar → задачи в Backlog (принятые приглашения тоже)
- Конфликты: побеждает более свежая запись по полю `lastModified`
- Автосинхронизация при открытии страницы + ручная кнопка 🔄
- Принудительная перезапись всех задач кнопкой ⚡ в настройках

| Цвет события | Статус задачи |
|---|---|
| 🩶 Серый | Backlog |
| 🔵 Синий | Todo |
| 🟠 Оранжевый | In Progress |
| 🟢 Зелёный | Done |

---

## 💾 Хранение данных

Все данные хранятся в `localStorage` браузера. Никуда не передаются, кроме Google Calendar (по явному запросу).

| Ключ | Содержимое |
|---|---|
| `tasks_v2` | Массив задач |
| `areas_v1` | Объект направлений |
| `gcal_config` | Настройки Google Calendar |

Резервная копия — кнопка 📤 в тулбаре, скачивается файл `kanban_backup_ДАТА.json`.

---

## 📦 Структура задачи (JSON)

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

- **Vanilla JS** (ES2020+), HTML5, CSS3 — без фреймворков и сборщиков
- **Google Identity Services** — OAuth 2.0 popup flow
- **Google Calendar API v3** — двусторонняя синхронизация
- **localStorage** — хранение данных без сервера

---

## 🗺 Роадмап

Планы развития — в файле [`ROADMAP.md`](ROADMAP.md).

Ближайшие цели (v1.2): Windows-поддержка, вложения файлов, тёмная тема, поиск.

---

## 📖 Документация

| Документ | Описание |
|---|---|
| [Руководство пользователя](docs/user-guide.md) | Как пользоваться дашбордом |
| [Установка](docs/installation.md) | Установка и настройка Google Calendar |
| [Перенос данных](docs/migration.md) | Переезд на другой компьютер |
| [Техдокументация](docs/technical.md) | Для разработчиков |
| [Changelog](docs/changelog.md) | История изменений |
| [Роадмап](ROADMAP.md) | Планы развития |

---

## 📄 Лицензия

MIT — подробнее в файле [LICENSE](LICENSE).

---

<div align="center">

Сделано с ❤️ для личной продуктивности

**Рушан Умеров** · [rumerov@gmail.com](mailto:rumerov@gmail.com) · [@AI-Rushan](https://github.com/AI-Rushan)

</div>
