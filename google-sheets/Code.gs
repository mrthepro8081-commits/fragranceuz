/**
 * Fragrance UZ — client database in Google Sheets.
 *
 * Paste this whole file into the sheet's Extensions → Apps Script editor, then follow the
 * steps in google-sheets/README.md (or the "Google Sheets" card in the shop's admin settings).
 * The shop sends every order request here; this script keeps two tabs up to date:
 *   «Заявки»  – one row per order request (status changes update the same row)
 *   «Клиенты» – one row per client (by phone number) with contacts and totals
 */

var ORDERS = 'Заявки';
var CLIENTS = 'Клиенты';
var ORDER_HEADERS = ['Дата', 'Номер', 'Статус', 'Имя', 'Телефон', 'Telegram', 'Адрес', 'Товары', 'Флаконов', 'Сумма, сум', 'Комментарий', 'Язык', 'ID заявки'];
var CLIENT_HEADERS = ['Имя', 'Телефон', 'Telegram', 'Адрес', 'Заявок', 'Сумма заявок, сум', 'Выполнено на сумму, сум', 'Первая заявка', 'Последняя заявка', 'Последний статус', 'Последний комментарий'];
var STATUS = { new: 'Новая', confirmed: 'Подтверждена', completed: 'Выполнена', cancelled: 'Отменена' };

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Fragrance UZ')
    .addItem('1. Подготовить таблицу', 'setup')
    .addItem('2. Показать ссылку для магазина', 'showLink')
    .addToUi();
}

/** Creates both tabs with headers and a private key the shop must present. Safe to run again. */
function setup() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  prepare(book, ORDERS, ORDER_HEADERS);
  prepare(book, CLIENTS, CLIENT_HEADERS);
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('KEY')) props.setProperty('KEY', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''));
  SpreadsheetApp.getUi().alert('Таблица готова.\n\nТеперь: Развернуть → Новое развёртывание → Веб-приложение,\n«Запуск от имени»: Я, «Доступ»: Все.\nЗатем меню Fragrance UZ → «Показать ссылку для магазина».');
}

function showLink() {
  var key = PropertiesService.getScriptProperties().getProperty('KEY');
  var url = ScriptApp.getService().getUrl();
  if (!key) return SpreadsheetApp.getUi().alert('Сначала выполните «1. Подготовить таблицу».');
  if (!url) return SpreadsheetApp.getUi().alert('Сначала разверните скрипт как веб-приложение: Развернуть → Новое развёртывание → Веб-приложение.');
  var html = HtmlService.createHtmlOutput(
    '<p style="font:14px sans-serif">Скопируйте ссылку и вставьте её в админке магазина: Настройки → Google Таблица.</p>' +
      '<textarea style="width:100%;height:90px;font:13px monospace" readonly onclick="this.select()">' + url + '?key=' + key + '</textarea>'
  ).setWidth(460).setHeight(200);
  SpreadsheetApp.getUi().showModalDialog(html, 'Ссылка для магазина');
}

function doPost(e) {
  var key = PropertiesService.getScriptProperties().getProperty('KEY');
  if (!key || !e || !e.parameter || e.parameter.key !== key) return reply({ ok: false, error: 'bad key' });
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var input = JSON.parse(e.postData.contents);
    var book = SpreadsheetApp.getActiveSpreadsheet();
    return reply(handle(book, input));
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Pure sheet logic, kept separate from the web layer so it can be tested. */
function handle(book, input) {
  var orders = prepare(book, ORDERS, ORDER_HEADERS);
  var clients = prepare(book, CLIENTS, CLIENT_HEADERS);
  if (input.event === 'test') return { ok: true, orders: Math.max(0, orders.getLastRow() - 1) };
  var list = input.event === 'bulk' ? input.orders : [input.order];
  var rows = read(orders, ORDER_HEADERS.length);
  var index = {};
  rows.forEach(function (r, i) { index[r[12]] = i; });
  list.forEach(function (o) {
    var row = orderRow(o);
    if (index[o.id] === undefined) {
      index[o.id] = rows.length;
      rows.push(row);
    } else rows[index[o.id]] = row;
  });
  rows.sort(function (a, b) { return a[0] - b[0]; });
  write(orders, rows, ORDER_HEADERS.length);
  write(clients, clientRows(rows), CLIENT_HEADERS.length);
  return { ok: true, orders: rows.length };
}

function orderRow(o) {
  var d = o.data, c = d.customer;
  var items = d.items.map(function (i) { return i.brand + ' — ' + i.name + ' · ' + i.label + ' × ' + i.quantity; }).join('\n');
  var bottles = d.items.reduce(function (n, i) { return n + i.quantity; }, 0);
  var telegram = d.telegram && d.telegram.username ? '@' + d.telegram.username : d.telegram ? 'id ' + d.telegram.id : '';
  return [new Date(o.createdAt), '#' + o.id.slice(0, 8), STATUS[o.status] || o.status, c.name, "'" + c.phone, telegram, c.address, items, bottles, d.total, c.note || '', d.language || 'ru', o.id];
}

/** One row per phone number, newest client first. */
function clientRows(orders) {
  var byPhone = {};
  orders.forEach(function (r) {
    var phone = String(r[4]).replace(/[^\d+]/g, '');
    var c = byPhone[phone] || (byPhone[phone] = { first: r[0], count: 0, value: 0, done: 0 });
    c.count++;
    if (r[2] !== STATUS.cancelled) c.value += Number(r[9]) || 0;
    if (r[2] === STATUS.completed) c.done += Number(r[9]) || 0;
    if (r[0] < c.first) c.first = r[0];
    if (!c.last || r[0] >= c.last.date) c.last = { date: r[0], row: r };
  });
  return Object.keys(byPhone)
    .map(function (k) {
      var c = byPhone[k], r = c.last.row;
      return [r[3], r[4], r[5], r[6], c.count, c.value, c.done, c.first, c.last.date, r[2], r[10]];
    })
    .sort(function (a, b) { return b[8] - a[8]; });
}

function prepare(book, name, headers) {
  var sheet = book.getSheetByName(name) || book.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#4f0f15').setFontColor('#e8cf91');
    sheet.setFrozenRows(1);
  }
  return sheet;
}
function read(sheet, width) {
  var last = sheet.getLastRow();
  return last < 2 ? [] : sheet.getRange(2, 1, last - 1, width).getValues();
}
function write(sheet, rows, width) {
  var last = sheet.getLastRow();
  if (last > 1) sheet.getRange(2, 1, last - 1, width).clearContent();
  if (!rows.length) return;
  sheet.getRange(2, 1, rows.length, width).setValues(rows);
  var money = sheet === sheet.getParent().getSheetByName(ORDERS) ? [10] : [6, 7];
  money.forEach(function (col) { sheet.getRange(2, col, rows.length, 1).setNumberFormat('#,##0'); });
  var dates = sheet.getName() === ORDERS ? [1] : [8, 9];
  dates.forEach(function (col) { sheet.getRange(2, col, rows.length, 1).setNumberFormat('dd.MM.yyyy HH:mm'); });
}
function reply(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

if (typeof module !== 'undefined') module.exports = { handle: handle, ORDER_HEADERS: ORDER_HEADERS, CLIENT_HEADERS: CLIENT_HEADERS };
