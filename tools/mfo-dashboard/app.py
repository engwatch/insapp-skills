#!/usr/bin/env python3
"""MFO Dashboard — Insapp Report Viewer
Запуск: python3 app.py → http://localhost:5000
"""

import os
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, render_template, send_from_directory
import requests as req
from config import PARTNERS, DATE_RE, SHOWCASE_API, SHOWCASE_AUTH_INTERNAL, SHOWCASE_AUTH_CACHE
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
    # Wide range for index seek + CAST for accurate date filtering (Created is datetimeoffset +03:00)
    start_w = (datetime.strptime(start, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
    end_w = (datetime.strptime(end, "%Y-%m-%d") + timedelta(days=2)).strftime("%Y-%m-%d")
    pf = f"ak.PartnerId='{pid}' AND a.ProductTypeId=5 AND a.ChannelTypeId=2 AND a.Created>='{start_w}' AND a.Created<'{end_w}' AND CAST(a.Created AS DATE)>='{start}' AND CAST(a.Created AS DATE)<='{end}'"

    rows = mcp.query(f"""
        WITH opens AS (
          SELECT CAST(a.Created AS DATE) as dt, COUNT(*) as opens
          FROM Applications a JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
          WHERE {pf} GROUP BY CAST(a.Created AS DATE)
        ),
        transitions AS (
          SELECT CAST(a.Created AS DATE) as dt, COUNT(*) as transitions
          FROM FinOffers ff JOIN Applications a ON ff.ApplicationId=a.ApplicationId
            JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
          WHERE ff.SelectedDate IS NOT NULL AND {pf}
          GROUP BY CAST(a.Created AS DATE)
        ),
        ankety AS (
          SELECT CAST(a.Created AS DATE) as dt, COUNT(DISTINCT s.ApplicationId) as ankety
          FROM ApplicationStatuses s JOIN Applications a ON s.ApplicationId=a.ApplicationId
            JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
          WHERE s.ApplicationStatusTypeId='b1a2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6' AND {pf}
          GROUP BY CAST(a.Created AS DATE)
        ),
        rejections AS (
          SELECT CAST(a.Created AS DATE) as dt, COUNT(*) as rejected
          FROM FinOffers ff JOIN Applications a ON ff.ApplicationId=a.ApplicationId
            JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
          WHERE ff.OfferStatusTypeId=3 AND {pf}
          GROUP BY CAST(a.Created AS DATE)
        ),
        issued AS (
          SELECT dt, COUNT(*) as issued, SUM(kv) as kv FROM (
            SELECT DISTINCT a.ApplicationId, CAST(a.Created AS DATE) as dt, a.IncomingComissionAmount as kv
            FROM ApplicationStatuses s JOIN Applications a ON s.ApplicationId=a.ApplicationId
              JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
              JOIN ApplicationStatusTypes stt ON s.ApplicationStatusTypeId=stt.Id
              JOIN FinOffers ff ON a.ApplicationId=ff.ApplicationId AND ff.OfferStatusTypeId=6
            WHERE stt.[Index]=305 AND {pf}
          ) sub GROUP BY dt
        ),
        ankety_total AS (
          SELECT COUNT(DISTINCT s.ApplicationId) as ankety_total
          FROM ApplicationStatuses s JOIN Applications a ON s.ApplicationId=a.ApplicationId
            JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
          WHERE s.ApplicationStatusTypeId='b1a2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6' AND {pf}
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
        ORDER BY o.dt""", "partner summary")

    result = [{"date": str(r["dt"])[:10], "opens": r["opens"], "transitions": r["transitions"],
               "ankety": r["ankety"], "rejected": r["rejected"],
               "issued": r["issued"], "kv": flt(r["kv"])} for r in rows]

    ankety_total = rows[0]["ankety_total"] if rows else 0
    return jsonify(partner=p, days=result, ankety_total=ankety_total)


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


@app.route("/api/mfo-summary")
def api_mfo_summary():
    start = safe_date(request.args.get("start"))
    end = safe_date(request.args.get("end"))
    if not start or not end:
        return jsonify(error="start/end required"), 400
    start_w = (datetime.strptime(start, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
    end_w = (datetime.strptime(end, "%Y-%m-%d") + timedelta(days=2)).strftime("%Y-%m-%d")
    af = f"a.ProductTypeId=5 AND a.ChannelTypeId=2 AND a.Created>='{start_w}' AND a.Created<'{end_w}' AND CAST(a.Created AS DATE)>='{start}' AND CAST(a.Created AS DATE)<='{end}'"

    rows = mcp.query(f"""
        WITH transitions AS (
          SELECT fo.Name as mfo, COUNT(*) as transitions
          FROM Applications a JOIN FinOffers ff ON a.ApplicationId=ff.ApplicationId
            JOIN FinOrgs fo ON ff.FinOrgId=fo.FinOrgId
          WHERE ff.SelectedDate IS NOT NULL AND {af}
          GROUP BY fo.Name
        ),
        ankety AS (
          SELECT fo.Name as mfo, COUNT(DISTINCT s.ApplicationId) as ankety
          FROM Applications a JOIN FinOffers ff ON a.ApplicationId=ff.ApplicationId AND ff.SelectedDate IS NOT NULL
            JOIN FinOrgs fo ON ff.FinOrgId=fo.FinOrgId
            JOIN ApplicationStatuses s ON a.ApplicationId=s.ApplicationId
          WHERE s.ApplicationStatusTypeId='b1a2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6' AND {af}
          GROUP BY fo.Name
        ),
        rejections AS (
          SELECT fo.Name as mfo, COUNT(*) as rejected
          FROM Applications a JOIN FinOffers ff ON a.ApplicationId=ff.ApplicationId
            JOIN FinOrgs fo ON ff.FinOrgId=fo.FinOrgId
          WHERE ff.OfferStatusTypeId=3 AND {af}
          GROUP BY fo.Name
        ),
        issued AS (
          SELECT fo.Name as mfo, COUNT(*) as issued, SUM(kv) as kv FROM (
            SELECT DISTINCT a.ApplicationId, a.IncomingComissionAmount as kv, ff.FinOrgId
            FROM Applications a JOIN ApplicationStatuses s ON a.ApplicationId=s.ApplicationId
              JOIN ApplicationStatusTypes stt ON s.ApplicationStatusTypeId=stt.Id
              JOIN FinOffers ff ON a.ApplicationId=ff.ApplicationId AND ff.OfferStatusTypeId=6
            WHERE stt.[Index]=305 AND {af}
          ) sub JOIN FinOrgs fo ON sub.FinOrgId=fo.FinOrgId GROUP BY fo.Name
        )
        SELECT t.mfo, t.transitions, ISNULL(an.ankety,0) as ankety,
          ISNULL(r.rejected,0) as rejected, ISNULL(i.issued,0) as issued, ISNULL(i.kv,0) as kv
        FROM transitions t
          LEFT JOIN ankety an ON t.mfo=an.mfo
          LEFT JOIN rejections r ON t.mfo=r.mfo
          LEFT JOIN issued i ON t.mfo=i.mfo
        ORDER BY t.transitions DESC""", "mfo summary")

    result = [{"mfo": r["mfo"], "transitions": r["transitions"], "ankety": r["ankety"],
               "rejected": r["rejected"], "issued": r["issued"], "kv": flt(r["kv"])} for r in rows]
    return jsonify(mfo=result)


@app.route("/api/mfo-dates")
def api_mfo_dates():
    mfo_name = request.args.get("mfo", "")
    mfo_safe = mfo_name.replace("'", "''")
    start = safe_date(request.args.get("start"))
    end = safe_date(request.args.get("end"))
    if not mfo_name or not start or not end:
        return jsonify(error="mfo/start/end required"), 400
    start_w = (datetime.strptime(start, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
    end_w = (datetime.strptime(end, "%Y-%m-%d") + timedelta(days=2)).strftime("%Y-%m-%d")
    af = f"a.ProductTypeId=5 AND a.ChannelTypeId=2 AND a.Created>='{start_w}' AND a.Created<'{end_w}' AND CAST(a.Created AS DATE)>='{start}' AND CAST(a.Created AS DATE)<='{end}'"
    mf = f"fo.Name=N'{mfo_safe}'"

    rows = mcp.query(f"""
        WITH transitions AS (
          SELECT CAST(a.Created AS DATE) as dt, COUNT(*) as transitions
          FROM Applications a JOIN FinOffers ff ON a.ApplicationId=ff.ApplicationId
            JOIN FinOrgs fo ON ff.FinOrgId=fo.FinOrgId
          WHERE ff.SelectedDate IS NOT NULL AND {mf} AND {af}
          GROUP BY CAST(a.Created AS DATE)
        ),
        ankety AS (
          SELECT CAST(a.Created AS DATE) as dt, COUNT(DISTINCT s.ApplicationId) as ankety
          FROM Applications a JOIN FinOffers ff ON a.ApplicationId=ff.ApplicationId AND ff.SelectedDate IS NOT NULL
            JOIN FinOrgs fo ON ff.FinOrgId=fo.FinOrgId
            JOIN ApplicationStatuses s ON a.ApplicationId=s.ApplicationId
          WHERE s.ApplicationStatusTypeId='b1a2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6' AND {mf} AND {af}
          GROUP BY CAST(a.Created AS DATE)
        ),
        rejections AS (
          SELECT CAST(a.Created AS DATE) as dt, COUNT(*) as rejected
          FROM Applications a JOIN FinOffers ff ON a.ApplicationId=ff.ApplicationId
            JOIN FinOrgs fo ON ff.FinOrgId=fo.FinOrgId
          WHERE ff.OfferStatusTypeId=3 AND {mf} AND {af}
          GROUP BY CAST(a.Created AS DATE)
        ),
        issued AS (
          SELECT dt, COUNT(*) as issued, SUM(kv) as kv FROM (
            SELECT DISTINCT a.ApplicationId, CAST(a.Created AS DATE) as dt, a.IncomingComissionAmount as kv
            FROM Applications a JOIN ApplicationStatuses s ON a.ApplicationId=s.ApplicationId
              JOIN ApplicationStatusTypes stt ON s.ApplicationStatusTypeId=stt.Id
              JOIN FinOffers ff ON a.ApplicationId=ff.ApplicationId AND ff.OfferStatusTypeId=6
              JOIN FinOrgs fo ON ff.FinOrgId=fo.FinOrgId
            WHERE stt.[Index]=305 AND {mf} AND {af}
          ) sub GROUP BY dt
        )
        SELECT t.dt, t.transitions, ISNULL(an.ankety,0) as ankety,
          ISNULL(r.rejected,0) as rejected, ISNULL(i.issued,0) as issued, ISNULL(i.kv,0) as kv
        FROM transitions t
          LEFT JOIN ankety an ON t.dt=an.dt
          LEFT JOIN rejections r ON t.dt=r.dt
          LEFT JOIN issued i ON t.dt=i.dt
        ORDER BY t.dt""", f"mfo-dates {mfo_name}")

    result = [{"date": str(r["dt"])[:10], "transitions": r["transitions"], "ankety": r["ankety"],
               "rejected": r["rejected"], "issued": r["issued"], "kv": flt(r["kv"])} for r in rows]
    return jsonify(days=result)


## ── Partner MFO (группировка по МФО внутри партнёра) ────

@app.route("/api/partner-mfo")
def api_partner_mfo():
    pk = request.args.get("partner", "mts")
    start = safe_date(request.args.get("start"))
    end = safe_date(request.args.get("end"))
    p = PARTNERS.get(pk)
    if not p or not start or not end:
        return jsonify(error="partner/start/end required"), 400
    pid = p["id"]
    start_w = (datetime.strptime(start, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
    end_w = (datetime.strptime(end, "%Y-%m-%d") + timedelta(days=2)).strftime("%Y-%m-%d")
    pf = f"ak.PartnerId='{pid}' AND a.ProductTypeId=5 AND a.ChannelTypeId=2 AND a.Created>='{start_w}' AND a.Created<'{end_w}' AND CAST(a.Created AS DATE)>='{start}' AND CAST(a.Created AS DATE)<='{end}'"

    rows = mcp.query(f"""
        WITH transitions AS (
          SELECT fo.Name as mfo, COUNT(*) as transitions
          FROM FinOffers ff JOIN Applications a ON ff.ApplicationId=a.ApplicationId
            JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId JOIN FinOrgs fo ON ff.FinOrgId=fo.FinOrgId
          WHERE ff.SelectedDate IS NOT NULL AND {pf}
          GROUP BY fo.Name
        ),
        ankety AS (
          SELECT fo.Name as mfo, COUNT(DISTINCT s.ApplicationId) as ankety
          FROM ApplicationStatuses s JOIN Applications a ON s.ApplicationId=a.ApplicationId
            JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
            JOIN FinOffers ff ON a.ApplicationId=ff.ApplicationId AND ff.SelectedDate IS NOT NULL
            JOIN FinOrgs fo ON ff.FinOrgId=fo.FinOrgId
          WHERE s.ApplicationStatusTypeId='b1a2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6' AND {pf}
          GROUP BY fo.Name
        ),
        rejections AS (
          SELECT fo.Name as mfo, COUNT(*) as rejected
          FROM FinOffers ff JOIN Applications a ON ff.ApplicationId=a.ApplicationId
            JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId JOIN FinOrgs fo ON ff.FinOrgId=fo.FinOrgId
          WHERE ff.OfferStatusTypeId=3 AND {pf}
          GROUP BY fo.Name
        ),
        issued AS (
          SELECT fo.Name as mfo, COUNT(*) as issued, SUM(kv) as kv FROM (
            SELECT DISTINCT a.ApplicationId, a.IncomingComissionAmount as kv, ff.FinOrgId
            FROM ApplicationStatuses s JOIN Applications a ON s.ApplicationId=a.ApplicationId
              JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
              JOIN ApplicationStatusTypes stt ON s.ApplicationStatusTypeId=stt.Id
              JOIN FinOffers ff ON a.ApplicationId=ff.ApplicationId AND ff.OfferStatusTypeId=6
            WHERE stt.[Index]=305 AND {pf}
          ) sub JOIN FinOrgs fo ON sub.FinOrgId=fo.FinOrgId GROUP BY fo.Name
        )
        SELECT t.mfo, t.transitions, ISNULL(an.ankety,0) as ankety,
          ISNULL(r.rejected,0) as rejected, ISNULL(i.issued,0) as issued, ISNULL(i.kv,0) as kv
        FROM transitions t
          LEFT JOIN ankety an ON t.mfo=an.mfo LEFT JOIN rejections r ON t.mfo=r.mfo
          LEFT JOIN issued i ON t.mfo=i.mfo
        ORDER BY t.transitions DESC""", f"partner-mfo {pk}")

    result = [{"mfo": r["mfo"], "transitions": r["transitions"], "ankety": r["ankety"],
               "rejected": r["rejected"], "issued": r["issued"], "kv": flt(r["kv"])} for r in rows]
    return jsonify(mfo=result)


@app.route("/api/partner-mfo-dates")
def api_partner_mfo_dates():
    pk = request.args.get("partner", "mts")
    mfo_name = request.args.get("mfo", "")
    mfo_safe = mfo_name.replace("'", "''")
    start = safe_date(request.args.get("start"))
    end = safe_date(request.args.get("end"))
    p = PARTNERS.get(pk)
    if not p or not mfo_name or not start or not end:
        return jsonify(error="partner/mfo/start/end required"), 400
    pid = p["id"]
    start_w = (datetime.strptime(start, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
    end_w = (datetime.strptime(end, "%Y-%m-%d") + timedelta(days=2)).strftime("%Y-%m-%d")
    pf = f"ak.PartnerId='{pid}' AND a.ProductTypeId=5 AND a.ChannelTypeId=2 AND a.Created>='{start_w}' AND a.Created<'{end_w}' AND CAST(a.Created AS DATE)>='{start}' AND CAST(a.Created AS DATE)<='{end}'"
    mf = f"fo.Name=N'{mfo_safe}'"

    rows = mcp.query(f"""
        WITH transitions AS (
          SELECT CAST(a.Created AS DATE) as dt, COUNT(*) as transitions
          FROM FinOffers ff JOIN Applications a ON ff.ApplicationId=a.ApplicationId
            JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
            JOIN FinOrgs fo ON ff.FinOrgId=fo.FinOrgId
          WHERE ff.SelectedDate IS NOT NULL AND {mf} AND {pf}
          GROUP BY CAST(a.Created AS DATE)
        ),
        ankety AS (
          SELECT CAST(a.Created AS DATE) as dt, COUNT(DISTINCT s.ApplicationId) as ankety
          FROM ApplicationStatuses s JOIN Applications a ON s.ApplicationId=a.ApplicationId
            JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
            JOIN FinOffers ff ON a.ApplicationId=ff.ApplicationId AND ff.SelectedDate IS NOT NULL
            JOIN FinOrgs fo ON ff.FinOrgId=fo.FinOrgId
          WHERE s.ApplicationStatusTypeId='b1a2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6' AND {mf} AND {pf}
          GROUP BY CAST(a.Created AS DATE)
        ),
        rejections AS (
          SELECT CAST(a.Created AS DATE) as dt, COUNT(*) as rejected
          FROM FinOffers ff JOIN Applications a ON ff.ApplicationId=a.ApplicationId
            JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
            JOIN FinOrgs fo ON ff.FinOrgId=fo.FinOrgId
          WHERE ff.OfferStatusTypeId=3 AND {mf} AND {pf}
          GROUP BY CAST(a.Created AS DATE)
        ),
        issued AS (
          SELECT dt, COUNT(*) as issued, SUM(kv) as kv FROM (
            SELECT DISTINCT a.ApplicationId, CAST(a.Created AS DATE) as dt, a.IncomingComissionAmount as kv
            FROM ApplicationStatuses s JOIN Applications a ON s.ApplicationId=a.ApplicationId
              JOIN PartnerApiKeys ak ON a.ApiKeyId=ak.ApiKeyId
              JOIN ApplicationStatusTypes stt ON s.ApplicationStatusTypeId=stt.Id
              JOIN FinOffers ff ON a.ApplicationId=ff.ApplicationId AND ff.OfferStatusTypeId=6
              JOIN FinOrgs fo ON ff.FinOrgId=fo.FinOrgId
            WHERE stt.[Index]=305 AND {mf} AND {pf}
          ) sub GROUP BY dt
        )
        SELECT t.dt, t.transitions, ISNULL(an.ankety,0) as ankety,
          ISNULL(r.rejected,0) as rejected, ISNULL(i.issued,0) as issued, ISNULL(i.kv,0) as kv
        FROM transitions t
          LEFT JOIN ankety an ON t.dt=an.dt
          LEFT JOIN rejections r ON t.dt=r.dt
          LEFT JOIN issued i ON t.dt=i.dt
        ORDER BY t.dt""", f"partner-mfo-dates {pk} {mfo_name}")

    result = [{"date": str(r["dt"])[:10], "transitions": r["transitions"], "ankety": r["ankety"],
               "rejected": r["rejected"], "issued": r["issued"], "kv": flt(r["kv"])} for r in rows]
    return jsonify(days=result)


## ── Showcase (витрина) ──────────────────────────────

def _showcase_base(env):
    return SHOWCASE_API.get(env, SHOWCASE_API["test"])


@app.route("/showcase")
def showcase():
    return render_template("showcase.html")


@app.route("/api/showcase/products", methods=["POST"])
def showcase_products():
    env = request.json.get("env", "test") if request.is_json else "test"
    base = _showcase_base(env)
    r = req.post(f"{base}/Internal/GetReferralProducts",
                 headers={"Authorization": SHOWCASE_AUTH_INTERNAL},
                 json={}, timeout=15)
    return jsonify(r.json()), r.status_code


@app.route("/api/showcase/update", methods=["POST"])
def showcase_update():
    data = request.get_json(force=True)
    env = data.pop("env", "test")
    base = _showcase_base(env)
    r = req.post(f"{base}/Internal/UpdateOrderReferralProducts",
                 headers={"Authorization": SHOWCASE_AUTH_INTERNAL,
                           "Content-Type": "application/json"},
                 json=data, timeout=15)
    return jsonify(r.json()), r.status_code


@app.route("/api/showcase/invalidate", methods=["POST"])
def showcase_invalidate():
    env = request.json.get("env", "test") if request.is_json else "test"
    base = _showcase_base(env)
    r = req.get(f"{base}/Dictionaries/InvalidateCaches",
                headers={"Authorization": SHOWCASE_AUTH_CACHE}, timeout=15)
    return jsonify(r.json()), r.status_code


if __name__ == "__main__":
    print("MFO Dashboard: http://localhost:5000")
    app.run(debug=True, port=5000, host="0.0.0.0")
