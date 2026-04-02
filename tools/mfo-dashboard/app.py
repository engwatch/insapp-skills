#!/usr/bin/env python3
"""MFO Dashboard — Insapp Report Viewer
Запуск: python3 app.py → http://localhost:5000
"""

import os
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, render_template, send_from_directory
from config import PARTNERS, DATE_RE
from mcp_client import MCPClient

mcp = MCPClient()
app = Flask(__name__,
            template_folder=os.path.join(os.path.dirname(__file__), "templates"),
            static_folder=os.path.join(os.path.dirname(__file__), "static"))


def safe_date(s):
    return s if s and DATE_RE.match(s) else None

def flt(v):
    try:
        return float(v or 0)
    except:
        return 0.0


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/summary")
def api_summary():
    pk = request.args.get("partner", "mts")
    start = safe_date(request.args.get("start"))
    end = safe_date(request.args.get("end"))
    if not start or not end:
        return jsonify(error="start/end required"), 400
    p = PARTNERS.get(pk)
    if not p:
        return jsonify(error="unknown partner"), 400

    pid = p["id"]
    end_excl = (datetime.strptime(end, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")

    opens = mcp.query(f"""
        SELECT CAST(a.Created AS DATE) as dt, COUNT(*) as v
        FROM Applications a JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
        WHERE ak.PartnerId='{pid}' AND a.ProductTypeId=5 AND a.ChannelTypeId=2
          AND a.Created>='{start}' AND a.Created<'{end_excl}'
        GROUP BY CAST(a.Created AS DATE)""", "opens")

    trans = mcp.query(f"""
        SELECT CAST(a.Created AS DATE) as dt, COUNT(*) as v
        FROM FinOffers ff JOIN Applications a ON ff.ApplicationId=a.ApplicationId
          JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
        WHERE ff.SelectedDate IS NOT NULL AND ak.PartnerId='{pid}'
          AND a.ProductTypeId=5 AND a.ChannelTypeId=2
          AND a.Created>='{start}' AND a.Created<'{end_excl}'
        GROUP BY CAST(a.Created AS DATE)""", "transitions")

    anke = mcp.query(f"""
        SELECT CAST(a.Created AS DATE) as dt, COUNT(DISTINCT s.ApplicationId) as v
        FROM ApplicationStatuses s JOIN Applications a ON s.ApplicationId=a.ApplicationId
          JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
        WHERE s.ApplicationStatusTypeId='b1a2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6'
          AND ak.PartnerId='{pid}' AND a.ProductTypeId=5 AND a.ChannelTypeId=2
          AND a.Created>='{start}' AND a.Created<'{end_excl}'
        GROUP BY CAST(a.Created AS DATE)""", "ankety")

    rej = mcp.query(f"""
        SELECT CAST(a.Created AS DATE) as dt, COUNT(*) as v
        FROM FinOffers ff JOIN Applications a ON ff.ApplicationId=a.ApplicationId
          JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
        WHERE ff.OfferStatusTypeId=3 AND ak.PartnerId='{pid}'
          AND a.ProductTypeId=5 AND a.ChannelTypeId=2
          AND a.Created>='{start}' AND a.Created<'{end_excl}'
        GROUP BY CAST(a.Created AS DATE)""", "rejections")

    iss = mcp.query(f"""
        SELECT dt, COUNT(*) as issued, SUM(kv) as kv FROM (
          SELECT DISTINCT a.ApplicationId, CAST(a.Created AS DATE) as dt, a.IncomingComissionAmount as kv
          FROM ApplicationStatuses s JOIN Applications a ON s.ApplicationId=a.ApplicationId
            JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
            JOIN ApplicationStatusTypes stt ON s.ApplicationStatusTypeId=stt.Id
            JOIN FinOffers ff ON a.ApplicationId=ff.ApplicationId AND ff.OfferStatusTypeId=6
          WHERE stt.[Index]=305 AND ak.PartnerId='{pid}'
            AND a.ProductTypeId=5 AND a.ChannelTypeId=2
            AND a.Created>='{start}' AND a.Created<'{end_excl}'
        ) sub GROUP BY dt""", "issued")

    anke_total_rows = mcp.query(f"""
        SELECT COUNT(DISTINCT s.ApplicationId) as v
        FROM ApplicationStatuses s JOIN Applications a ON s.ApplicationId=a.ApplicationId
          JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
        WHERE s.ApplicationStatusTypeId='b1a2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6'
          AND ak.PartnerId='{pid}' AND a.ProductTypeId=5 AND a.ChannelTypeId=2
          AND a.Created>='{start}' AND a.Created<'{end_excl}'""", "ankety total")

    # Merge по дням
    days = {}
    for r in opens:
        d = str(r["dt"])[:10]; days.setdefault(d, {})["opens"] = r["v"]
    for r in trans:
        d = str(r["dt"])[:10]; days.setdefault(d, {})["transitions"] = r["v"]
    for r in anke:
        d = str(r["dt"])[:10]; days.setdefault(d, {})["ankety"] = r["v"]
    for r in rej:
        d = str(r["dt"])[:10]; days.setdefault(d, {})["rejected"] = r["v"]
    for r in iss:
        d = str(r["dt"])[:10]; dd = days.setdefault(d, {}); dd["issued"] = r["issued"]; dd["kv"] = flt(r["kv"])

    result = [{"date": dt, "opens": days[dt].get("opens", 0), "transitions": days[dt].get("transitions", 0),
               "ankety": days[dt].get("ankety", 0), "rejected": days[dt].get("rejected", 0),
               "issued": days[dt].get("issued", 0), "kv": days[dt].get("kv", 0)} for dt in sorted(days)]

    return jsonify(partner=p, days=result, ankety_total=anke_total_rows[0]["v"] if anke_total_rows else 0)


@app.route("/api/day")
def api_day():
    pk = request.args.get("partner", "mts")
    date = safe_date(request.args.get("date"))
    p = PARTNERS.get(pk)
    if not p or not date:
        return jsonify(error="partner/date required"), 400
    pid = p["id"]

    rows = mcp.query(f"""
        WITH transitions AS (
          SELECT fo.Name as mfo, COUNT(*) as transitions
          FROM FinOffers ff JOIN Applications a ON ff.ApplicationId=a.ApplicationId
            JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId JOIN FinOrgs fo ON ff.FinOrgId=fo.FinOrgId
          WHERE ff.SelectedDate IS NOT NULL AND ak.PartnerId='{pid}'
            AND a.ProductTypeId=5 AND a.ChannelTypeId=2 AND CAST(a.Created AS DATE)='{date}'
          GROUP BY fo.Name
        ),
        ankety AS (
          SELECT fo.Name as mfo, COUNT(DISTINCT s.ApplicationId) as ankety
          FROM ApplicationStatuses s JOIN Applications a ON s.ApplicationId=a.ApplicationId
            JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
            JOIN FinOffers ff ON a.ApplicationId=ff.ApplicationId AND ff.SelectedDate IS NOT NULL
            JOIN FinOrgs fo ON ff.FinOrgId=fo.FinOrgId
          WHERE s.ApplicationStatusTypeId='b1a2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6'
            AND ak.PartnerId='{pid}' AND a.ProductTypeId=5 AND a.ChannelTypeId=2
            AND CAST(a.Created AS DATE)='{date}'
          GROUP BY fo.Name
        ),
        rejections AS (
          SELECT fo.Name as mfo, COUNT(*) as rejected
          FROM FinOffers ff JOIN Applications a ON ff.ApplicationId=a.ApplicationId
            JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId JOIN FinOrgs fo ON ff.FinOrgId=fo.FinOrgId
          WHERE ff.OfferStatusTypeId=3 AND ak.PartnerId='{pid}'
            AND a.ProductTypeId=5 AND a.ChannelTypeId=2 AND CAST(a.Created AS DATE)='{date}'
          GROUP BY fo.Name
        ),
        issued AS (
          SELECT fo.Name as mfo, COUNT(*) as issued, SUM(kv) as kv FROM (
            SELECT DISTINCT a.ApplicationId, a.IncomingComissionAmount as kv, ff.FinOrgId
            FROM ApplicationStatuses s JOIN Applications a ON s.ApplicationId=a.ApplicationId
              JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
              JOIN ApplicationStatusTypes stt ON s.ApplicationStatusTypeId=stt.Id
              JOIN FinOffers ff ON a.ApplicationId=ff.ApplicationId AND ff.OfferStatusTypeId=6
            WHERE stt.[Index]=305 AND ak.PartnerId='{pid}'
              AND a.ProductTypeId=5 AND a.ChannelTypeId=2 AND CAST(a.Created AS DATE)='{date}'
          ) sub JOIN FinOrgs fo ON sub.FinOrgId=fo.FinOrgId GROUP BY fo.Name
        )
        SELECT t.mfo, t.transitions, ISNULL(an.ankety,0) as ankety,
          ISNULL(r.rejected,0) as rejected, ISNULL(i.issued,0) as issued, ISNULL(i.kv,0) as kv
        FROM transitions t
          LEFT JOIN ankety an ON t.mfo=an.mfo LEFT JOIN rejections r ON t.mfo=r.mfo
          LEFT JOIN issued i ON t.mfo=i.mfo
        ORDER BY t.transitions DESC""", f"MFO {date}")

    for r in rows:
        r["kv"] = flt(r.get("kv", 0))
    return jsonify(mfo=rows)


if __name__ == "__main__":
    print("MFO Dashboard: http://localhost:5000")
    app.run(debug=True, port=5000, host="0.0.0.0")
