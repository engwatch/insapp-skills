# Partner Cabinet: МТС Банк — Кабинет партнёра МФО

Личный кабинет для партнёра МТС Банк. Показывает статистику МФО-виджета: открытия, переходы, анкеты, выдачи, доход партнёра, EPC/EPL.

## Стек

- **Backend:** ASP.NET Core 8 (C#), размещён в `tools/mfo-dashboard/`
- **Frontend:** Vanilla JS + CSS (этот каталог)
- **БД:** Microsoft SQL Server (InsappCoreProd), доступ через MCP-прокси `https://db-mcp.insapp.pro/mcp`
- **Формат API:** JSON REST

## Архитектура

Кабинет партнёра — это фронтенд-надстройка над общим MFO Dashboard API. Два файла (`partner-mts.html` + `static/partner-app.js`) добавляются в папку `wwwroot/` основного дашборда.

```
mfo-dashboard/           ← основной бэкенд (tools/mfo-dashboard/)
  wwwroot/
    index.html           ← основной дашборд (внутренний)
    partner-mts.html     ← кабинет партнёра МТС ← ЭТОТ ФАЙЛ
    static/
      app.js             ← JS основного дашборда
      partner-app.js     ← JS кабинета партнёра  ← ЭТОТ ФАЙЛ
      style.css          ← общие стили           ← ЭТОТ ФАЙЛ
```

## Развёртывание

### 1. Убедись что MFO Dashboard развёрнут

Бэкенд в `tools/mfo-dashboard/`. Если не развёрнут:

```bash
cd tools/mfo-dashboard/
dotnet restore
dotnet run --urls="http://localhost:5000"
```

Требования: .NET 8 SDK, доступ к `https://db-mcp.insapp.pro/mcp`.

### 2. Скопируй файлы кабинета партнёра

```bash
cp partner-mts.html ../mfo-dashboard/wwwroot/
cp static/partner-app.js ../mfo-dashboard/wwwroot/static/
cp static/style.css ../mfo-dashboard/wwwroot/static/
```

### 3. Проверь конфигурацию партнёра

В `appsettings.json` дашборда должен быть МТС Банк:

```json
{
  "Partners": {
    "mts": {
      "Id": "477a5c28-4577-4c53-a190-95b8f4ca4b2a",
      "Name": "МТС Банк",
      "Split": 80
    }
  }
}
```

- `Id` — PartnerId из таблицы Partners
- `Split` — процент партнёра от входящей комиссии (80% партнёру, 20% Insapp)

### 4. Открой кабинет

```
http://localhost:5000/partner-mts.html
```

## Отличия от основного дашборда

| Функция | Основной дашборд | Кабинет партнёра |
|---------|------------------|------------------|
| Выбор партнёра | Мультиселект | Захардкожен (МТС) |
| Режим МФО | Есть | Нет |
| Разворот по МФО (+) | Есть | Нет |
| По фичам | Есть | Нет |
| По часам | Есть | Есть |
| Настройка витрины | Есть | Нет |
| Колонка Вх. КВ | Есть | Нет |
| Колонка Insapp доход | Есть | Нет |
| Колонка Доход (партнёра) | Есть (Партн. X%) | Есть (просто "Доход") |
| EPC/EPL | От Вх. КВ | От Дохода партнёра |
| Run Rate | От Вх. КВ | От Дохода партнёра |
| Автозагрузка | Нет | Да (при открытии) |

## API endpoint

Кабинет использует единственный endpoint:

```
GET /api/summary?partner=mts&start=YYYY-MM-DD&end=YYYY-MM-DD
```

### Параметры

| Параметр | Описание |
|----------|----------|
| `partner` | Ключ партнёра из appsettings.json (`mts`) |
| `start` | Начало периода (включительно) |
| `end` | Конец периода (включительно) |
| `from_time` | Альтернатива start/end — ISO timestamp для почасового режима |

### Ответ

```json
{
  "partner": { "name": "МТС Банк", "split": 80, "filter": "ak.PartnerId='...'" },
  "days": [
    {
      "date": "2026-04-09",
      "opens": 1580,
      "transitions": 393,
      "ankety": 76,
      "rejected": 32,
      "issued": 17,
      "kv": 80560
    }
  ],
  "ankety_total": 76
}
```

- `kv` — входящая комиссия (в рублях). Доход партнёра = `kv * split / 100`
- `ankety_total` — уникальные анкеты за весь период (не сумма по дням)

## SQL-запросы (бэкенд)

Все запросы выполняются к базе **InsappCoreProd** через MCP-прокси.

### Основной запрос данных (CTE)

```sql
WITH opens AS (
  SELECT CAST(a.Created AS DATE) as dt, COUNT(*) as opens
  FROM Applications a
    JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
  WHERE ak.PartnerId='477a5c28-4577-4c53-a190-95b8f4ca4b2a'
    AND a.ProductTypeId=5 AND a.ChannelTypeId=2
    AND CAST(a.Created AS DATE) >= '2026-04-01'
    AND CAST(a.Created AS DATE) <= '2026-04-09'
  GROUP BY CAST(a.Created AS DATE)
),
transitions AS (
  SELECT CAST(a.Created AS DATE) as dt, COUNT(*) as transitions
  FROM FinOffers ff
    JOIN Applications a ON ff.ApplicationId=a.ApplicationId
    JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
  WHERE ff.SelectedDate IS NOT NULL
    AND ak.PartnerId='477a5c28-4577-4c53-a190-95b8f4ca4b2a'
    AND a.ProductTypeId=5 AND a.ChannelTypeId=2
    AND CAST(a.Created AS DATE) >= '2026-04-01'
    AND CAST(a.Created AS DATE) <= '2026-04-09'
  GROUP BY CAST(a.Created AS DATE)
),
ankety AS (
  SELECT CAST(a.Created AS DATE) as dt, COUNT(DISTINCT s.ApplicationId) as ankety
  FROM ApplicationStatuses s
    JOIN Applications a ON s.ApplicationId=a.ApplicationId
    JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
  WHERE s.ApplicationStatusTypeId='b1a2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6'
    AND ak.PartnerId='477a5c28-4577-4c53-a190-95b8f4ca4b2a'
    AND a.ProductTypeId=5 AND a.ChannelTypeId=2
    AND CAST(a.Created AS DATE) >= '2026-04-01'
    AND CAST(a.Created AS DATE) <= '2026-04-09'
  GROUP BY CAST(a.Created AS DATE)
),
rejections AS (
  SELECT CAST(a.Created AS DATE) as dt, COUNT(*) as rejected
  FROM FinOffers ff
    JOIN Applications a ON ff.ApplicationId=a.ApplicationId
    JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
  WHERE ff.OfferStatusTypeId=3
    AND ak.PartnerId='477a5c28-4577-4c53-a190-95b8f4ca4b2a'
    AND a.ProductTypeId=5 AND a.ChannelTypeId=2
    AND CAST(a.Created AS DATE) >= '2026-04-01'
    AND CAST(a.Created AS DATE) <= '2026-04-09'
  GROUP BY CAST(a.Created AS DATE)
),
issued AS (
  SELECT dt, COUNT(*) as issued, SUM(kv) as kv FROM (
    SELECT DISTINCT a.ApplicationId, CAST(a.Created AS DATE) as dt,
      a.IncomingComissionAmount as kv
    FROM ApplicationStatuses s
      JOIN Applications a ON s.ApplicationId=a.ApplicationId
      JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
      JOIN ApplicationStatusTypes stt ON s.ApplicationStatusTypeId=stt.Id
      JOIN FinOffers ff ON a.ApplicationId=ff.ApplicationId AND ff.OfferStatusTypeId=6
    WHERE stt.[Index]=305
      AND ak.PartnerId='477a5c28-4577-4c53-a190-95b8f4ca4b2a'
      AND a.ProductTypeId=5 AND a.ChannelTypeId=2
      AND CAST(a.Created AS DATE) >= '2026-04-01'
      AND CAST(a.Created AS DATE) <= '2026-04-09'
  ) sub GROUP BY dt
),
ankety_total AS (
  SELECT COUNT(DISTINCT s.ApplicationId) as ankety_total
  FROM ApplicationStatuses s
    JOIN Applications a ON s.ApplicationId=a.ApplicationId
    JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
  WHERE s.ApplicationStatusTypeId='b1a2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6'
    AND ak.PartnerId='477a5c28-4577-4c53-a190-95b8f4ca4b2a'
    AND a.ProductTypeId=5 AND a.ChannelTypeId=2
    AND CAST(a.Created AS DATE) >= '2026-04-01'
    AND CAST(a.Created AS DATE) <= '2026-04-09'
)
SELECT o.dt, o.opens, ISNULL(t.transitions,0) as transitions,
  ISNULL(an.ankety,0) as ankety, ISNULL(r.rejected,0) as rejected,
  ISNULL(i.issued,0) as issued, ISNULL(i.kv,0) as kv, at.ankety_total
FROM opens o
  LEFT JOIN transitions t ON o.dt=t.dt
  LEFT JOIN ankety an ON o.dt=an.dt
  LEFT JOIN rejections r ON o.dt=r.dt
  LEFT JOIN issued i ON o.dt=i.dt
  CROSS JOIN ankety_total at
ORDER BY o.dt
```

### Запрос сплита партнёра

```sql
SELECT TOP 1 c.ComissionRate
FROM PartnerFinProductsPeriods p
  JOIN PartnerFinProductsComissions c ON p.PeriodId=c.PeriodId
  JOIN PartnerApiKeys ak ON p.ApiKeyId=ak.ApiKeyId
WHERE ak.PartnerId='477a5c28-4577-4c53-a190-95b8f4ca4b2a'
  AND p.StartDate<='2026-04-09' AND p.EndDate>'2026-04-09'
```

## Критические правила SQL

1. **CAST(a.Created AS DATE)** — обязательно, т.к. Created хранится как `datetimeoffset +03:00`
2. **a.ChannelTypeId = 2** — только виджет, иначе завышение открытий
3. **a.ProductTypeId = 5** — только МФО
4. **ApplicationStatusTypes.Index = 305** — CreditIssued (выдача), через JOIN, не хардкод ID
5. **Applications.PartnerId не существует** — связь только через PartnerApiKeys
6. **FinOffers.SelectedDate IS NOT NULL** — переходы = клики по офферам
7. **FinOffers.OfferStatusTypeId = 3** — отказ на уровне оффера
8. **FinOffers.OfferStatusTypeId = 6** — одобренный оффер (для выдач)
9. **Анкеты из ApplicationStatuses** (история), не из текущего статуса

## Формулы на фронте

```
Доход партнёра = kv * split / 100         (split=80 для МТС)
EPC = Доход партнёра / transitions
EPL = Доход партнёра / ankety
Run Rate = (avg daily income за полные дни) * дней_в_месяце
```

Run Rate исключает последний (неполный) день. При 1 дне данных — показывает "—".

## Адаптация под другого партнёра

Для создания кабинета другого партнёра (например ЛОКО):

1. Скопируй `partner-mts.html` → `partner-loko.html`
2. В HTML замени заголовок: "Отчёт МФО ЛОКО Банк"
3. В `partner-app.js` (или создай `partner-loko-app.js`):
   - `PARTNER = 'loko'`
   - `SPLIT = 70` (или актуальный сплит)
4. Убедись что в `appsettings.json` есть конфиг `loko`
