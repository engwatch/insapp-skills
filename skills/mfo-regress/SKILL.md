---
name: mfo-regress
description: "MFO Health Check — автоматический регресс МФО-фич на тестовом окружении"
---

# /mfo-regress — Регресс МФО

Последовательно прогоняет группы тестов МФО-фич на тестовом окружении. Результат — текстовый отчёт в консоли.

## Принцип: лучше ложный FAIL, чем ложный PASS

Ты — параноидальный тестировщик. Твоя задача — найти проблемы, а не подтвердить что всё работает.

- **Если есть сомнения — ставь FAIL.** Лучше сообщить что фича сломана когда она работает, чем пропустить реальный баг.
- Не додумывай успех. Если ожидал значение X, а получил Y — это FAIL, даже если Y "выглядит нормально".
- Проверяй каждое утверждение фактами: response body, SQL-результат, snapshot. Не полагайся на то что "скорее всего сработало".
- Если API вернул `result:true` но в БД нет ожидаемых изменений — это FAIL.
- Если в response есть поле но его значение не соответствует ожиданию — это FAIL.
- При любой ошибке, таймауте или неожиданном поведении — FAIL с подробным описанием что пошло не так.

## Окружение

- Фронт: `test-money.insapp.ru?apiKey={apiKey}`
- API: `test-api.insapp.pro`
- БД: `InsappCoreTest` (через MCP `insapp-db`)

## Общий флоу

1. Вызвать `glossary(category="columns")` для структуры таблиц
2. Прочитать реестр фич из Google Sheets (spreadsheetId: `1PBLgeDZGEyeqc7Zqpje8iB79D5KiqLJJmBj0_eDfQQA`, лист "Реестр фич", все строки)
3. Отфильтровать: пропустить фичи со столбцом J (Статус регресса) = "Не поддерживается" и столбцом K (Группа тестирования) = "—"
4. Последовательно выполнить группы 1–4
5. Вывести итоговый отчёт

## Перехват API-ответов (Playwright)

Для проверки network responses использовать `browser_run_code` с перехватом ДО навигации:

```javascript
async (page) => {
  const responses = {};
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/FinApp/')) {
      try {
        const body = await response.json();
        const method = url.split('/FinApp/')[1];
        responses[method] = body;
      } catch(e) {}
    }
  });
  await page.goto('https://test-money.insapp.ru?apiKey={apiKey}');
  await page.waitForTimeout(5000);
  await page.evaluate((r) => { window._apiResponses = r; }, responses);
  return JSON.stringify(Object.keys(responses));
}
```

Затем читать ответы через `browser_evaluate`:
```javascript
() => JSON.stringify(window._apiResponses['New']?.value)
```

## Поиск ApiKey

Ключевое правило: **недостаточно проверить только флаг — нужно убедиться что зависимые настройки тоже есть**. Если подходящий ключ не найден — выводить `[WARN]`, не `[FAIL]`.

## Группа 1: Основной флоу (Playwright + БД)

**Поиск ключа:**
```sql
SELECT ak.ApiKeyId, ak.ApiKey, ak.ShowBadges
FROM PartnerApiKeys ak
WHERE ak.IsActive=1 AND ak.FinProcessType=0
  AND ak.FinLandingConfigJson LIKE '%"banner":true%'
```

**Шаги:**

### 1.1 Открыть витрину, перехватить New + GetOffers

### 1.2 Фича #20 — FinLandingConfig
- В ответе New: `value.finLandingConfigJson` не null
- Содержит ключи: header, content (banner, callForm, calculator, externalOffers), faq
- Если `banner:true` — на странице должна быть кнопка "Начать подбор"

### 1.3 Кликнуть "Начать подбор" → откроется форма с 5 шагами-аккордеонами

### 1.4 Фича #18 — Сохранение контактов
Заполнить шаг "Контактные данные":
- Телефон: 9991234567
- Email: test@insapp.ru
- Фамилия: Тестов (выбрать автокомплит)
- Имя: Тест (выбрать автокомплит)
- Отчество: Тестович (выбрать автокомплит)
- Дата рождения: 01011990
- Место рождения: Москва (автокомплит → "г Москва")
- Пол: Мужской (dropdown)
- Семейное положение: Не в браке (dropdown)
- Количество детей: Нет детей (dropdown)

Нажать "Продолжить".
- Проверить network: POST /FinApp/SetFormStatus → result:true
- Проверить БД: статус = `ContactsFilled`

### 1.5 Фича #16 — Трекинг этапов (проверяется на каждом шаге)

Заполнить шаг "Документы":
- Серия паспорта: 1234
- Номер паспорта: 567890
- Код подразделения: 770-001 (автокомплит, выбрать первый → автозаполнит "Кем выдан")
- Дата выдачи: 15062015
- СНИЛС: 12345678901
- Образование: Высшее образование (dropdown)

Нажать "Продолжить" → БД: `FinDocumentsFilled`

Заполнить шаг "Адресная информация":
- Адрес регистрации: "Москва Тверская-Ямская д 1" (автокомплит до дома, выбрать из списка)
- Чекбокс "Регион проживания совпадает" — уже чекнут

Нажать "Продолжить" → БД: `FinAddressFilled`

### 1.6 Отправка анкеты

Заполнить шаг "Деятельность":
- Тип занятости: Работник по найму (dropdown)
- Вид деятельности: Информационные технологии (dropdown)
- Тип должности: Специалист (dropdown)
- Название организации: ООО Тест
- Адрес организации: "Москва Тверская-Ямская д 1" (автокомплит до дома)
- Совокупный доход: 50000
- Расходы на кредиты: 0
- Чекбокс ПДн: поставить галку
- Чекбокс БКИ: уже чекнут

Нажать "Продолжить" → цепочка: New → SetStatusWidgetDisplayed → SaveFinApplication → SendToFinOrgs → GetOffers

**Важно:** при отправке формы создаётся НОВАЯ заявка (повторный New). Запомнить новый applicationId.

### 1.7 Фича #9 — Реферальные офферы
- В GetOffers: `value.externalOffers` — массив не пустой
- Каждый оффер содержит: offerId, finOrgName, link, maxLoanAmount, approvalProbability, rating

### 1.8 Фича #5 — Порядок офферов
- Запросить в БД:
```sql
SELECT fp.ProductName, pfr.Priority
FROM PartnerFinProductsRules pfr
JOIN FinProducts fp ON pfr.ProductId = fp.ProductId
WHERE pfr.ApiKeyId='{apiKeyId}' AND pfr.IsDisabled=0
ORDER BY pfr.Priority
```
- Сверить порядок externalOffers в response с Priority (меньший = выше)

### 1.9 Фича #21 — ShowBadges
- Если ShowBadges=false на ключе: все externalOffers имеют `cardText=null, cardColor=null, cardTextColor=null`

### 1.10 Фича #19 — Фиксация клика по офферу
- Кликнуть "Получить деньги" на любом реф-оффере
- Перехватить POST /FinApp/SelectOffer → result:true
- Проверить что открылась новая вкладка
- БД: `FinOffers.SelectedDate IS NOT NULL`, `ReferralStage=3` для кликнутого оффера
- У остальных офферов SelectedDate=null

### 1.11 Фича #17 — Статусы воронки
- БД: статус заявки = `OfferChosen`
- Полная цепочка за тест: New → ContactsFilled → FinDocumentsFilled → FinAddressFilled → OfferChosen
- API-офферы в `offers[]` (LinkStatus=0), реф-офферы в `externalOffers[]` (LinkStatus=2)

## Группа 2: Агентский ключ (Playwright + БД)

**Поиск ключа:**
```sql
SELECT ak.ApiKeyId, ak.ApiKey, pfc.ComissionRate, pfc.AgentComissionRate
FROM PartnerApiKeys ak
JOIN PartnerFinProductsPeriods pfp ON ak.ApiKeyId = pfp.ApiKeyId
JOIN PartnerFinProductsComissions pfc ON pfp.PeriodId = pfc.PeriodId
WHERE ak.IsActive=1 AND ak.IsAgentKey=1 AND pfc.AgentComissionRate IS NOT NULL
```
Если не найден → `[WARN] Агентский ключ с AgentComissionRate не найден`

**Шаги:**

### 2.1 Фича #12 — Агентская комиссия
- Открыть витрину, перехватить New + GetOffers
- New: `value.finAgent = true`
- GetOffers: в externalOffers хотя бы часть офферов имеет `agentComissionFrom` и/или `agentComissionTo` не null
- Сравнение: на обычном (не агентском) ключе эти поля = null

## Группа 3: DirectRedirect (Playwright)

**Поиск ключа:**
```sql
SELECT ak.ApiKey, fp.ProductName, fp.ProductUrl
FROM PartnerApiKeys ak
JOIN PartnerFinProductsRules pfr ON ak.ApiKeyId = pfr.ApiKeyId
JOIN FinProducts fp ON pfr.ProductId = fp.ProductId
WHERE ak.IsActive=1 AND ak.FinProcessType=2 AND pfr.IsDisabled=0 AND pfr.ActionOnApproval=1
```
Если не найден → `[WARN] DirectRedirect не настроен на тестовом окружении`

**Шаги:**

### 3.1 Фича #6 — DirectRedirect
- Перейти по `test-api.insapp.pro/marketing/redirect?apiKey={apiKey}`
- Проверить что произошёл редирект (финальный URL ≠ исходный)
- Проверить что финальный URL соответствует домену из ProductUrl

## Группа 4: Постбеки (API + БД)

Без Playwright — вызовы через fetch из браузера или напрямую.

### 4.1 Фича #14 — Постбеки Pampadu

**Поиск ключа:**
```sql
SELECT ak.ApiKey, ak.ApiKeyId
FROM PartnerApiKeys ak
JOIN Partners p ON ak.PartnerId = p.PartnerId
WHERE ak.IsActive=1 AND (p.Name LIKE '%Pampadu%' OR p.Name LIKE '%Страховые партн%')
```

**Поиск заявок с кликом (нужно 2 заявки):**
```sql
SELECT a.ApplicationId, fo.OfferId
FROM Applications a
JOIN FinOffers fo ON a.ApplicationId = fo.ApplicationId
JOIN ApplicationStatusTypes ast ON a.ApplicationStatusTypeId = ast.Id
WHERE a.ApiKeyId='{apiKeyId}' AND fo.SelectedDate IS NOT NULL AND ast.Name='OfferChosen'
ORDER BY a.Created DESC
```

**Формат запроса:** POST `test-api.insapp.pro/FinApp/Postback` с query params:
- `sub_id1` = offerId (**НЕ applicationId!**)
- `status`: pending / approved / declined
- `offer_id`, `offer_name`, `click_id`, `order_id`, `amount`, `cost`

**Проверка (3 постбека на 2 заявках):**

На первой заявке:
1. `status=pending` → result:true → БД: статус=ApplicationSubmitted, PremiumAmount=amount, IncomingComissionAmount=cost
2. `status=approved` → result:true → БД: статус=CreditIssued

На второй заявке:
3. `status=declined` → result:true → БД: статус=CreditRejected

**Важно:** declined/approved работает только из OfferChosen или позже.

### 4.2 Фича #15 — Постбек Финуслуги (реферальный)

**Поиск заявок:**
```sql
SELECT a.ApplicationId, fo.OfferId, fg.Name as FinOrgName
FROM Applications a
JOIN FinOffers fo ON a.ApplicationId = fo.ApplicationId
JOIN FinOrgs fg ON fo.FinOrgId = fg.FinOrgId
JOIN ApplicationStatusTypes ast ON a.ApplicationStatusTypeId = ast.Id
LEFT JOIN FinProducts fp ON fo.ProductId = fp.ProductId
WHERE fp.ProviderTypeId=6 AND fp.ProductUrl IS NOT NULL
  AND fo.SelectedDate IS NOT NULL AND ast.Name='OfferChosen'
ORDER BY a.Created DESC
```

**Формат запроса:** GET `test-api.insapp.pro/FinApp/FinuslugiRefPostback` с query params:
- `insapp_conversion_id` = applicationId
- `offerId` = offerId
- `status`: issued / rejected
- `payout`: сумма комиссии

**Проверка (2 постбека на 2 заявках):**
1. `status=issued&payout=750` → result:true → БД: CreditIssued, IncomingComissionAmount=750
2. На другой заявке: `status=rejected` → result:true → БД: CreditRejected

## Формат вывода

```
=== РЕГРЕСС МФО ===
Дата: {дата}
Окружение: test-money.insapp.ru

--- Группа 1: Основной флоу (ApiKey: {key}) ---
  [PASS] #20 FinLandingConfig — finLandingConfigJson в ответе New
  [PASS] #18 SaveContacts — ContactsFilled в БД
  [PASS] #16 Трекинг — все статусы зафиксированы
  [PASS] #9  Реф-офферы — {N} офферов получено
  [PASS] #5  Порядок — совпадает с Priority
  [PASS] #21 ShowBadges — cardText/cardColor соответствуют настройке
  [PASS] #19 Клик по офферу — SelectedDate заполнен, ReferralStage=3
  [PASS] #17 Статусы воронки — OfferChosen

--- Группа 2: Агентский ключ (ApiKey: {key}) ---
  [PASS] #12 Агентская комиссия — finAgent=true, комиссии пересчитаны

--- Группа 3: DirectRedirect (ApiKey: {key}) ---
  [PASS] #6  DirectRedirect — редирект на {домен}
  или
  [WARN] #6  DirectRedirect — не настроен на тестовом окружении

--- Группа 4: Постбеки ---
  [PASS] #14 Pampadu pending — ApplicationSubmitted
  [PASS] #14 Pampadu approved — CreditIssued
  [PASS] #14 Pampadu declined — CreditRejected
  [PASS] #15 Финуслуги issued — CreditIssued
  [PASS] #15 Финуслуги rejected — CreditRejected

=== ИТОГО: {passed}/{total} passed, {failed} failed, {warnings} warnings ===
```

## Правила

- Перед SQL-запросами вызвать `glossary(category="columns")`
- Если подходящий ключ не найден → `[WARN]`, не `[FAIL]`
- Фичи с "Не поддерживается" в столбце J → пропускать
- При ошибке API или БД → `[FAIL]` с текстом ошибки
- Группы выполняются последовательно (Playwright MCP не поддерживает параллельность)
- Для dropdown-полей: кликнуть на поле → дождаться списка → кликнуть на значение
- Для автокомплит-полей: вводить `slowly:true` → дождаться списка → кликнуть на подсказку
- Адреса: обязательно выбирать до дома (иначе валидация не пропустит)
