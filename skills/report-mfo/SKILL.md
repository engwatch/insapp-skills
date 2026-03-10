---
name: report-mfo
description: Use when user invokes /report-mfo or asks to create an MFO partner report. Takes partner name and period, queries insapp-db, outputs terminal table and optionally creates Google Sheet.
---

# MFO Partner Report Generator

## Overview

Creates an МФО partner report for a given partner and date period.

**Output:**
- Always: formatted table printed in the terminal (works without Google MCP)
- If Google Drive MCP available: also creates a Google Sheet from the template

**Invocation:** `/report-mfo [партнёр] [период]`
Examples:
- `/report-mfo "ЛОКО-БАНК" "6–10 марта 2026"`
- `/report-mfo "Тинькофф" "март 2026"`

**Requirements:**
- `insapp-db` MCP — required (all data queries)
- `gdrive` MCP — optional (Google Sheets creation)

---

## Report Columns

| Col | Name | Source |
|-----|------|--------|
| A | Дата | Each day in period |
| B | Переходов в МФО | Applications reaching SentToFinOrgs+ status |
| C | МФО (выдачи) | FinOrg names with CreditIssued |
| D | Выдачи | Count of CreditIssued |
| E | Входящее КВ | SUM(IncomingCommission from FinOffers) |
| F | Исходящее КВ (партнёр) | E × партнёр% |
| G | Доход Insapp | E × insapp% |
| H | CR | D / B |
| I | EPC | E / B |
| J | EPL | E / D |

---

## Step-by-Step

### 1. Parse arguments
Extract: partner name (substring), start date, end date.

### 2. Find partner in DB
```sql
-- InsappCoreProd
SELECT p.PartnerId, p.Name, ak.ApiKeyId
FROM Partners p
JOIN PartnerApiKeys ak ON p.PartnerId = ak.PartnerId
WHERE p.Name LIKE '%[партнёр]%' AND ak.IsActive = 1
ORDER BY p.Created DESC
```
If multiple partners found — pick the one with MFO (ProductTypeId=5) activity or ask user.

### 3. Query visits per day
```sql
-- InsappCoreProd
SELECT CAST(a.Created AS DATE) as Day, COUNT(*) as Visits
FROM Applications a
JOIN PartnerApiKeys ak ON a.ApiKeyId = ak.ApiKeyId
WHERE ak.PartnerId = '[PartnerId]'
  AND a.ProductTypeId = 5
  AND a.Created >= '[start_date]' AND a.Created < '[end_date+1]'
GROUP BY CAST(a.Created AS DATE)
ORDER BY Day
```

### 4. Query MFO transitions per day
"Переходы в МФО" = applications that reached SentToFinOrgs or any later status.
```sql
-- InsappCoreProd
SELECT CAST(a.Created AS DATE) as Day, COUNT(*) as Transitions
FROM Applications a
JOIN PartnerApiKeys ak ON a.ApiKeyId = ak.ApiKeyId
WHERE ak.PartnerId = '[PartnerId]'
  AND a.ProductTypeId = 5
  AND a.ApplicationStatusTypeId IN (
    '48b71dbc-a324-4035-9884-ec306bcd7b07', -- SentToFinOrgs
    '688d34b5-93a4-43bf-9a5c-05fbbfca8056', -- RejectAllFinOrgs
    '9770b0c2-a2e8-48e3-970b-f15413855e98', -- CreditInProcessing
    'f1f81273-3b1c-4412-961f-5c3ae741a8fd', -- CreditProcessed
    'f721fdc8-7175-4674-af8b-62ba4f42c247', -- CreditIssued
    '93dc7794-5564-4a4e-8bae-d8c5eb2590ab', -- CreditRejected
    'b7fec786-d840-4f31-a6bb-469a95a6016a'  -- OfferChosen
  )
  AND a.Created >= '[start_date]' AND a.Created < '[end_date+1]'
GROUP BY CAST(a.Created AS DATE)
ORDER BY Day
```

### 5. Query issuances + MFO names + incoming commission

First check FinOffers schema if needed: `mcp__insapp-db__schema` on table `FinOffers`.

```sql
-- InsappCoreProd
SELECT
  CAST(a.Created AS DATE) as Day,
  fo_org.Name as MFOName,
  COUNT(*) as Issuances,
  SUM(ISNULL(fo.IncomingCommission, 0)) as IncomingKV
FROM Applications a
JOIN PartnerApiKeys ak ON a.ApiKeyId = ak.ApiKeyId
JOIN FinLoans fl ON a.FinLoanId = fl.FinLoanId
JOIN FinOffers fo ON fl.FinLoanId = fo.FinLoanId
JOIN FinProducts fp ON fo.FinProductId = fp.FinProductId
JOIN FinOrgs fo_org ON fp.FinOrgId = fo_org.FinOrgId
WHERE ak.PartnerId = '[PartnerId]'
  AND a.ProductTypeId = 5
  AND a.ApplicationStatusTypeId = 'f721fdc8-7175-4674-af8b-62ba4f42c247'
  AND a.Created >= '[start_date]' AND a.Created < '[end_date+1]'
GROUP BY CAST(a.Created AS DATE), fo_org.Name
ORDER BY Day
```

**Commission fallback:** if FinOffers join fails, use `Applications.IncomingComissionAmount`.

### 6. Ask about commission split (if new partner)
If not already known for this partner, ask:
> "Какой % от входящего КВ получает партнёр? (например: партнёр 80%, Insapp 20%)"

### 7. Build daily data
For each day in the period, merge results from queries above. Days without data → fill zeros.

Calculate per row:
- F = E × партнёр%
- G = E × insapp%
- H = D / B (or 0 if B=0)
- I = E / B (or 0 if B=0)
- J = E / D (or 0 if D=0)

Calculate ИТОГО row: SUM for B–G; recalculate H, I, J from totals.

### 8. Print terminal table (ALWAYS)

Format as markdown table and output to the chat:

```
## Отчёт: [Партнёр] | [Период]

| Дата       | Переходов | МФО           | Выдачи | Вход. КВ  | Исх. КВ   | Доход    |   CR  |  EPC   |   EPL   |
|------------|-----------|---------------|--------|-----------|-----------|----------|-------|--------|---------|
| 06.03.2026 |       229 | OneClickMoney |      1 |  9 000 ₽  |  7 200 ₽  | 1 800 ₽  | 0.44% |  39 ₽  | 9 000 ₽ |
| 07.03.2026 |       169 | OneClickMoney |      2 | 18 000 ₽  | 14 400 ₽  | 3 600 ₽  | 1.18% | 107 ₽  | 9 000 ₽ |
| **ИТОГО**  |       398 | —             |      3 | 27 000 ₽  | 21 600 ₽  | 5 400 ₽  | 0.75% |  68 ₽  | 9 000 ₽ |
```

### 9. Create Google Sheet (only if gdrive MCP available)

**9a. Copy template**
```
mcp__gdrive__drive_copy_file:
  fileId: 1M0EImzWTNc916nhGs3ygBjYgB63Da055UMZl77QKkA8
  name: "Insapp | [Партнёр] отчёт — [Период]"
```
Note the new spreadsheet ID from the response.

**9b. Insert rows into table (if N_days > 1)**

Template has 1 header row + 1 empty data row (inside table) + ИТОГО at row 3.
To add more rows while keeping table formatting, insert N_days-1 rows **inside** the table at index 1:

```
If N_days > 1:
  mcp__gdrive__gsheets_insert_rows:
    spreadsheetId: [NEW_ID]
    sheetId: [from gsheets_list_sheets]
    startIndex: 1          ← inserts between header (row 1) and data row (row 2)
    count: N_days - 1
    inheritFromBefore: false
```

Result: rows 2..N_days+1 are table-formatted data rows, ИТОГО shifts to row N_days+2.

**9c. Fill data rows via batch update**

Use `gsheets_batch_update` with `valueInputOption: USER_ENTERED`.
`updates` must be a **native array**, not a JSON string — pass it as an object, never stringify.

Fill rows 2 through N_days+1. For each data row:
- A: `DD.MM.YYYY`
- B–E: numeric values
- F: `=E{row}*{partner_pct}` e.g. `=E2*0,8`
- G: `=E{row}*{insapp_pct}` e.g. `=E2*0,2`
- H: `=ЕСЛИОШИБКА(D{row}/B{row};0)`
- I: `=ЕСЛИОШИБКА(E{row}/B{row};0)`
- J: `=ЕСЛИОШИБКА(E{row}/D{row};0)`

**Russian locale:** decimal `,` not `.` → `=E2*0,8`; function args `;` not `,` → `=ЕСЛИОШИБКА(D2/B2;0)`

**9d. Write ИТОГО row**

ИТОГО is at row N_days+2. Write it explicitly with correct range:

```
range: "Итого!A{N+2}:J{N+2}"
values: [["ИТОГО", "=СУММ(B2:B{N+1})", "—", "=СУММ(D2:D{N+1})",
          "=СУММ(E2:E{N+1})", "=СУММ(F2:F{N+1})", "=СУММ(G2:G{N+1})",
          "=ЕСЛИОШИБКА(D{N+2}/B{N+2};0)", "=ЕСЛИОШИБКА(E{N+2}/B{N+2};0)",
          "=ЕСЛИОШИБКА(E{N+2}/D{N+2};0)"]]
```

Examples:
- 2-day period → data rows 2–3, ИТОГО at row 4: `=СУММ(B2:B3)` etc.
- 19-day period → data rows 2–20, ИТОГО at row 21: `=СУММ(B2:B20)` etc.

**Do NOT use Playwright** — template copy preserves table format, column widths, and number formats.

**9e. Return link**
```
https://docs.google.com/spreadsheets/d/[NEW_ID]/edit
```

---

## Notes

- **Days with no issuances:** include row with visits/transitions, C=`—`, D/E=0
- **Multiple MFOs per day:** comma-separate names in C, sum issuances in D
- **ЛОКО split:** partner=80% (`=E*0,8`), Insapp=20% (`=E*0,2`)
- **Template copy preserves everything** — table format, column widths, number formats carry over automatically; no Playwright needed
- **Template structure:** 1 header row + 1 empty data row (inside Table) + ИТОГО at row 3 — truly flexible, any number of days
- **Rows are inserted, not deleted** — insert N-1 rows inside table at index 1, then write data + ИТОГО
- **Always use MCP** for data/formula changes; Playwright only if something truly cannot be done via MCP
- **Template ID:** `1M0EImzWTNc916nhGs3ygBjYgB63Da055UMZl77QKkA8` — never modify, always copy
