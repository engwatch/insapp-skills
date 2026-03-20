# MFO Health Check

Скилл для Claude Code — автоматическая диагностика финансовых продуктов (МФО) в Insapp.

## Что проверяет

- **Общая картина** — заявки, офферы и постбеки за последние 24ч
- **ErrorLogs** — ошибки в логах по FinProducts
- **Комиссии** — провальные расчёты в ComissionLogs (FinOrgCalc / PartnerCalc)
- **Постбеки** — обработка RefPostback, Pampadu, Finuslugi (Ref и API)
- **Выдачи** — CreditIssued без зафиксированного SelectedDate

## Использование

```
/mfo-health-check
```

По умолчанию проверяет последние 24 часа. Период можно указать явно.

## Требования

- [insapp-db MCP](https://db-mcp.insapp.pro) — доступ к базам InsappCoreProd и InsappLogProd

## Формат отчёта

Итоговый статус:
- ✅ **HEALTHY** — все проверки пройдены
- ⚠️ **WARNINGS** — единичные некритичные ошибки
- ❌ **CRITICAL** — активные ошибки, провальные комиссии или незафиксированные выдачи

## Автор

[@svistunov](https://git.insapp.pro/Svistunov) — оригинал в [insapp-skills](https://git.insapp.pro/Svistunov/insapp-skills/-/tree/main/mfo-health-check)
