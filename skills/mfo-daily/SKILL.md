---
name: mfo-daily
description: Use when user invokes /mfo-daily or asks for a daily MFO partner report. Takes period, finds ALL partners with MFO traffic, outputs full tables for significant ones and brief text for minor ones.
---

# МФО ежедневный отчёт по всем партнёрам

## Вызов
`/mfo-daily [период]`

Примеры:
- `/mfo-daily 10-24 марта`
- `/mfo-daily 19-23 марта 2026`
- `/mfo-daily за последнюю неделю`

**Период ВКЛЮЧИТЕЛЬНО** - последний день входит в отчёт.

## Требования
- `insapp-db` MCP - обязательно

## Алгоритм

### 1. Распознать период
Распарсить даты из аргумента. Последняя дата ВКЛЮЧИТЕЛЬНО.
`end_date_exclusive = end_date + 1 день` для SQL.

### 2. Найти ВСЕХ партнёров с МФО трафиком за период

```sql
-- InsappCoreProd
SELECT
  p.PartnerId, p.Name,
  COUNT(*) as total_opens,
  SUM(CASE WHEN stt.[Index] >= 190 THEN 1 ELSE 0 END) as total_transitions,
  SUM(CASE WHEN stt.[Index] = 305 THEN 1 ELSE 0 END) as total_issued,
  COALESCE(SUM(CASE WHEN stt.[Index] = 305 THEN a.IncomingComissionAmount END), 0) as total_kv
FROM Applications a
  JOIN PartnerApiKeys ak ON a.ApiKeyId = ak.ApiKeyId
  JOIN Partners p ON ak.PartnerId = p.PartnerId
  JOIN ApplicationStatusTypes stt ON a.ApplicationStatusTypeId = stt.Id
WHERE a.ProductTypeId = 5
  AND a.Created >= '[start]' AND a.Created < '[end_exclusive]'
GROUP BY p.PartnerId, p.Name
ORDER BY total_opens DESC
```

### 3. Классифицировать партнёров

**Полный отчёт** (таблица) - если:
- total_opens >= 50 за период, ИЛИ
- есть хотя бы 1 выдача (total_issued > 0), ИЛИ
- партнёр в списке основных: ЛОКО, Хиппо, Пампаду, МФО Инсап

**Справочно** (текстом) - все остальные с трафиком.

### 4. Для каждого "полного" партнёра - собрать данные

**4a. Основная таблица по дням:**
```sql
SELECT
  CAST(a.Created AS DATE) as dt,
  COUNT(*) as opens,
  SUM(CASE WHEN stt.[Index] >= 190 THEN 1 ELSE 0 END) as transitions,
  SUM(CASE WHEN stt.[Index] = 305 THEN 1 ELSE 0 END) as issued,
  COALESCE(SUM(CASE WHEN stt.[Index] = 305 THEN a.IncomingComissionAmount END), 0) as incoming_kv
FROM Applications a
  JOIN PartnerApiKeys ak ON a.ApiKeyId = ak.ApiKeyId
  JOIN ApplicationStatusTypes stt ON a.ApplicationStatusTypeId = stt.Id
WHERE ak.PartnerId = '[PartnerId]'
  AND a.ProductTypeId = 5
  AND a.Created >= '[start]' AND a.Created < '[end_exclusive]'
GROUP BY CAST(a.Created AS DATE)
ORDER BY dt
```

**4b. МФО по которым идут переходы (разбивка):**
```sql
SELECT
  CAST(a.Created AS DATE) as dt,
  fo.Name as mfo_name,
  COUNT(*) as cnt
FROM Applications a
  JOIN PartnerApiKeys ak ON a.ApiKeyId = ak.ApiKeyId
  JOIN ApplicationStatusTypes stt ON a.ApplicationStatusTypeId = stt.Id
  JOIN FinOffers ff ON a.ApplicationId = ff.ApplicationId
  JOIN FinOrgs fo ON ff.FinOrgId = fo.FinOrgId
WHERE ak.PartnerId = '[PartnerId]'
  AND a.ProductTypeId = 5
  AND stt.[Index] >= 190
  AND a.Created >= '[start]' AND a.Created < '[end_exclusive]'
GROUP BY CAST(a.Created AS DATE), fo.Name
ORDER BY dt, cnt DESC
```

**4c. МФО по выдачам (если есть):**
```sql
SELECT
  CAST(a.Created AS DATE) as dt,
  fo.Name as mfo_name,
  COUNT(*) as cnt,
  SUM(a.IncomingComissionAmount) as kv
FROM Applications a
  JOIN PartnerApiKeys ak ON a.ApiKeyId = ak.ApiKeyId
  JOIN ApplicationStatusTypes stt ON a.ApplicationStatusTypeId = stt.Id
  JOIN FinOffers ff ON a.ApplicationId = ff.ApplicationId AND ff.OfferStatusTypeId = 6
  JOIN FinOrgs fo ON ff.FinOrgId = fo.FinOrgId
WHERE ak.PartnerId = '[PartnerId]'
  AND a.ProductTypeId = 5
  AND stt.[Index] = 305
  AND a.Created >= '[start]' AND a.Created < '[end_exclusive]'
GROUP BY CAST(a.Created AS DATE), fo.Name
ORDER BY dt
```

### 5. Формат вывода

**ВАЖНО:** Индексы статусов в ApplicationStatusTypes:
- `[Index] = 305` = CreditIssued (выдачи)
- `[Index] >= 190` = OfferChosen+ (переходы)
- НЕ использовать int-ы из глоссария (42, 38) - они не совпадают с реальными Index!

#### 5a. Полный отчёт партнёра

Заголовок: `## [Партнёр] | [Период]`

Основная таблица (колонки зависят от партнёра):
- ЛОКО (80/20): Дата | Открытий | Переходов | МФО | Выдачи | Вход. КВ | Исх. (80%) | Доход (20%) | CR | EPC | EPL
- Хиппо и другие (без разбивки КВ): Дата | Открытий | Переходов | МФО | Выдачи | Вход. КВ | CR | EPC

**Колонка "МФО":**
- Если у партнёра 1 доминирующая МФО (>90% переходов) - пишем её название каждый день
- Если разброс по МФО - пишем через запятую с количеством: "MoneyMan 2, Webbankir 1"
- Если нет переходов в день: "-"

**Строка ИТОГО** - суммы по всем колонкам, CR/EPC/EPL пересчитать от итогов.

**Таблица переходов по МФО** (если у партнёра >1 МФО с переходами):

| МФО | дата1 | дата2 | ... | Итого |
|---|---|---|---|---|

#### 5b. Справочная строка

Для мелких партнёров - текстом после всех таблиц:

> Также обнаружен трафик по партнёрам:
> - **[Партнёр]**: [N] открытий виджета за весь период, [среднее/день] в день

### 6. Комиссионные сплиты (известные)

| Партнёр | Партнёр % | Insapp % |
|---|---|---|
| ЛОКО | 80% | 20% |
| Другие | спросить у пользователя |

Если сплит неизвестен - НЕ показывать колонки Исх.КВ / Доход, показать только Вход. КВ.

## Критические правила

1. **Период ВКЛЮЧИТЕЛЬНО** - `/mfo-daily 10-24 марта` = с 10 по 24 включительно
2. **Все партнёры** - не только известные, а ВСЕ у кого был трафик ProductTypeId=5
3. **ApplicationStatusTypes.Index** - НЕ int из глоссария! Join к таблице обязателен
4. **МФО через FinOffers→FinOrgs** - НЕ через FinLoans
5. **Таблицы компактные** - чтобы рендерились в терминале, не расползались в текст
