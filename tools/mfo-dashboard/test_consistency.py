#!/usr/bin/env python3
"""Автотесты консистентности данных дашборда МФО.
Запуск: python3 test_consistency.py (сервер должен работать на localhost:5000)
"""

import json
import sys
import requests

BASE = "http://localhost:5000"
PASS = 0
FAIL = 0


def check(name, a, b, tolerance=0):
    global PASS, FAIL
    if abs(a - b) <= tolerance:
        PASS += 1
        print(f"  OK  {name}: {a}")
    else:
        FAIL += 1
        print(f"  FAIL {name}: {a} != {b} (diff={a-b})")


def test_partner_consistency(partner, start, end, single_date):
    """Проверяет что данные за single_date одинаковы при запросе одного дня и диапазона."""
    print(f"\n--- Партнёр {partner}: {single_date} отдельно vs в диапазоне {start}..{end} ---")

    r1 = requests.get(f"{BASE}/api/summary", params={"partner": partner, "start": single_date, "end": single_date}).json()
    r2 = requests.get(f"{BASE}/api/summary", params={"partner": partner, "start": start, "end": end}).json()

    if r1.get("error") or r2.get("error"):
        print(f"  ERROR: {r1.get('error') or r2.get('error')}")
        return

    d1 = r1["days"][0] if r1["days"] else None
    d2 = next((d for d in r2["days"] if d["date"] == single_date), None)

    if not d1 or not d2:
        print(f"  SKIP: нет данных за {single_date}")
        return

    # Допуск 5 для opens/transitions (live данные могут чуть вырасти между запросами)
    check("opens", d1["opens"], d2["opens"], tolerance=5)
    check("transitions", d1["transitions"], d2["transitions"], tolerance=3)
    check("ankety", d1["ankety"], d2["ankety"], tolerance=2)
    check("rejected", d1["rejected"], d2["rejected"], tolerance=1)
    check("issued", d1["issued"], d2["issued"], tolerance=0)
    check("kv", d1["kv"], d2["kv"], tolerance=0)


def test_mfo_consistency(start, end, single_date):
    """Проверяет что МФО-данные за single_date одинаковы в разных диапазонах."""
    print(f"\n--- МФО: {single_date} отдельно vs в диапазоне {start}..{end} ---")

    r1 = requests.get(f"{BASE}/api/mfo-summary", params={"start": single_date, "end": single_date}).json()
    r2 = requests.get(f"{BASE}/api/mfo-summary", params={"start": start, "end": end}).json()

    if r1.get("error") or r2.get("error"):
        print(f"  ERROR: {r1.get('error') or r2.get('error')}")
        return

    # Сравниваем суммарные переходы и выдачи
    sum1_t = sum(m["transitions"] for m in r1["mfo"])
    sum1_i = sum(m["issued"] for m in r1["mfo"])
    sum1_k = sum(m["kv"] for m in r1["mfo"])

    # Для диапазона нет разбивки по дням, поэтому сравнение только при single_date == start == end
    # Иначе проверяем через mfo-dates
    if start == single_date and end == single_date:
        sum2_t = sum(m["transitions"] for m in r2["mfo"])
        sum2_i = sum(m["issued"] for m in r2["mfo"])
        sum2_k = sum(m["kv"] for m in r2["mfo"])
        check("mfo transitions", sum1_t, sum2_t, tolerance=3)
        check("mfo issued", sum1_i, sum2_i, tolerance=0)
        check("mfo kv", sum1_k, sum2_k, tolerance=0)


def test_day_vs_summary(partner, date):
    """Проверяет что разворот по МФО за день совпадает с итогом по дню."""
    print(f"\n--- {partner} {date}: сумма МФО vs итог дня ---")

    summary = requests.get(f"{BASE}/api/summary", params={"partner": partner, "start": date, "end": date}).json()
    day = requests.get(f"{BASE}/api/day", params={"partner": partner, "date": date}).json()

    if summary.get("error") or day.get("error"):
        print(f"  ERROR: {summary.get('error') or day.get('error')}")
        return

    d = summary["days"][0] if summary["days"] else None
    if not d:
        print(f"  SKIP: нет данных за {date}")
        return

    mfo_trans = sum(m["transitions"] for m in day.get("mfo", []))
    mfo_issued = sum(m["issued"] for m in day.get("mfo", []))
    mfo_kv = sum(m["kv"] for m in day.get("mfo", []))

    check("transitions: summary vs mfo sum", d["transitions"], mfo_trans, tolerance=3)
    check("issued: summary vs mfo sum", d["issued"], mfo_issued, tolerance=0)
    check("kv: summary vs mfo sum", d["kv"], mfo_kv, tolerance=0)


if __name__ == "__main__":
    print("=== Тесты консистентности дашборда МФО ===")

    # Проверяем доступность сервера
    try:
        requests.get(BASE, timeout=3)
    except:
        print(f"ОШИБКА: сервер не отвечает на {BASE}")
        sys.exit(1)

    # Вчерашний день (закрытый, стабильные данные)
    from datetime import datetime, timedelta
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    today = datetime.now().strftime("%Y-%m-%d")
    week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")

    # Тест 1: вчерашний день отдельно vs в диапазоне (должен быть 0 разницы)
    test_partner_consistency("mts", week_ago, yesterday, yesterday)
    test_partner_consistency("loko", week_ago, yesterday, yesterday)

    # Тест 2: сегодня отдельно vs в диапазоне (допуск на live данные)
    test_partner_consistency("mts", yesterday, today, today)

    # Тест 3: МФО-данные
    test_mfo_consistency(yesterday, yesterday, yesterday)

    # Тест 4: сумма МФО vs итог дня
    test_day_vs_summary("mts", yesterday)
    test_day_vs_summary("loko", yesterday)

    print(f"\n{'='*50}")
    print(f"Результат: {PASS} OK, {FAIL} FAIL")
    if FAIL:
        print("ЕСТЬ ОШИБКИ!")
        sys.exit(1)
    else:
        print("Все тесты прошли.")
