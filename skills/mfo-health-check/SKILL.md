---
name: mfo-health-check
description: Проверка технического состояния финансовых продуктов (МФО). Запускать для диагностики ошибок, проверки постбеков, комиссий и общей статистики финпродуктов.
---

# MFO Health Check — Проверка финансовых продуктов

Выполни полную диагностику состояния финансовых продуктов (ProductTypeId = 5).
Период проверки: **последние 24 часа** (если пользователь не указал иное).

ВАЖНО: Перед запросами всегда вызови `glossary(category="rules")`.

---

## Шаг 0 — Общая картина (обзорная статистика за 24ч)

Выполни параллельно:

### 0.1 Заявки по финпродуктам за 24ч
```sql
SELECT
  COUNT(*) AS TotalApplications,
  SUM(CASE WHEN Created >= DATEADD(hour, -1, GETDATE()) THEN 1 ELSE 0 END) AS LastHour
FROM InsappCore.dbo.Applications
WHERE ProductTypeId = 5
  AND Created >= DATEADD(day, -1, GETDATE())
```
База: InsappCoreProd

### 0.2 Офферы FinOffers за 24ч
```sql
SELECT
  COUNT(*) AS TotalOffers,
  SUM(CASE WHEN SelectedDate IS NOT NULL THEN 1 ELSE 0 END) AS TotalSelected
FROM InsappCore.dbo.FinOffers
WHERE Created >= DATEADD(day, -1, GETDATE())
```
База: InsappCoreProd

### 0.3 Постбеки по типам за 24ч
```sql
SELECT
  CASE
    WHEN Url LIKE 'http://api.insapp.pro/FinOrg/RefPostback%' THEN 'RefPostback (универсальный)'
    WHEN Url LIKE 'http://api.insapp.pro/FinApp/FinuslugiRefPostback%' THEN 'Finuslugi Ref'
    WHEN Url LIKE 'http://api.insapp.pro/FinApp/FinuslugiPostback%' THEN 'Finuslugi API'
    WHEN Url LIKE 'http://api.insapp.pro/FinApp/Postback%' THEN 'Pampadu'
    ELSE 'Другие'
  END AS PostbackType,
  COUNT(*) AS Total,
  SUM(CASE WHEN ResponseBody LIKE '%"result":true%' OR ResponseBody LIKE '%"result": true%' THEN 1 ELSE 0 END) AS Success,
  SUM(CASE WHEN ResponseBody NOT LIKE '%"result":true%' AND ResponseBody NOT LIKE '%"result": true%' THEN 1 ELSE 0 END) AS Failed
FROM InsappLog.dbo.PublicApiLogs
WHERE Date >= DATEADD(day, -1, GETDATE())
  AND RequestHeaders NOT LIKE '%TelegramBot%'
  AND (
    Url LIKE 'http://api.insapp.pro/FinOrg/RefPostback%'
    OR Url LIKE 'http://api.insapp.pro/FinApp/Postback%'
    OR Url LIKE 'http://api.insapp.pro/FinApp/FinuslugiRefPostback%'
    OR Url LIKE 'http://api.insapp.pro/FinApp/FinuslugiPostback%'
  )
GROUP BY
  CASE
    WHEN Url LIKE 'http://api.insapp.pro/FinOrg/RefPostback%' THEN 'RefPostback (универсальный)'
    WHEN Url LIKE 'http://api.insapp.pro/FinApp/FinuslugiRefPostback%' THEN 'Finuslugi Ref'
    WHEN Url LIKE 'http://api.insapp.pro/FinApp/FinuslugiPostback%' THEN 'Finuslugi API'
    WHEN Url LIKE 'http://api.insapp.pro/FinApp/Postback%' THEN 'Pampadu'
    ELSE 'Другие'
  END
```
База: InsappLogProd

---

## Критерий 1 — Ошибки в ErrorLogs по FinProducts

```sql
SELECT TOP 50
  COUNT(*) AS ErrorCount,
  LEFT(Message, 300) AS MessageSample,
  MIN(CAST(Date AS NVARCHAR(30))) AS FirstSeen,
  MAX(CAST(Date AS NVARCHAR(30))) AS LastSeen
FROM InsappLog.dbo.ErrorLogs
WHERE Date >= DATEADD(day, -1, GETDATE())
  AND Detail LIKE '%FinProducts%'
  AND (Detail NOT LIKE '%Insapp.DbMcp%' OR Detail IS NULL)
GROUP BY LEFT(Message, 300)
ORDER BY MAX(Date) DESC
```
База: InsappLogProd

**Интерпретация:**
- 0 строк → ✅ Ошибок нет
- Есть строки → ❌ Показать группировку по тексту ошибки с количеством

---

## Критерий 2 — Ошибки расчёта комиссии по МФО

### 2.1 Сводка расчётов за 24ч
```sql
SELECT
  COUNT(*) AS TotalFinCalc,
  SUM(CASE WHEN Result = 0 THEN 1 ELSE 0 END) AS FailedCalc,
  SUM(CASE WHEN Result = 1 THEN 1 ELSE 0 END) AS SuccessCalc,
  SUM(CASE WHEN FinOrgCalc IS NULL THEN 1 ELSE 0 END) AS MissingFinOrgCalc,
  SUM(CASE WHEN PartnerCalc IS NULL THEN 1 ELSE 0 END) AS MissingPartnerCalc
FROM InsappLog.dbo.ComissionLogs
WHERE Date >= DATEADD(day, -1, GETDATE())
  AND FinOrgId IS NOT NULL
```
База: InsappLogProd

### 2.2 Детали провальных расчётов (только если FailedCalc > 0)
```sql
SELECT TOP 20
  Date,
  OfferId,
  FinOrgId,
  ProductId,
  LEFT(ISNULL(FinOrgCalc, 'NULL'), 200) AS FinOrgCalc,
  LEFT(ISNULL(PartnerCalc, 'NULL'), 200) AS PartnerCalc,
  Result
FROM InsappLog.dbo.ComissionLogs
WHERE Date >= DATEADD(day, -1, GETDATE())
  AND FinOrgId IS NOT NULL
  AND Result = 0
ORDER BY Date DESC
```
База: InsappLogProd

**Интерпретация:**
- FailedCalc = 0 → ✅ Все расчёты успешны
- FailedCalc > 0 → ❌ Показать детали: FinOrgCalc / PartnerCalc содержат текст ошибки

---

## Критерий 3 — Постбеки: обработка и выдачи

Успешность постбека определяется по телу ответа: `"result": true` (не по HTTP-коду).

### 3.1 RefPostback (универсальные) — статусы за 24ч
```sql
SELECT
  CASE
    WHEN Url LIKE '%status=CreditIssued%' THEN 'CreditIssued (выдача)'
    WHEN Url LIKE '%status=CreditInProcessing%' THEN 'CreditInProcessing'
    WHEN Url LIKE '%status=CreditRejected%' THEN 'CreditRejected'
    WHEN Url LIKE '%status=CreditCanceled%' THEN 'CreditCanceled'
    ELSE 'Другой'
  END AS Status,
  COUNT(*) AS Count,
  SUM(CASE WHEN ResponseBody LIKE '%"result":true%' OR ResponseBody LIKE '%"result": true%' THEN 1 ELSE 0 END) AS Processed,
  SUM(CASE WHEN ResponseBody NOT LIKE '%"result":true%' AND ResponseBody NOT LIKE '%"result": true%' THEN 1 ELSE 0 END) AS Failed
FROM InsappLog.dbo.PublicApiLogs
WHERE Date >= DATEADD(day, -1, GETDATE())
  AND Url LIKE 'http://api.insapp.pro/FinOrg/RefPostback%'
  AND RequestHeaders NOT LIKE '%TelegramBot%'
GROUP BY
  CASE
    WHEN Url LIKE '%status=CreditIssued%' THEN 'CreditIssued (выдача)'
    WHEN Url LIKE '%status=CreditInProcessing%' THEN 'CreditInProcessing'
    WHEN Url LIKE '%status=CreditRejected%' THEN 'CreditRejected'
    WHEN Url LIKE '%status=CreditCanceled%' THEN 'CreditCanceled'
    ELSE 'Другой'
  END
ORDER BY Count DESC
```
База: InsappLogProd

### 3.2 Pampadu постбеки — статусы за 24ч
```sql
SELECT
  CASE
    WHEN Url LIKE '%status=approved%' OR Url LIKE '%status=Approved%' THEN 'approved (выдача)'
    WHEN Url LIKE '%status=Declined%' OR Url LIKE '%status=declined%' THEN 'Declined'
    ELSE 'Другой'
  END AS Status,
  COUNT(*) AS Count,
  SUM(CASE WHEN ResponseBody LIKE '%"result":true%' OR ResponseBody LIKE '%"result": true%' THEN 1 ELSE 0 END) AS Processed,
  SUM(CASE WHEN ResponseBody NOT LIKE '%"result":true%' AND ResponseBody NOT LIKE '%"result": true%' THEN 1 ELSE 0 END) AS Failed
FROM InsappLog.dbo.PublicApiLogs
WHERE Date >= DATEADD(day, -1, GETDATE())
  AND Url LIKE 'http://api.insapp.pro/FinApp/Postback%'
  AND RequestHeaders NOT LIKE '%TelegramBot%'
GROUP BY
  CASE
    WHEN Url LIKE '%status=approved%' OR Url LIKE '%status=Approved%' THEN 'approved (выдача)'
    WHEN Url LIKE '%status=Declined%' OR Url LIKE '%status=declined%' THEN 'Declined'
    ELSE 'Другой'
  END
ORDER BY Count DESC
```
База: InsappLogProd

### 3.3 Finuslugi Ref постбеки за 24ч
```sql
SELECT
  COUNT(*) AS Count,
  SUM(CASE WHEN ResponseBody LIKE '%"result":true%' OR ResponseBody LIKE '%"result": true%' THEN 1 ELSE 0 END) AS Processed,
  SUM(CASE WHEN ResponseBody NOT LIKE '%"result":true%' AND ResponseBody NOT LIKE '%"result": true%' THEN 1 ELSE 0 END) AS Failed,
  MIN(CAST(Date AS NVARCHAR(30))) AS FirstSeen,
  MAX(CAST(Date AS NVARCHAR(30))) AS LastSeen
FROM InsappLog.dbo.PublicApiLogs
WHERE Date >= DATEADD(day, -1, GETDATE())
  AND Url LIKE 'http://api.insapp.pro/FinApp/FinuslugiRefPostback%'
  AND RequestHeaders NOT LIKE '%TelegramBot%'
```
База: InsappLogProd

### 3.4 Finuslugi API постбеки за 24ч
```sql
SELECT
  COUNT(*) AS Count,
  SUM(CASE WHEN ResponseBody LIKE '%"result":true%' OR ResponseBody LIKE '%"result": true%' THEN 1 ELSE 0 END) AS Processed,
  SUM(CASE WHEN ResponseBody NOT LIKE '%"result":true%' AND ResponseBody NOT LIKE '%"result": true%' THEN 1 ELSE 0 END) AS Failed,
  MIN(CAST(Date AS NVARCHAR(30))) AS FirstSeen,
  MAX(CAST(Date AS NVARCHAR(30))) AS LastSeen
FROM InsappLog.dbo.PublicApiLogs
WHERE Date >= DATEADD(day, -1, GETDATE())
  AND Url LIKE 'http://api.insapp.pro/FinApp/FinuslugiPostback%'
  AND RequestHeaders NOT LIKE '%TelegramBot%'
```
База: InsappLogProd

### 3.5 Незафиксированные выдачи: CreditIssued без SelectedDate

Шаг A — получить offer_id из CreditIssued постбеков за 24ч:
```sql
SELECT
  SUBSTRING(Url,
    CHARINDEX('offer_id=', Url) + 9,
    CASE
      WHEN CHARINDEX('&', Url, CHARINDEX('offer_id=', Url) + 9) > 0
      THEN CHARINDEX('&', Url, CHARINDEX('offer_id=', Url) + 9) - (CHARINDEX('offer_id=', Url) + 9)
      ELSE LEN(Url)
    END
  ) AS OfferId,
  Date,
  LEFT(ISNULL(ResponseBody, ''), 200) AS ResponseBody
FROM InsappLog.dbo.PublicApiLogs
WHERE Date >= DATEADD(day, -1, GETDATE())
  AND Url LIKE 'http://api.insapp.pro/FinOrg/RefPostback%'
  AND Url LIKE '%status=CreditIssued%'
  AND RequestHeaders NOT LIKE '%TelegramBot%'
ORDER BY Date DESC
```
База: InsappLogProd

Шаг Б — для каждого OfferId из шага A проверить SelectedDate:
```sql
SELECT OfferId, SelectedDate, ApplicationId, Created
FROM InsappCore.dbo.FinOffers
WHERE OfferId IN (/* список OfferId из шага A */)
```
База: InsappCoreProd

**Интерпретация:**
- Все CreditIssued-постбеки с `"result":true` → SelectedDate IS NOT NULL → ✅
- Есть `"result":true` без SelectedDate → ❌ Постбек обработан, но выдача не зафиксировалась
- Есть `"result":false` → ❌ Постбек не обработан (ошибка в обработчике)

---

## Формат отчёта

```
=== MFO Health Check Report ===
Период: последние 24ч (от [время] до [время])

--- ОБЩАЯ КАРТИНА ---
📊 Заявки (FinProduct): [N] за 24ч, из них за последний час: [N]
📊 FinOffers создано: [N] / выбрано: [N] (конверсия X%)
📊 Постбеки за 24ч:
   - RefPostback:    [N] всего / успешно: [N] / ошибок: [N]
   - Pampadu:        [N] всего / успешно: [N] / ошибок: [N]
   - Finuslugi Ref:  [N] всего / успешно: [N] / ошибок: [N]
   - Finuslugi API:  [N] всего / успешно: [N] / ошибок: [N]

--- РЕЗУЛЬТАТЫ ПРОВЕРОК ---
[✅/❌] 1. ErrorLogs     — [N] уникальных ошибок по FinProducts
[✅/❌] 2. ComissionLogs — [N] расчётов, [N] провальных (FinOrgCalc/PartnerCalc)
[✅/❌] 3.1 RefPostback  — [N] получено, CreditIssued: [N], незафиксированных: [N]
[✅/❌] 3.2 Pampadu      — [N] получено, approved: [N], failed: [N]
[✅/❌] 3.3 Finuslugi Ref— [N] получено, failed: [N]
[✅/❌] 3.4 Finuslugi API— [N] получено, failed: [N]

--- ДЕТАЛИ ПРОБЛЕМ ---
(только если есть ❌)

--- ИТОГ ---
Общий статус: ✅ HEALTHY / ⚠️ WARNINGS / ❌ CRITICAL
```

**Критерии итогового статуса:**
- ✅ HEALTHY — все проверки зелёные
- ⚠️ WARNINGS — единичные ошибки, не критичные (например, 1-2 сбоя комиссии без тренда)
- ❌ CRITICAL — активные ошибки в ErrorLogs, провальные расчёты комиссий, или незафиксированные выдачи (result:false на CreditIssued)
