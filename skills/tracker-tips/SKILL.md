# Навык: Яндекс Трекер MCP — резолв аккаунтов и особенности

## Когда применять
Когда работаешь с Яндекс Трекером через MCP-инструменты и нужно найти пользователя или получить статистику.

## Резолв пользователей

### resolve_user
Работает по **русскому имени**, не по кратким алиасам:
- ✅ "Климов", "Сергей Климов", "Дмитрий Листопад"
- ❌ "KlimovS", "Svistunov", "klimov"

### get_employee_stats
Требует **старый логин** (Яндекс паспорт) ИЛИ полное русское имя:
- ✅ saklimo6 (Климов), alexandersv1 (Свистунов), l1stdmit (Листопад)
- ❌ klimov, svistunov, listopad (новые логины)

### search_issues
Требует **новый логин**:
- ✅ klimov, svistunov, listopad, kotov, tkachenko, seriy
- ❌ saklimo6, alexandersv1 (старые — работают только для задач на старом аккаунте)

## Маппинг логинов команды

| Псевдоним | Старый логин | Новый логин | Трекер-логин |
|---|---|---|---|
| KlimovS | saklimo6 | klimov | klimov |
| Svistunov | alexandersv1 | svistunov | svistunov |
| Listopad | l1stdmit | listopad | listopad |
| hlopov | dmtree | dmitryih | dmitryih |
| KotovI | trumpet-timmy | kotov | kotov |
| TkachenkoP | — | tkachenko | tkachenko |
| GrayLion | swtorsochi | seriy | seriy |
| Damaskin | — | — | janrayn (!!) |
| Tarasov | — | — | не ведёт задач |

## Важно
- **Damaskin в Трекере = janrayn**, НЕ damaskin!
- **Ворклоги** = 0 у всех (команда не логирует время)
- **Тарасов** не ведёт задачи в Трекере
- При объединении данных из разных инструментов — разные логины для одного человека
