/**
 * test_dates.js — тесты функций работы с датами из dashboard.html
 *
 * Запуск: TZ=Europe/Moscow node test_dates.js
 *
 * Имитируем UTC+3 (Москва) + критическое время 01:30 ночи —
 * именно тогда UTC дата = вчера, и баг проявлялся бы в рантайме.
 */

// ════════════════════════════════════════
// ИСПРАВЛЕННЫЕ ВЕРСИИ (из dashboard.html)
// ════════════════════════════════════════

function todayStr_FIXED() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function gcalAddDay_FIXED(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function gcalLocalISO_FIXED(d) {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const hh = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0');
  const mm = String(Math.abs(off) % 60).padStart(2, '0');
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` +
    `T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}${sign}${hh}:${mm}`;
}

function exportDateStr_FIXED() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ════════════════════════════════════════
// СТАРЫЕ БАГОВАННЫЕ ВЕРСИИ (для сравнения)
// ════════════════════════════════════════

function todayStr_BUGGY() {
  const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
  return TODAY.toISOString().slice(0, 10);
}

function gcalAddDay_BUGGY(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function exportDateStr_BUGGY() {
  return new Date().toISOString().slice(0, 10);
}

// ════════════════════════════════════════
// ВСПОМОГАТЕЛЬНОЕ: мок Date на конкретное UTC-время
// ════════════════════════════════════════

function withMockedDate(utcIso, fn) {
  const OriginalDate = global.Date;
  const fixed = new OriginalDate(utcIso);

  class MockDate extends OriginalDate {
    constructor(...args) {
      if (args.length === 0) {
        super(utcIso);
      } else {
        super(...args);
      }
    }
    static now() { return fixed.getTime(); }
  }

  global.Date = MockDate;
  try {
    return fn();
  } finally {
    global.Date = OriginalDate;
  }
}

// ════════════════════════════════════════
// TEST RUNNER
// ════════════════════════════════════════

let passed = 0;
let failed = 0;

function assert(description, actual, expected) {
  if (actual === expected) {
    console.log(`  ✅  ${description}`);
    passed++;
  } else {
    console.log(`  ❌  ${description}`);
    console.log(`       Ожидалось: ${expected}`);
    console.log(`       Получено:  ${actual}`);
    failed++;
  }
}

function assertContains(description, actual, substr) {
  if (actual.includes(substr)) {
    console.log(`  ✅  ${description}`);
    passed++;
  } else {
    console.log(`  ❌  ${description}`);
    console.log(`       Строка "${substr}" не найдена в: ${actual}`);
    failed++;
  }
}

function assertNotEqual(description, actual, notExpected) {
  if (actual !== notExpected) {
    console.log(`  ✅  ${description}`);
    passed++;
  } else {
    console.log(`  ❌  ${description} — значение совпало: ${actual}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

// ════════════════════════════════════════
// ENVIRONMENT INFO
// ════════════════════════════════════════

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const offset = -new Date().getTimezoneOffset() / 60;
console.log('\n════════════════════════════════════════');
console.log('  ТЕСТЫ ДАТ — Канбан-дашборд');
console.log('════════════════════════════════════════');
console.log(`  Timezone: ${tz}  (UTC${offset >= 0 ? '+' : ''}${offset})`);

if (tz !== 'Europe/Moscow') {
  console.log('\n  ⚠️  Запусти с TZ=Europe/Moscow node test_dates.js');
  console.log('     Иначе UTC+3-специфичные тесты не проявят баг.\n');
}

// ════════════════════════════════════════
// 1. todayStr()
// ════════════════════════════════════════

section('1. todayStr() — дата текущего дня');

// Критический кейс: 01:30 ночи по Москве (UTC = 22:30 предыдущего дня)
// В UTC+3: сейчас 14 июня 01:30 → UTC = 13 июня 22:30 → баг выдаёт 2026-06-13
const nightMoscow = '2026-06-13T22:30:00.000Z'; // = 2026-06-14 01:30 по Москве
withMockedDate(nightMoscow, () => {
  const fixed  = todayStr_FIXED();
  const buggy  = todayStr_BUGGY();
  assert('ИСПРАВЛЕНО: возвращает 2026-06-14 (локальная дата)', fixed, '2026-06-14');
  assertNotEqual('СТАРЫЙ КОД: возвращал бы НЕ 2026-06-14 при UTC+3 ночью', buggy, '2026-06-14');
});

// Безопасный кейс: днём (12:00 Москвы = 09:00 UTC) — обе версии должны совпадать
const dayMoscow = '2026-06-14T09:00:00.000Z'; // = 2026-06-14 12:00 по Москве
withMockedDate(dayMoscow, () => {
  const fixed = todayStr_FIXED();
  assert('ИСПРАВЛЕНО: в 12:00 тоже возвращает 2026-06-14', fixed, '2026-06-14');
});

// ════════════════════════════════════════
// 2. gcalAddDay()
// ════════════════════════════════════════

section('2. gcalAddDay() — следующий день для end.date в Calendar');

// Для всесуточного события 14 июня end.date должен быть 15 июня
// Баг: new Date('2026-06-14T00:00:00') в UTC+3 = 2026-06-13T21:00:00Z
//      toISOString().slice(0,10) → '2026-06-13' (неверно!)
// Верно: нужен '2026-06-15'

withMockedDate(dayMoscow, () => {
  assert('ИСПРАВЛЕНО: gcalAddDay("2026-06-14") → 2026-06-15', gcalAddDay_FIXED('2026-06-14'), '2026-06-15');
  assertNotEqual('СТАРЫЙ КОД: выдавал бы НЕ 2026-06-15 при UTC+3',     gcalAddDay_BUGGY('2026-06-14'), '2026-06-15');
});

// Граничный кейс: конец месяца
withMockedDate(dayMoscow, () => {
  assert('Конец месяца: gcalAddDay("2026-06-30") → 2026-07-01', gcalAddDay_FIXED('2026-06-30'), '2026-07-01');
});

// Конец года
withMockedDate(dayMoscow, () => {
  assert('Конец года: gcalAddDay("2026-12-31") → 2027-01-01',  gcalAddDay_FIXED('2026-12-31'), '2027-01-01');
});

// ════════════════════════════════════════
// 3. exportDateStr() — имя файла бэкапа
// ════════════════════════════════════════

section('3. exportDateStr() — дата в имени файла бэкапа');

withMockedDate(nightMoscow, () => {
  const fixed = exportDateStr_FIXED();
  const buggy = exportDateStr_BUGGY();
  assert('ИСПРАВЛЕНО: имя файла содержит локальную дату 2026-06-14', fixed, '2026-06-14');
  assertNotEqual('СТАРЫЙ КОД: имя файла содержало бы UTC-дату (2026-06-13)', buggy, '2026-06-14');
});

// ════════════════════════════════════════
// 4. gcalLocalISO() — окно синхронизации
// ════════════════════════════════════════

section('4. gcalLocalISO() — RFC3339 строка с локальным смещением');

// Понедельник 00:00 Москвы
const mondayMidnightMoscow = new Date('2026-06-15T21:00:00.000Z'); // = 2026-06-16 00:00 MSK (понедельник)

const isoStr = gcalLocalISO_FIXED(mondayMidnightMoscow);
assert('Содержит дату понедельника 2026-06-16',           true, isoStr.startsWith('2026-06-16'));
assertContains('Содержит локальное время 00:00:00',      isoStr, 'T00:00:00');
assertContains('Содержит смещение +03:00',               isoStr, '+03:00');

// Итог — НЕТ суффикса Z (UTC)
assert('Не содержит "Z" (UTC)',  isoStr.endsWith('Z'), false);

// ════════════════════════════════════════
// ИТОГ
// ════════════════════════════════════════

console.log('\n════════════════════════════════════════');
console.log(`  Результат: ${passed} прошло, ${failed} не прошло`);
console.log('════════════════════════════════════════\n');
process.exit(failed > 0 ? 1 : 0);
