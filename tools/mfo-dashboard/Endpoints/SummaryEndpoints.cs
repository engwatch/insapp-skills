using DashboardApi.Models;
using DashboardApi.Services;
using Microsoft.Extensions.Options;
using static DashboardApi.Services.QueryHelpers;

namespace DashboardApi.Endpoints;

public static class SummaryEndpoints
{
    public static WebApplication MapSummaryEndpoints(this WebApplication app)
    {
        app.MapGet("/api/summary", HandleSummary);
        app.MapGet("/api/day", HandleDay);
        return app;
    }

    static async Task<IResult> HandleSummary(HttpContext ctx, McpClient mcp,
        IOptions<Dictionary<string, PartnerConfig>> partnersOpt)
    {
        var partners = partnersOpt.Value;
        var pk = ctx.Request.Query["partner"].FirstOrDefault() ?? "mts";
        var fromTime = ctx.Request.Query["from_time"].FirstOrDefault() ?? "";
        var start = SafeDate(ctx.Request.Query["start"].FirstOrDefault());
        var end = SafeDate(ctx.Request.Query["end"].FirstOrDefault());

        var pp = ParsePartners(pk, partners);
        if (pp == null) return Results.BadRequest(new { error = "unknown partner" });

        string pf;
        if (!string.IsNullOrEmpty(fromTime))
        {
            var ftSafe = fromTime.Replace("'", "");
            pf = $"{pp.Filter} AND a.ProductTypeId=5 AND a.ChannelTypeId=2 AND a.Created>='{ftSafe}'";
        }
        else if (start != null && end != null)
        {
            pf = BuildPf(pp, start, end);
        }
        else
        {
            return Results.BadRequest(new { error = "start/end or from_time required" });
        }

        var splitDate = start ?? (fromTime.Length >= 10 ? fromTime[..10] : DateTime.UtcNow.ToString("yyyy-MM-dd"));
        var splitTask = mcp.QueryAsync($@"
            SELECT TOP 1 c.ComissionRate
            FROM PartnerFinProductsPeriods p
            JOIN PartnerFinProductsComissions c ON p.PeriodId=c.PeriodId
            JOIN PartnerApiKeys ak ON p.ApiKeyId=ak.ApiKeyId
            WHERE {pp.Filter} AND p.StartDate<='{splitDate}' AND p.EndDate>'{splitDate}'", "split");

        var dataTask = mcp.QueryAsync($@"
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
            ORDER BY o.dt", "partner summary");

        await Task.WhenAll(splitTask, dataTask);
        var splitRows = await splitTask;
        var dbSplit = splitRows.Count > 0 ? (int)Math.Round(GetDbl(splitRows[0], "ComissionRate")) : pp.Split;
        var rows = await dataTask;

        var days = rows.Select(r => new
        {
            date = GetStr(r, "dt")[..10],
            opens = GetInt(r, "opens"),
            transitions = GetInt(r, "transitions"),
            ankety = GetInt(r, "ankety"),
            rejected = GetInt(r, "rejected"),
            issued = GetInt(r, "issued"),
            kv = GetDbl(r, "kv")
        }).ToList();

        var anketyTotal = rows.Count > 0 ? GetInt(rows[0], "ankety_total") : 0;
        return Results.Ok(new
        {
            partner = new { name = pp.Name, split = dbSplit, filter = pp.Filter },
            days,
            ankety_total = anketyTotal
        });
    }

    static async Task<IResult> HandleDay(HttpContext ctx, McpClient mcp,
        IOptions<Dictionary<string, PartnerConfig>> partnersOpt)
    {
        var partners = partnersOpt.Value;
        var pk = ctx.Request.Query["partner"].FirstOrDefault() ?? "mts";
        var date = SafeDate(ctx.Request.Query["date"].FirstOrDefault());
        var fromTime = ctx.Request.Query["from_time"].FirstOrDefault() ?? "";

        var pp = ParsePartners(pk, partners);
        if (pp == null || date == null) return Results.BadRequest(new { error = "partner/date required" });

        string pf;
        if (!string.IsNullOrEmpty(fromTime))
        {
            var ftSafe = fromTime.Replace("'", "");
            pf = $"{pp.Filter} AND a.ProductTypeId=5 AND a.ChannelTypeId=2 AND CAST(a.Created AS DATE)='{date}' AND a.Created>='{ftSafe}'";
        }
        else
        {
            pf = $"{pp.Filter} AND a.ProductTypeId=5 AND a.ChannelTypeId=2 AND CAST(a.Created AS DATE)='{date}'";
        }

        var rows = await mcp.QueryAsync($@"
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
            ORDER BY t.transitions DESC", $"MFO {date}");

        var mfo = rows.Select(r => new
        {
            mfo = GetStr(r, "mfo"),
            transitions = GetInt(r, "transitions"),
            ankety = GetInt(r, "ankety"),
            rejected = GetInt(r, "rejected"),
            issued = GetInt(r, "issued"),
            kv = GetDbl(r, "kv")
        }).ToList();

        return Results.Ok(new { mfo });
    }
}
