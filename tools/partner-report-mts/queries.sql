-- ============================================================
-- SQL-запросы для партнёрского отчёта МФО (МТС Банк)
-- БД: InsappCoreProd (MSSQL)
-- ============================================================

-- Параметры (заменить перед выполнением):
--   {pid}   = '477a5c28-4577-4c53-a190-95b8f4ca4b2a'  (PartnerId МТС Банк)
--   {start} = '2026-04-01'  (начало периода, включительно)
--   {end}   = '2026-04-09'  (конец периода, включительно)

-- ============================================================
-- 1. ОСНОВНОЙ ЗАПРОС: данные по дням
-- ============================================================
-- Возвращает: dt, opens, transitions, ankety, rejected, issued, kv, ankety_total
-- kv = входящая комиссия (IncomingComissionAmount)
-- Доход партнёра = kv * 80 / 100

WITH opens AS (
  SELECT CAST(a.Created AS DATE) as dt, COUNT(*) as opens
  FROM Applications a
    JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
  WHERE ak.PartnerId='{pid}'
    AND a.ProductTypeId=5        -- только МФО
    AND a.ChannelTypeId=2        -- только виджет
    AND CAST(a.Created AS DATE) >= '{start}'
    AND CAST(a.Created AS DATE) <= '{end}'
  GROUP BY CAST(a.Created AS DATE)
),
transitions AS (
  SELECT CAST(a.Created AS DATE) as dt, COUNT(*) as transitions
  FROM FinOffers ff
    JOIN Applications a ON ff.ApplicationId=a.ApplicationId
    JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
  WHERE ff.SelectedDate IS NOT NULL
    AND ak.PartnerId='{pid}'
    AND a.ProductTypeId=5 AND a.ChannelTypeId=2
    AND CAST(a.Created AS DATE) >= '{start}'
    AND CAST(a.Created AS DATE) <= '{end}'
  GROUP BY CAST(a.Created AS DATE)
),
ankety AS (
  SELECT CAST(a.Created AS DATE) as dt, COUNT(DISTINCT s.ApplicationId) as ankety
  FROM ApplicationStatuses s
    JOIN Applications a ON s.ApplicationId=a.ApplicationId
    JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
  WHERE s.ApplicationStatusTypeId='b1a2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6'
    AND ak.PartnerId='{pid}'
    AND a.ProductTypeId=5 AND a.ChannelTypeId=2
    AND CAST(a.Created AS DATE) >= '{start}'
    AND CAST(a.Created AS DATE) <= '{end}'
  GROUP BY CAST(a.Created AS DATE)
),
rejections AS (
  SELECT CAST(a.Created AS DATE) as dt, COUNT(*) as rejected
  FROM FinOffers ff
    JOIN Applications a ON ff.ApplicationId=a.ApplicationId
    JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
  WHERE ff.OfferStatusTypeId=3
    AND ak.PartnerId='{pid}'
    AND a.ProductTypeId=5 AND a.ChannelTypeId=2
    AND CAST(a.Created AS DATE) >= '{start}'
    AND CAST(a.Created AS DATE) <= '{end}'
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
      AND ak.PartnerId='{pid}'
      AND a.ProductTypeId=5 AND a.ChannelTypeId=2
      AND CAST(a.Created AS DATE) >= '{start}'
      AND CAST(a.Created AS DATE) <= '{end}'
  ) sub GROUP BY dt
),
ankety_total AS (
  SELECT COUNT(DISTINCT s.ApplicationId) as ankety_total
  FROM ApplicationStatuses s
    JOIN Applications a ON s.ApplicationId=a.ApplicationId
    JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
  WHERE s.ApplicationStatusTypeId='b1a2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6'
    AND ak.PartnerId='{pid}'
    AND a.ProductTypeId=5 AND a.ChannelTypeId=2
    AND CAST(a.Created AS DATE) >= '{start}'
    AND CAST(a.Created AS DATE) <= '{end}'
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
ORDER BY o.dt;

-- ============================================================
-- 2. ЗАПРОС СПЛИТА (процент партнёра)
-- ============================================================
-- Возвращает ComissionRate (например 80 = 80% партнёру)

SELECT TOP 1 c.ComissionRate
FROM PartnerFinProductsPeriods p
  JOIN PartnerFinProductsComissions c ON p.PeriodId=c.PeriodId
  JOIN PartnerApiKeys ak ON p.ApiKeyId=ak.ApiKeyId
WHERE ak.PartnerId='{pid}'
  AND p.StartDate<='{start}' AND p.EndDate>'{start}';

-- ============================================================
-- КРИТИЧЕСКИЕ ПРАВИЛА
-- ============================================================
-- 1. CAST(a.Created AS DATE) — обязательно, Created = datetimeoffset +03:00
-- 2. ChannelTypeId = 2 — только виджет
-- 3. ProductTypeId = 5 — только МФО
-- 4. stt.[Index] = 305 — CreditIssued, через JOIN (не хардкод ID)
-- 5. Applications.PartnerId НЕ существует — связь через PartnerApiKeys
-- 6. FinOffers.SelectedDate IS NOT NULL — переходы = клики по офферам
-- 7. FinOffers.OfferStatusTypeId = 3 — отказ на уровне оффера
-- 8. FinOffers.OfferStatusTypeId = 6 — одобренный оффер (для выдач)
-- 9. Анкеты из ApplicationStatuses (история), не текущий статус
--
-- ФОРМУЛЫ (фронтенд):
--   Доход партнёра = kv * split / 100
--   EPC = Доход / transitions
--   EPL = Доход / ankety
--   Run Rate = (avg daily income за полные дни) * дней_в_месяце
