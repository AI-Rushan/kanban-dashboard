# Техническое задание — «Канбан-дашборд»

Версия: 1.0  
Дата: 2026-06-11

---

## 1. Состав продукта

```
kanban/
├── dashboard.html      # Основная страница (канбан-доска)
├── archive.html        # Страница архива
├── launch.command      # Скрипт запуска (macOS)
└── docs/               # Документация
```

---

## 2. Технический стек

| Компонент | Решение |
|-----------|---------|
| Язык | HTML5 + CSS3 + Vanilla JS (ES2020+) |
| Хранение данных | localStorage |
| Аутентификация | Google Identity Services (GIS) |
| API | Google Calendar API v3 |
| Сервер | Python 3 `http.server` (только для OAuth) |
| Зависимости | нет (кроме GIS скрипта загружаемого онлайн) |

---

## 3. Структуры данных

### 3.1 Задача (Task)

```js
{
  id:           string,    // uid() = Date.now().toString(36) + random
  area:         number,    // ID направления
  text:         string,    // текст задачи
  status:       string,    // 'backlog' | 'todo' | 'doing' | 'done' | 'archive'
  deadline:     string|null,  // 'ГГГГ-ММ-ДД'
  deadlineTime: string|null,  // 'ЧЧ:ММ' (необязательно)
  description:  string|null,  // свободный текст
  completedAt:  string|null,  // 'ГГГГ-ММ-ДД' (заполняется при переходе в done)
  gcalEventId:  string|null,  // ID события в Google Calendar
  lastModified: number,       // timestamp (для разрешения конфликтов)
  createdAt:    number        // timestamp
}
```

### 3.2 Направление (Area)

```js
{
  emoji:  string,  // '🔍'
  label:  string,  // 'Поиск работы'
  border: string,  // CSS цвет рамки карточки '#6366f1'
  bg:     string,  // CSS цвет фона бейджа '#ede9fe'
  text:   string   // CSS цвет текста бейджа '#4f46e5'
}
```

AREAS — объект вида `{ "1": Area, "2": Area, ... }`, ключи — строковые числа.

### 3.3 Конфигурация Google Calendar

```js
{
  clientId:      string,   // OAuth Client ID из Google Cloud Console
  calendarId:    string,   // ID выбранного календаря
  calendarName:  string,   // Отображаемое имя календаря
  lastSyncTime:  number    // timestamp последней синхронизации
}
```

---

## 4. localStorage — ключи хранения

| Ключ | Содержимое |
|------|-----------|
| `tasks_v2` | JSON.stringify(Task[]) |
| `areas_v1` | JSON.stringify({ [id]: Area }) |
| `gcal_config` | JSON.stringify(GcalConfig) |
| `lastNotifCheck` | timestamp последней проверки уведомлений |

---

## 5. Алгоритм автоархивации

При каждом открытии страницы выполняется `autoArchive()`:

1. Вычислить текущую ISO-неделю: `isoWeek(todayStr())` → `"ГГГГ-WНН"`
2. Для каждой задачи со статусом `done` и непустым `completedAt`:
   - Если `isoWeek(completedAt) < currentWeek` → изменить статус на `archive`
3. Если были изменения → сохранить в localStorage

Формат ISO-недели: `"2026-W24"` — обеспечивает корректное лексикографическое сравнение.

---

## 6. Google Calendar — техническая реализация

### 6.1 Аутентификация

- Библиотека: Google Identity Services (`https://accounts.google.com/gsi/client`)
- Тип потока: Token (implicit grant) — без серверной части
- Scope: `https://www.googleapis.com/auth/calendar`
- Токен хранится только в памяти (`let gcalToken = null`), не в localStorage
- Таймаут ожидания токена: 90 секунд (защита от зависания при блокировке попапа)
- Требование к origin: файл должен открываться через `http://localhost:8080` (не `file://`)

### 6.2 Окно синхронизации

- `timeMin`: начало текущей ISO-недели (понедельник 00:00:00)
- `timeMax`: `timeMin + 32 дня`
- `singleEvents=true`: повторяющиеся события разворачиваются
- `maxResults=500`

### 6.3 Алгоритм полной синхронизации (`syncFull`)

**Фаза PULL (Calendar → Dashboard):**

```
Получить все события в окне [weekStart, weekStart+32d]
Построить индекс: evById[id] = event, evByTaskId[taskId] = event

Для каждого события:
  if event.extendedProperties.private.taskId существует:
    task = найти задачу по taskId
    if task не найдена:
      → удалить событие из Calendar
    else:
      if event.updated > task.lastModified:
        → применить данные события к задаче (applyEventToTask)
      else:
        → задача новее, обновим Calendar в фазе PUSH
  else:
    if событие принято (isAcceptedInvitation):
      → создать новую задачу в Backlog
      → записать taskId в extendedProperties события
```

**Фаза PUSH (Dashboard → Calendar):**

```
Для каждой задачи:
  if статус=archive И gcalEventId отсутствует: пропустить
  if deadline отсутствует И gcalEventId отсутствует: пропустить

  eventData = taskToEvent(task)

  if gcalEventId существует:
    if событие есть в окне:
      if task.lastModified >= event.updated:
        → PATCH событие данными задачи
    else:
      → PATCH событие напрямую (вне окна)
      if ошибка 404: пересоздать событие
  else if deadline существует:
    → POST новое событие
    → сохранить gcalEventId в задаче
```

### 6.4 Маппинг статус → цвет события

| Статус | Google Calendar colorId | Цвет |
|--------|------------------------|------|
| backlog | 8 | Graphite (серый) |
| todo | 9 | Blueberry (синий) |
| doing | 6 | Tangerine (оранжевый) |
| done | 2 | Sage (зелёный) |
| archive | 8 | Graphite (серый) |

### 6.5 Конвертация задача → событие

- `deadline + deadlineTime` → `start.dateTime` + `end.dateTime` (+ 1 час)
- `deadline` (без времени) → `start.date` + `end.date` (следующий день)
- Для задач со статусом `done`: дата = `completedAt` (не `deadline`)
- `task.text` → `event.summary` (с префиксом emoji направления)
- `task.description` → `event.description`
- Timezone: `Intl.DateTimeFormat().resolvedOptions().timeZone`

---

## 7. Разрешение конфликтов при синхронизации

Поле `lastModified` обновляется при каждом изменении задачи:
- Редактирование через модал (`saveTask`)
- Перемещение кнопками ← → (`moveCard`)
- Перетаскивание (`drag & drop`)
- Применение данных из Calendar (`applyEventToTask`)

Правило: **побеждает запись с большим `lastModified`** (Unix timestamp в миллисекундах).

---

## 8. Экспорт / Импорт

### Формат файла

```json
{
  "version": 2,
  "app": "kanban-dashboard",
  "exportedAt": "2026-06-11T15:55:48.082Z",
  "tasks": [ ...Task[] ],
  "areas": { "1": Area, ... }
}
```

### Миграция при импорте

При импорте автоматически добавляются отсутствующие поля:
- `gcalEventId` → `null`
- `lastModified` → `createdAt || Date.now()`
- `deadlineTime` → `null`
- `description` → `null`

---

## 9. Ключевые функции JavaScript (dashboard.html)

| Функция | Назначение |
|---------|-----------|
| `loadTasks()` | Загрузка + миграция задач из localStorage |
| `saveTasks(tasks)` | Сохранение в localStorage |
| `autoArchive()` | Автоматический перевод задач в архив |
| `render()` | Полный перерендер доски |
| `cardHTML(task)` | Генерация HTML карточки |
| `openModal(status, id)` | Открытие модала задачи |
| `saveTask()` | Сохранение задачи из модала |
| `moveCard(id, dir)` | Перемещение кнопками |
| `renderToolbar()` | Рендер чипов фильтрации + select направлений |
| `exportData()` | Скачать JSON-бэкап |
| `handleImportFile(input)` | Обработать импортируемый файл |
| `syncFull()` | Полная двусторонняя синхронизация с Calendar |
| `gcalConnect()` | OAuth авторизация + загрузка списка календарей |
| `taskToEvent(task)` | Конвертация задачи в объект события Calendar |
| `applyEventToTask(task, event)` | Применить данные события к задаче |
| `eventToNewTask(event)` | Создать новую задачу из события Calendar |
| `isoWeek(dateStr)` | Вычислить ISO-номер недели |
| `dateStatus(dl, compareTo, dlTime)` | Статус дедлайна: overdue/today/soon/normal |
| `linkify(text)` | Сделать URL-ы кликабельными |

---

## 10. Скрипт запуска (launch.command)

```bash
#!/bin/bash
PORT=8080
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
# Освобождение порта если занят
lsof -ti:$PORT | xargs kill -9 2>/dev/null
# Запуск сервера + открытие браузера
python3 -m http.server $PORT &>/dev/null &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null" EXIT
sleep 0.7
open "http://localhost:$PORT/dashboard.html"
wait $SERVER_PID
```

Требования: macOS, Python 3 (предустановлен на macOS 12+).
