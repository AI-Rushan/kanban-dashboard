# Техническая документация для разработчика — «Канбан-дашборд»

Версия: 1.0 | Дата: 2026-06-11

Этот документ — для тебя, Рушан, или для любого разработчика, который будет дорабатывать продукт.

---

## Среда разработки

Никаких инструментов сборки нет. Всё редактируется напрямую в HTML-файле. Достаточно любого текстового редактора (VS Code, Cursor, и т.д.).

Для тестирования Google Calendar нужен локальный сервер:
```bash
cd ~/Desktop/kanban
python3 -m http.server 8080
# открыть http://localhost:8080/dashboard.html
```

---

## Файловая структура

```
kanban/
├── dashboard.html   # Основная страница — вся логика здесь (~2500+ строк)
├── archive.html     # Страница архива — отдельный независимый файл
└── launch.command   # bash-скрипт запуска (macOS)
```

Нет node_modules, нет package.json, нет сборщиков. Один файл — одна страница.

---

## Как устроен dashboard.html

Файл разделён на секции (навигируй по комментариям `// ===`):

```
<style>         — весь CSS (переменные, анимации, модалы, карточки, тулбар)
<body>          — разметка: тулбар, колонки, 2 модала (задача + направления),
                  модал Google Calendar настроек
<script>
  // === CONSTANTS       — статусы, PALETTE (12 цветов), GCAL_SCOPE
  // === STATE           — tasks[], AREAS{}, gcalToken, gcalConfig, activeFilter, colSort
  // === STORAGE         — loadTasks(), saveTasks(), loadAreas(), saveAreas()
  // === MIGRATION       — логика добавления новых полей к старым задачам
  // === AUTO-ARCHIVE    — autoArchive(), isoWeek()
  // === RENDER          — render(), cardHTML(), renderToolbar()
  // === MODAL TASK      — openModal(), saveTask(), deleteTask()
  // === MODAL AREAS     — открытие/редактирование/удаление направлений
  // === MOVE / DRAG     — moveCard(), drag & drop handlers
  // === EXPORT/IMPORT   — exportData(), handleImportFile()
  // === NOTIFICATIONS   — checkNotifications(), requestNotifPermission()
  // === GCAL AUTH       — gcalLoadGIS(), gcalRequestToken(), gcalConnect()
  // === GCAL SYNC       — syncFull(), gcalFetchEvents(), taskToEvent(),
  //                       applyEventToTask(), eventToNewTask()
  // === GCAL UI         — openGcalModal(), updateGcalUI(), gcalSave()
  // === INIT            — autoArchive(), renderToolbar(), render(),
  //                       checkNotifications(), updateGcalUI(), syncFull()
</script>
```

---

## Добавление нового поля к задаче

1. Добавь поле в `openModal()` — HTML инпут в модале
2. Считай значение в `saveTask()` — `task.newField = ...`
3. Добавь миграцию в `loadTasks()`:
   ```js
   tasks.forEach(t => {
     if (t.newField === undefined) t.newField = null;
   });
   ```
4. Отобрази в `cardHTML()` если нужно показывать на карточке
5. Обнови экспортный формат — увеличь `version` в `exportData()` если поле критично

---

## Добавление нового направления (Area)

Направления хранятся в `AREAS` — объект `{ "id": Area }`. ID — строковые числа (1, 2, …).

При создании нового направления генерируется новый ID:
```js
const newId = String(Math.max(0, ...Object.keys(AREAS).map(Number)) + 1);
```

Цвета выбираются из `PALETTE` — массив из 12 объектов `{border, bg, text}`.

---

## Добавление нового статуса

Текущие статусы: `backlog | todo | doing | done | archive`.

Если нужен новый статус:
1. Добавь в константу `STATUSES` (если она вынесена) или в `render()`
2. Добавь колонку в `<body>` с соответствующим `data-status`
3. Добавь цвет в `taskToEvent()` → объект `colorMap`
4. Обнови логику `autoArchive()` если нужно

---

## Google Calendar — детали реализации

### Токен и сессия

- Токен хранится только в `let gcalToken = null` — не в localStorage
- Живёт ~1 час (Google ограничение для implicit grant)
- При следующей синхронизации после истечения — автоматически запрашивается новый через `gcalRequestToken()` (попап)

### Повторные попытки при 401

При ошибке 401 в процессе синхронизации:
```js
if (resp.status === 401) {
  gcalToken = null;
  await gcalRequestToken(); // попап
  // повторить запрос
}
```

### Обновление событий вне окна синхронизации

Если задача имеет `gcalEventId`, но её дедлайн вне окна (не попадает в `timeMin–timeMax`), событие обновляется прямым PATCH-запросом на `/calendars/{id}/events/{eventId}` без предварительного fetch. Если вернулась ошибка 404 — событие пересоздаётся через POST.

### extendedProperties

Это скрытые метаданные события в Google Calendar:
```json
{
  "extendedProperties": {
    "private": {
      "taskId": "mq9g9dcbespsoh4jm7s"
    }
  }
}
```
Поле `private` видно только приложению с тем же Client ID. Именно по нему система отличает «свои» события от чужих.

---

## Алгоритм isoWeek

```js
function isoWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay() || 7; // 1=Пн, 7=Вс
  d.setDate(d.getDate() + 4 - day); // переходим к четвергу
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
```

Формат `"2026-W24"` удобен для лексикографического сравнения: `"2026-W23" < "2026-W24"` работает как строковое сравнение.

---

## localStorage — что, где, как чистить

| Ключ | Очистить через | Когда нужно |
|------|---------------|------------|
| `tasks_v2` | DevTools → Application → Storage | Сброс всех задач |
| `areas_v1` | DevTools → Application → Storage | Сброс направлений |
| `gcal_config` | Кнопка «Отключить» в модале 📅 | Отвязать Calendar |
| `lastNotifCheck` | DevTools → Application → Storage | Сброс уведомлений |

Все ключи очищаются через Safari: Разработка → Показать инспектор ресурсов → Storage → Local Storage → localhost:8080.

---

## Известные ограничения

- **Один пользователь на браузер** — localStorage не разделяет сессии разных пользователей.
- **Нет offline-sync** — если дашборд был закрыт пока в Calendar что-то менялось, изменения подхватятся при следующем `syncFull()`.
- **OAuth в тестовом режиме** — пока приложение в Google Cloud Console в статусе «Тестирование», нужно вручную добавлять каждого пользователя в Test Users. Максимум 100 тест-пользователей.
- **Токен живёт 1 час** — если пользователь оставил страницу открытой и через час нажал 🔄, появится попап авторизации.
- **Safari + попапы** — для Safari нужно вручную разрешить попапы для localhost в настройках браузера.

---

## Как добавить новую функцию без поломки совместимости

1. Новые поля задачи всегда добавляй с дефолтом через миграцию в `loadTasks()`
2. Не переименовывай существующие поля задачи — только добавляй
3. Если меняешь формат экспорта — увеличь `version` в JSON и добавь ветку обработки в `handleImportFile()`
4. Ключи localStorage (`tasks_v2`, `areas_v1`) меняй только если меняется структура коренным образом — тогда добавь миграцию из старого ключа в новый

---

## Идеи для будущих версий

- Поддержка Windows (заменить `launch.command` на `.bat` или `.ps1`)
- Тёмная тема
- Экспорт в CSV для Excel
- Повторяющиеся задачи
- Несколько досок (разные файлы localStorage)
- Синхронизация через Яндекс Диск / iCloud (WebDAV)
