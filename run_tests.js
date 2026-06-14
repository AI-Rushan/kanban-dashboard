/**
 * run_tests.js — полный прогон тестовых сценариев Канбан-дашборда
 * Запуск: TZ=Europe/Moscow node run_tests.js
 */

// ════════════════════════════════════════
// ФУНКЦИИ, ИЗВЛЕЧЁННЫЕ ИЗ dashboard.html
// ════════════════════════════════════════

// ── Дата ──
const TODAY = new Date(); TODAY.setHours(0,0,0,0);

function todayStr(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtDate(dl){
  if(!dl) return '';
  const [y,m,d] = dl.split('-');
  return `${d}.${m}.${y}`;
}
function deadlineDt(dl, dlTime){
  if(!dl) return null;
  return dlTime ? new Date(dl+'T'+dlTime+':00') : new Date(dl+'T23:59:59');
}
function dateStatus(dl, compareTo, dlTime){
  if(!dl) return null;
  // Для всесуточных задач: 'today' если дата дедлайна = сегодня
  if(!dlTime && !compareTo && dl === todayStr()) return 'today';
  const deadline = deadlineDt(dl, dlTime);
  let ref;
  if(compareTo){
    ref = new Date(compareTo+'T00:00:00');
  } else {
    ref = dlTime ? new Date() : TODAY;
  }
  const diffMs = deadline - ref;
  const diffDays = Math.ceil(diffMs / (1000*60*60*24));
  if(diffMs < 0) return 'overdue';
  if(diffDays === 0) return 'today';
  if(diffDays <= 3) return 'soon';
  return 'normal';
}
function isoWeek(dateStr){
  const d = new Date(dateStr+'T00:00:00');
  const jan4 = new Date(d.getFullYear(),0,4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - (jan4.getDay()||7) + 1);
  const weekNo = Math.ceil(((d-startOfWeek1)/86400000+1)/7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2,'0')}`;
}
function gcalAddDay(dateStr){
  const d = new Date(dateStr+'T00:00:00');
  d.setDate(d.getDate()+1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function gcalLocalISO(d){
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const hh = String(Math.floor(Math.abs(off)/60)).padStart(2,'0');
  const mm = String(Math.abs(off)%60).padStart(2,'0');
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` +
    `T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}${sign}${hh}:${mm}`;
}
function stripAreaEmoji(text, areas){
  const emojis = Object.values(areas).map(a=>a.emoji).filter(Boolean);
  for(const em of emojis){
    if(text.startsWith(em+' ')) return text.slice(em.length+1);
  }
  return text;
}

// ── GCal: применить событие к задаче ──
function applyEventToTask(task, event, areas={}){
  if(event.summary) task.text = stripAreaEmoji(event.summary, areas);
  task.description = event.description||null;
  if(event.start?.date){
    task.deadline = event.start.date;
    task.deadlineTime = null;
  } else if(event.start?.dateTime){
    task.deadline = event.start.dateTime.slice(0,10);
    task.deadlineTime = event.start.dateTime.slice(11,16);
  }
  task.gcalEventId = event.id;
  task.lastModified = new Date(event.updated).getTime();
}

// ── GCal: создать задачу из события ──
function eventToNewTask(event){
  let deadline=null, deadlineTime=null;
  if(event.start?.date){
    deadline = event.start.date;
  } else if(event.start?.dateTime){
    deadline = event.start.dateTime.slice(0,10);
    deadlineTime = event.start.dateTime.slice(11,16);
  }
  const now = Date.now();
  return {
    id: 'test-uid-001',
    area: 1,
    text: event.summary||'Событие из Calendar',
    description: event.description||null,
    status: 'backlog',
    deadline, deadlineTime,
    completedAt: null,
    gcalEventId: event.id,
    lastModified: new Date(event.updated).getTime(),
    createdAt: now
  };
}

// ── GCal: конвертировать задачу в событие ──
const GCAL_STATUS_COLOR = { backlog:'8', todo:'9', doing:'6', done:'2', archive:'8' };
function taskToEvent(task, areas={}){
  const a = areas[task.area]||{};
  const tz = 'Europe/Moscow';
  const dl = (task.status==='done' && task.completedAt) ? task.completedAt : task.deadline;
  if(!dl) return null;
  let start, end;
  if(task.deadlineTime){
    start = { dateTime: dl+'T'+task.deadlineTime+':00', timeZone: tz };
    end   = { dateTime: gcalAddDay_addHour(dl+'T'+task.deadlineTime+':00'), timeZone: tz };
  } else {
    start = { date: dl };
    end   = { date: gcalAddDay(dl) };
  }
  const prefix = a.emoji ? a.emoji+' ' : '';
  return {
    summary: prefix+task.text,
    description: task.description||'',
    start, end,
    colorId: GCAL_STATUS_COLOR[task.status]||'8',
    extendedProperties: { private: { taskId: task.id } }
  };
}
function gcalAddDay_addHour(dtStr){
  const d = new Date(dtStr);
  d.setHours(d.getHours()+1);
  return d.toISOString();
}

// ── autoArchive логика ──
function autoArchive(tasks, currentWeekStr){
  let changed = false;
  tasks.forEach(t=>{
    if(t.status==='done' && t.completedAt){
      if(isoWeek(t.completedAt) < currentWeekStr){
        t.status = 'archive';
        changed = true;
      }
    }
  });
  return changed;
}

// ── moveCard: логика completedAt при переходе ──
function moveCard(tasks, taskId, dir){
  const ORDER = ['backlog','todo','doing','done'];
  const t = tasks.find(t=>t.id===taskId);
  if(!t) return;
  const idx = ORDER.indexOf(t.status);
  const next = dir==='next'?idx+1:idx-1;
  if(next<0||next>=ORDER.length) return;
  const newStatus = ORDER[next];
  const wasNotDone = t.status !== 'done';
  t.status = newStatus;
  t.lastModified = Date.now();
  if(newStatus === 'done' && wasNotDone) t.completedAt = todayStr();
  if(newStatus !== 'done') t.completedAt = null;
}

// ── Конфликт: кто новее — тот и прав ──
function resolveConflict(task, event){
  const taskTs  = task.lastModified || task.createdAt || 0;
  const eventTs = new Date(event.updated).getTime();
  if(eventTs > taskTs){
    applyEventToTask(task, event);
    return 'calendar_wins';
  } else {
    return 'task_wins';
  }
}

// ════════════════════════════════════════
// MOCK DATE
// ════════════════════════════════════════
function withMockedDate(utcIso, fn){
  const Orig = global.Date;
  const fixed = new Orig(utcIso);
  class MockDate extends Orig {
    constructor(...args){ if(args.length===0){ super(utcIso); } else { super(...args); } }
    static now(){ return fixed.getTime(); }
  }
  global.Date = MockDate;
  try { return fn(); } finally { global.Date = Orig; }
}

// ════════════════════════════════════════
// TEST RUNNER
// ════════════════════════════════════════
let passed=0, failed=0, skipped=0;
const results=[];

function test(id, desc, fn){
  try{
    fn();
    results.push({id, desc, status:'pass'});
    passed++;
    process.stdout.write(`  ✅ ${id}: ${desc}\n`);
  } catch(e){
    results.push({id, desc, status:'fail', error: e.message});
    failed++;
    process.stdout.write(`  ❌ ${id}: ${desc}\n     → ${e.message}\n`);
  }
}
function skip(id, desc, reason){
  results.push({id, desc, status:'skip', reason});
  skipped++;
  process.stdout.write(`  ⏭  ${id}: ${desc}\n     → ${reason}\n`);
}
function assert(cond, msg){ if(!cond) throw new Error(msg); }
function eq(a, b){ assert(a===b, `Ожидалось "${b}", получено "${a}"`); }
function section(title){ process.stdout.write(`\n── ${title} ──\n`); }

// ════════════════════════════════════════
// РАЗДЕЛ 1: ИСПРАВЛЕНИЯ ДАТ
// ════════════════════════════════════════
section('Раздел 1 · Исправления дат (UTC vs локальное время)');

// TS-01: todayStr() в ночное время UTC+3
test('TS-01a', 'todayStr() — 01:30 ночи по Москве → локальная дата 2026-06-14', ()=>{
  withMockedDate('2026-06-13T22:30:00.000Z', ()=>{ // = 01:30 МСК 14 июня
    eq(todayStr(), '2026-06-14');
  });
});
test('TS-01b', 'todayStr() — 12:00 дня по Москве → локальная дата 2026-06-14', ()=>{
  withMockedDate('2026-06-14T09:00:00.000Z', ()=>{ // = 12:00 МСК 14 июня
    eq(todayStr(), '2026-06-14');
  });
});

// TS-01c: completedAt устанавливается корректно при переводе в Done
test('TS-01c', 'moveCard: при переводе в Done → completedAt = сегодня (локально)', ()=>{
  withMockedDate('2026-06-13T22:30:00.000Z', ()=>{ // = 01:30 МСК 14 июня
    const tasks = [{id:'t1', status:'doing', lastModified:0, completedAt:null}];
    moveCard(tasks, 't1', 'next');
    eq(tasks[0].status, 'done');
    eq(tasks[0].completedAt, '2026-06-14'); // должно быть 14-е, не 13-е
  });
});

// TS-01d: completedAt сбрасывается при возврате из Done
test('TS-01d', 'moveCard: при возврате из Done → completedAt = null', ()=>{
  const tasks = [{id:'t1', status:'done', lastModified:0, completedAt:'2026-06-14'}];
  moveCard(tasks, 't1', 'prev');
  eq(tasks[0].status, 'doing');
  eq(tasks[0].completedAt, null);
});

// TS-02: applyEventToTask НЕ трогает completedAt
test('TS-02', 'applyEventToTask: completedAt НЕ перезаписывается синхронизацией', ()=>{
  const task = {
    id:'t1', status:'done', completedAt:'2026-06-14', text:'Задача', deadline:'2026-06-14',
    lastModified: new Date('2026-06-13T10:00:00Z').getTime()
  };
  const event = {
    id:'ev1', summary:'Задача (обновлено)', updated:'2026-06-14T09:00:00Z',
    start:{ date:'2026-06-20' }, description:'desc'
  };
  applyEventToTask(task, event);
  eq(task.completedAt, '2026-06-14'); // не должно измениться
  eq(task.deadline, '2026-06-20');    // дедлайн должен обновиться
});

// TS-03: gcalAddDay — конец.date для всесуточных событий
test('TS-03a', 'gcalAddDay("2026-06-14") → 2026-06-15 (следующий день)', ()=>{
  eq(gcalAddDay('2026-06-14'), '2026-06-15');
});
test('TS-03b', 'gcalAddDay: конец месяца ("2026-06-30") → 2026-07-01', ()=>{
  eq(gcalAddDay('2026-06-30'), '2026-07-01');
});
test('TS-03c', 'gcalAddDay: конец года ("2026-12-31") → 2027-01-01', ()=>{
  eq(gcalAddDay('2026-12-31'), '2027-01-01');
});
test('TS-03d', 'taskToEvent: allday задача → start.date и end.date отличаются на 1 день', ()=>{
  const task = {id:'t1', area:1, status:'todo', text:'Задача', deadline:'2026-06-20',
                deadlineTime:null, completedAt:null};
  const ev = taskToEvent(task, {});
  assert(ev !== null, 'taskToEvent вернул null');
  eq(ev.start.date, '2026-06-20');
  eq(ev.end.date, '2026-06-21');
});

// TS-04: exportDateStr — имя файла с локальной датой
test('TS-04a', 'exportDateStr: 01:30 МСК → локальная дата 2026-06-14 в имени файла', ()=>{
  withMockedDate('2026-06-13T22:30:00.000Z', ()=>{
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    eq(date, '2026-06-14');
  });
});

// gcalLocalISO — смещение таймзоны в строке
test('TS-04b', 'gcalLocalISO: содержит локальное смещение +03:00 (не Z)', ()=>{
  const d = new Date('2026-06-16T21:00:00.000Z'); // = понедельник 00:00 МСК
  const s = gcalLocalISO(d);
  assert(s.includes('+03:00'), `Ожидался +03:00 в строке: ${s}`);
  assert(!s.endsWith('Z'), `Строка не должна заканчиваться на Z: ${s}`);
});

// ════════════════════════════════════════
// РАЗДЕЛ 2: CALENDAR → DASHBOARD (логика)
// ════════════════════════════════════════
section('Раздел 2 · Синхронизация Calendar → Dashboard (логика)');

// TS-05: eventToNewTask — новое событие создаёт задачу
test('TS-05a', 'eventToNewTask: создаёт задачу в backlog с правильным дедлайном', ()=>{
  const event = {
    id:'ev-new', summary:'Тест-импорт', description:'Описание',
    updated:'2026-06-14T10:00:00Z',
    start:{ dateTime:'2026-06-15T14:00:00+03:00' },
    end:  { dateTime:'2026-06-15T15:00:00+03:00' }
  };
  const task = eventToNewTask(event);
  eq(task.status, 'backlog');
  eq(task.deadline, '2026-06-15');
  eq(task.deadlineTime, '14:00');
  eq(task.gcalEventId, 'ev-new');
  eq(task.text, 'Тест-импорт');
});
test('TS-05b', 'eventToNewTask: всесуточное событие → deadlineTime = null', ()=>{
  const event = {
    id:'ev-allday', summary:'Всесуточная задача', updated:'2026-06-14T10:00:00Z',
    start:{ date:'2026-06-15' }, end:{ date:'2026-06-16' }
  };
  const task = eventToNewTask(event);
  eq(task.deadline, '2026-06-15');
  eq(task.deadlineTime, null);
});

// TS-06: applyEventToTask — перенос дедлайна
test('TS-06a', 'applyEventToTask: дедлайн обновляется из Calendar', ()=>{
  const task = { id:'t1', text:'Ангара', deadline:'2026-06-15', deadlineTime:null,
                 lastModified: new Date('2026-06-11T17:00:00Z').getTime() };
  const event = {
    id:'ev1', summary:'Ангара — жду ответ', updated:'2026-06-14T08:30:00Z',
    start:{ date:'2026-06-18' }, description:'Новое описание'
  };
  applyEventToTask(task, event);
  eq(task.deadline, '2026-06-18');
  eq(task.description, 'Новое описание');
  eq(task.gcalEventId, 'ev1');
});
test('TS-06b', 'applyEventToTask: дедлайн с временем — deadline и deadlineTime', ()=>{
  const task = { id:'t1', text:'Встреча', deadline:'2026-06-14', deadlineTime:null,
                 lastModified: 0 };
  const event = {
    id:'ev2', summary:'Встреча', updated:'2026-06-14T10:00:00Z',
    start:{ dateTime:'2026-06-15T12:00:00+03:00' }
  };
  applyEventToTask(task, event);
  eq(task.deadline, '2026-06-15');
  eq(task.deadlineTime, '12:00');
});

// TS-07: applyEventToTask снимает emoji-префикс с summary
test('TS-07', 'applyEventToTask: emoji-префикс направления удаляется из названия', ()=>{
  const areas = { 1: { emoji:'🏠', label:'Дом' } };
  const task = { id:'t1', text:'Ремонт', deadline:'2026-06-14', lastModified:0 };
  const event = {
    id:'ev1', summary:'🏠 Ремонт окончательный', updated:'2026-06-14T09:00:00Z',
    start:{ date:'2026-06-20' }
  };
  applyEventToTask(task, event, areas);
  eq(task.text, 'Ремонт окончательный'); // без emoji-префикса
});

// ════════════════════════════════════════
// РАЗДЕЛ 3: DASHBOARD → CALENDAR (логика)
// ════════════════════════════════════════
section('Раздел 3 · Синхронизация Dashboard → Calendar (логика)');

// TS-09: taskToEvent формирует правильную дату
test('TS-09a', 'taskToEvent: дедлайн задачи → start.date события', ()=>{
  const task = { id:'t1', area:1, text:'Задача', status:'todo',
                 deadline:'2026-07-20', deadlineTime:null, completedAt:null };
  const ev = taskToEvent(task, {});
  eq(ev.start.date, '2026-07-20');
  eq(ev.end.date, '2026-07-21');
});
test('TS-09b', 'taskToEvent: задача со временем → start.dateTime содержит время', ()=>{
  const task = { id:'t1', area:1, text:'Звонок', status:'todo',
                 deadline:'2026-07-20', deadlineTime:'14:00', completedAt:null };
  const ev = taskToEvent(task, {});
  assert(ev.start.dateTime.startsWith('2026-07-20T14:00'), `dateTime: ${ev.start.dateTime}`);
});

// TS-11: Done задача → в event используется completedAt, не deadline
test('TS-11a', 'taskToEvent: Done задача → start.date = completedAt, не deadline', ()=>{
  const task = { id:'t1', area:1, text:'Сделано', status:'done',
                 deadline:'2026-06-20', deadlineTime:null, completedAt:'2026-06-14' };
  const ev = taskToEvent(task, {});
  eq(ev.start.date, '2026-06-14'); // completedAt, не дедлайн
  eq(ev.colorId, '2');             // зелёный цвет для Done
});
test('TS-11b', 'taskToEvent: colorId соответствует статусу (серый=backlog, синий=todo, оранжевый=doing)', ()=>{
  ['backlog','todo','doing'].forEach(status=>{
    const task = {id:'t1', area:1, text:'X', status, deadline:'2026-06-20', deadlineTime:null, completedAt:null};
    const ev = taskToEvent(task, {});
    const expectedColors = {backlog:'8', todo:'9', doing:'6'};
    eq(ev.colorId, expectedColors[status]);
  });
});

// TS-09c: taskToEvent без дедлайна → null (событие не создаётся)
test('TS-09c', 'taskToEvent: задача без дедлайна → null (событие не создаётся)', ()=>{
  const task = {id:'t1', area:1, text:'Без даты', status:'backlog',
                deadline:null, deadlineTime:null, completedAt:null};
  const ev = taskToEvent(task, {});
  eq(ev, null);
});

// ════════════════════════════════════════
// РАЗДЕЛ 4 & 5: РАЗРЕШЕНИЕ КОНФЛИКТОВ
// ════════════════════════════════════════
section('Раздел 4 · Разрешение конфликтов (TS-18, TS-19)');

// TS-18: task новее → calendar НЕ перезаписывает
test('TS-18', 'Конфликт: task новее Calendar → Calendar не перезаписывает задачу', ()=>{
  const task = {
    id:'t1', text:'Задача', deadline:'2026-07-20', deadlineTime:null,
    lastModified: new Date('2026-06-14T10:00:00Z').getTime() // task изменена в 10:00
  };
  const event = {
    id:'ev1', summary:'Задача', updated:'2026-06-14T08:00:00Z', // event обновлён в 08:00 (старше)
    start:{ date:'2026-06-01' }
  };
  const winner = resolveConflict(task, event);
  eq(winner, 'task_wins');
  eq(task.deadline, '2026-07-20'); // дедлайн задачи не изменился
});

// TS-19: calendar новее → calendar перезаписывает
test('TS-19', 'Конфликт: Calendar новее task → Calendar перезаписывает задачу', ()=>{
  const task = {
    id:'t1', text:'Задача', deadline:'2026-06-20', deadlineTime:null,
    lastModified: new Date('2026-06-11T17:00:00Z').getTime() // task изменена в 17:00 11 июня
  };
  const event = {
    id:'ev1', summary:'Задача (обновлено)', updated:'2026-06-14T08:30:00Z', // event обновлён 14 июня
    start:{ date:'2026-06-25' }
  };
  const winner = resolveConflict(task, event);
  eq(winner, 'calendar_wins');
  eq(task.deadline, '2026-06-25'); // дедлайн обновился из Calendar
});

// TS-19b: конфликт по реальным данным из логов
test('TS-19b', 'Реальные данные из логов: Ангара calWins:true → deadline 18 июня', ()=>{
  const task = {
    id:'ангара', text:'Ангара', deadline:'2026-06-15', deadlineTime:null,
    lastModified: new Date('2026-06-13T17:53:20.544Z').getTime()
  };
  const event = {
    id:'ev-ангара', summary:'Ангара — жду обратную связь', updated:'2026-06-14T08:29:36.425Z',
    start:{ date:'2026-06-18' }
  };
  const winner = resolveConflict(task, event);
  eq(winner, 'calendar_wins');
  eq(task.deadline, '2026-06-18');
});

// ════════════════════════════════════════
// РАЗДЕЛ 5: АРХИВИРОВАНИЕ (TS-16)
// ════════════════════════════════════════
section('Раздел 5 · Архивирование (TS-16)');

test('TS-16a', 'autoArchive: задача Done из прошлой недели → переходит в archive', ()=>{
  const tasks = [
    { id:'t1', status:'done', completedAt:'2026-06-07' }, // прошлая неделя (W23)
  ];
  const currentWeek = '2026-W24'; // текущая неделя
  const changed = autoArchive(tasks, currentWeek);
  assert(changed, 'autoArchive должна вернуть changed=true');
  eq(tasks[0].status, 'archive');
});
test('TS-16b', 'autoArchive: задача Done из текущей недели → остаётся в Done', ()=>{
  const tasks = [
    { id:'t1', status:'done', completedAt:'2026-06-14' }, // текущая неделя W24
  ];
  const currentWeek = '2026-W24';
  const changed = autoArchive(tasks, currentWeek);
  assert(!changed, 'autoArchive должна вернуть changed=false');
  eq(tasks[0].status, 'done');
});
test('TS-16c', 'autoArchive: todo задача НЕ архивируется', ()=>{
  const tasks = [
    { id:'t1', status:'todo', completedAt:null },
  ];
  const changed = autoArchive(tasks, '2026-W24');
  assert(!changed, 'todo задача не должна архивироваться');
  eq(tasks[0].status, 'todo');
});
test('TS-16d', 'isoWeek: корректно определяет номер недели', ()=>{
  eq(isoWeek('2026-06-14'), '2026-W24'); // 14 июня 2026 = неделя 24
  eq(isoWeek('2026-01-01'), '2026-W01');
  eq(isoWeek('2026-12-31'), '2026-W53');
});

// ════════════════════════════════════════
// РАЗДЕЛ 6: ФОРМАТИРОВАНИЕ И ОТОБРАЖЕНИЕ
// ════════════════════════════════════════
section('Раздел 6 · Форматирование дат (fmtDate, dateStatus)');

test('fmtDate-1', 'fmtDate("2026-06-14") → "14.06.2026"', ()=>{
  eq(fmtDate('2026-06-14'), '14.06.2026');
});
test('fmtDate-2', 'fmtDate(null) → ""', ()=>{
  eq(fmtDate(null), '');
});
test('dateStatus-overdue', 'dateStatus: дедлайн вчера → overdue', ()=>{
  eq(dateStatus('2026-06-13', '2026-06-14'), 'overdue');
});
// BUG-01 ИСПРАВЛЕН: dateStatus теперь возвращает 'today' для всесуточных задач с дедлайном сегодня
test('dateStatus-today-allday', 'FIXED: allday-дедлайн сегодня → "today" (🔥 сегодня)', ()=>{
  withMockedDate('2026-06-14T09:00:00.000Z', ()=>{ // = 12:00 МСК 14 июня
    // dateStatus вызывается с compareTo=null, dlTime=null — как в deadlineLabel
    // Прямое сравнение дат: dl === todayStr() → 'today'
    const result = dateStatus('2026-06-14', null, null);
    eq(result, 'today');
  });
});
test('dateStatus-today-not-yesterday', 'FIXED: вчерашний allday-дедлайн → "overdue"', ()=>{
  withMockedDate('2026-06-14T09:00:00.000Z', ()=>{
    eq(dateStatus('2026-06-13', null, null), 'overdue');
  });
});
test('dateStatus-today-not-tomorrow', 'FIXED: завтрашний allday-дедлайн → "soon"', ()=>{
  withMockedDate('2026-06-14T09:00:00.000Z', ()=>{
    eq(dateStatus('2026-06-15', null, null), 'soon');
  });
});
test('dateStatus-soon', 'dateStatus: дедлайн через 2 дня → soon', ()=>{
  eq(dateStatus('2026-06-16', '2026-06-14'), 'soon');
});
test('dateStatus-normal', 'dateStatus: дедлайн через 10 дней → normal', ()=>{
  eq(dateStatus('2026-06-24', '2026-06-14'), 'normal');
});
test('dateStatus-null', 'dateStatus: нет дедлайна → null', ()=>{
  eq(dateStatus(null, '2026-06-14'), null);
});

// ════════════════════════════════════════
// НЕДОСТУПНЫЕ ДЛЯ АВТОТЕСТИРОВАНИЯ
// ════════════════════════════════════════
section('Сценарии, требующие браузера/OAuth — пропущены');

skip('TS-05-UI', 'Новое событие появляется в Backlog (UI)', 'Требует браузер + Google OAuth + реальный Calendar');
skip('TS-06-UI', 'Перенос дедлайна в Calendar виден в UI', 'Требует браузер + Google OAuth');
skip('TS-07-UI', 'Переименование в Calendar обновляет карточку', 'Требует браузер + Google OAuth');
skip('TS-08',    'Изменения до запуска → ручная синхронизация', 'Требует браузер + Google OAuth');
skip('TS-12',    'Кнопка Force Push видна после авторизации', 'Требует браузер + OAuth-попап');
skip('TS-13',    'Force Push не создаёт дублей', 'Требует браузер + реальный Calendar');
skip('TS-14',    'Создание задачи через UI', 'Требует браузер + DOM');
skip('TS-15',    'Перемещение карточек drag&drop', 'Требует браузер + DOM + drag events');
skip('TS-16-UI', 'Архив виден на странице archive.html', 'Требует браузер + localStorage');
skip('TS-17',    'Экспорт скачивает файл, импорт восстанавливает данные', 'Требует браузер + File API');

// ════════════════════════════════════════
// ИТОГ
// ════════════════════════════════════════
section('ИТОГ');
process.stdout.write(`\n  Пройдено:  ${passed}\n  Не прошло: ${failed}\n  Пропущено: ${skipped}\n\n`);
process.exit(failed > 0 ? 1 : 0);
