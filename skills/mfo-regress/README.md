# MFO Regress

Скилл для Claude Code — автоматический регресс МФО-фич на тестовом окружении.

## Что тестирует

Последовательно прогоняет 4 группы тестов, покрывающих основной флоу МФО-витрины:

### Группа 1: Основной флоу (Playwright + БД)
- **#20 FinLandingConfig** — конфиг витрины в ответе New
- **#18 Сохранение контактов** — статус ContactsFilled после заполнения формы
- **#16 Трекинг этапов** — цепочка ContactsFilled -> FinDocumentsFilled -> FinAddressFilled
- **#9 Реферальные офферы** — генерация реф-офферов при заходе на витрину
- **#5 Порядок офферов** — соответствие Priority из PartnerFinProductsRules
- **#21 ShowBadges** — cardText/cardColor при ShowBadges=false
- **#19 Фиксация клика** — SelectedDate, ReferralStage=3 при клике на оффер
- **#17 Статусы воронки** — полная цепочка до OfferChosen, разделение API/REF

### Группа 2: Агентский ключ (Playwright + БД)
- **#12 Агентская комиссия** — finAgent=true, agentComissionFrom/To в офферах

### Группа 3: DirectRedirect (Playwright)
- **#6 DirectRedirect** — редирект через /marketing/redirect на домен МФО

### Группа 4: Постбеки (API + БД)
- **#14 Pampadu** — pending/approved/declined через /FinApp/Postback
- **#15 Финуслуги** — issued/rejected через /FinApp/FinuslugiRefPostback
- **Реф-постбек** — CreditInProcessing/CreditIssued/CreditRejected через /FinOrg/RefPostback

## Использование

```
/mfo-regress
```

Можно указать окружение для отдельных групп:

```
/mfo-regress (1 группу тестируй на https://test-gpb.insapp.ru/)
```

## Окружение по умолчанию

- Фронт: `test-money.insapp.ru`
- API: `test-api.insapp.pro`
- БД: `InsappCoreTest`

## Требования

- [insapp-db MCP](https://db-mcp.insapp.pro) — доступ к базе InsappCoreTest
- [Playwright MCP](https://github.com/anthropics/playwright-mcp) — UI-тестирование витрины
- [Google Sheets MCP](https://github.com/nicobailey/google-sheets-mcp) — чтение реестра фич

## Источник фич

Реестр фич хранится в [Google Sheets](https://docs.google.com/spreadsheets/d/1PBLgeDZGEyeqc7Zqpje8iB79D5KiqLJJmBj0_eDfQQA) — лист "Реестр фич". Фичи с "Не поддерживается" в столбце J и "---" в столбце K пропускаются.

## Формат отчёта

```
=== РЕГРЕСС МФО ===
Дата: 2026-03-26
Окружение: test-money.insapp.ru

--- Группа 1: Основной флоу (ApiKey: ...) ---
  [PASS] #20 FinLandingConfig — ...
  [PASS] #18 SaveContacts — ...
  ...

--- Группа 4: Постбеки ---
  [PASS] #14 Pampadu pending — ApplicationSubmitted
  [PASS] RefPostback CreditInProcessing — ApplicationSubmitted
  ...

=== ИТОГО: 15/16 passed, 1 failed, 0 warnings ===
```

Статусы:
- **[PASS]** — проверка пройдена
- **[FAIL]** — проверка не пройдена (с описанием ошибки)
- **[WARN]** — предусловие не выполнено (ключ не найден и т.п.)

## Принцип

Лучше ложный FAIL, чем ложный PASS. Каждое утверждение верифицируется фактами: response body, SQL-результат, snapshot.

## Автор

Оригинал: [@svistunov](https://git.insapp.pro/Svistunov) — [insapp-skills](https://git.insapp.pro/Svistunov/insapp-skills/-/tree/main/regress)
