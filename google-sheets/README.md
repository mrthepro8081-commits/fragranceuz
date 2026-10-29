# Client database in Google Sheets

The shop writes every order request and client into a Google Sheet on the owner's own Google account.
Nothing goes through third-party services: the sheet runs `Code.gs` (Google Apps Script), and only the
shop knows the private link.

**Tabs it keeps up to date**

| «Заявки» (one row per request) | «Клиенты» (one row per phone number) |
|---|---|
| Дата, Номер, Статус, Имя, Телефон, Telegram, Адрес, Товары, Флаконов, Сумма, Комментарий, Язык | Имя, Телефон, Telegram, Адрес, Заявок, Сумма заявок, Выполнено на сумму, Первая / последняя заявка, Последний статус, Последний комментарий |

A status change (✅ in Telegram or in the admin) updates the same row. Cancelled requests are not counted in the client's total.

**Setup (once, about 5 minutes, easiest on a computer)** — the admin shows the same steps under Settings → Google Таблица клиентов:

1. Open https://sheets.new on your Google account and name the sheet, e.g. «Fragrance UZ — клиенты».
2. Extensions → Apps Script. Delete the sample code, paste all of `Code.gs` (admin: «Скопировать скрипт»), press Save.
3. Reload the sheet. A **Fragrance UZ** menu appears → «1. Подготовить таблицу». Google asks for permission: choose your account → Advanced → Go to project → Allow. (It is your own script, so Google shows the "unverified app" screen.)
4. In Apps Script: Deploy → New deployment → type **Web app**, Execute as **Me**, Who has access **Anyone** → Deploy.
5. Back in the sheet: Fragrance UZ → «2. Показать ссылку для магазина». Copy the link.
6. Admin → Settings → Google Таблица клиентов → paste → Подключить → confirm. The shop tests the link before saving.
7. Press «Выгрузить всех клиентов» once to add everyone who ordered before the sheet was connected.

"Anyone" access only means the web app accepts requests; without the private key in the link it refuses
them, and the link is stored on the server, never sent to customers. If you ever need a new key, delete the
`KEY` script property (Apps Script → Project settings) and run «1. Подготовить таблицу» again, then paste the new link.
