---
name: convert-to-table
description: Use when a Google Sheet range needs to be converted into a structured Table (with filter dropdowns, sorting, named table) via Playwright — MCP has no such capability
---

# Convert to Table (Google Sheets)

## Overview

Google Sheets has a "Преобразовать в таблицу" (Convert to Table) feature that turns a plain range into a structured table with:
- Named table badge (e.g. "Таблица1")
- Filter/sort dropdown arrows on each column header
- Automatic alternating row styling

**MCP cannot do this** — no tool available. Use Playwright `browser_run_code`.

**No dialog appears** — conversion happens instantly on click.

## Steps

### 1. Navigate to the spreadsheet

```js
await page.goto('https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit');
await page.waitForTimeout(3000);
```

### 2. Select the data range via Name Box

```js
await page.locator('#t-name-box').click();
await page.locator('#t-name-box').fill('A1:C10'); // include header row
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
```

### 3. Right-click in the data area of the selection

```js
// Canvas starts at y=142. Row 1 (header) ≈ y=162, Row 2 (data) ≈ y=182-202
// Right-click anywhere within the selected range (avoid column headers row at y≈152)
await page.mouse.click(200, 192, { button: 'right' });
await page.waitForTimeout(500);
```

### 4. Click "Преобразовать в таблицу"

```js
await page.getByRole('menuitem', { name: /Преобразовать в таблицу/ }).click();
await page.waitForTimeout(1000);
```

## Full One-Shot Code Block

```js
async (page) => {
  // 1. Navigate (skip if already on the sheet)
  await page.goto('https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit');
  await page.waitForTimeout(3000);

  // 2. Select range including headers
  await page.locator('#t-name-box').click();
  await page.locator('#t-name-box').fill('A1:C10');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  // 3. Right-click in data area (NOT column letter headers at y≈152)
  await page.mouse.click(200, 192, { button: 'right' });
  await page.waitForTimeout(500);

  // 4. Convert — no dialog, instant
  await page.getByRole('menuitem', { name: /Преобразовать в таблицу/ }).click();
  await page.waitForTimeout(1000);
}
```

Pass to `mcp__plugin_playwright_playwright__browser_run_code`.

## Notes

- **Include header row** in the selection — Google Sheets auto-detects it as the table header
- **y=192 is safe** for the right-click — that's row 2 of data, well within canvas data area
- **No dialog** — unlike column resize, this converts instantly with no confirmation
- **Regex match** `/Преобразовать в таблицу/` also matches the "Новое" badge variant
- **Don't use `browser_click` with coordinates** — always use `browser_run_code` with `page.mouse.click()`
- **Canvas y=142** — always fixed in Google Sheets; row heights ≈ 20px each
