using DashboardApi.Services;
using static DashboardApi.Services.QueryHelpers;

namespace DashboardApi.Endpoints;

public static class MfoEndpoints
{
    public static WebApplication MapMfoEndpoints(this WebApplication app)
    {
        app.MapGet("/api/mfo-summary", HandleMfoSummary);
        app.MapGet("/api/mfo-dates", HandleMfoDates);
        return app;
    }

    static async Task<IResult> HandleMfoSummary(HttpContext ctx, McpClient mcp)
    {
        var start = SafeDate(ctx.Request.Query["start"].FirstOrDefault());
        var end = SafeDate(ctx.Request.Query["end"].FirstOrDefault());
        if (start == null || end == null)
            return Results.BadRequest(new { error = "start/end required" });

        var startW = DateTime.Parse(start).AddDays(-1).ToString("yyyy-MM-dd");
        var endW = DateTime.Parse(end).AddDays(2).ToString("yyyy-MM-dd");
        var af = $"a.ProductTypeId=5 AND a.ChannelTypeId=2 AND a.Created>='{startW}' AND a.Created<'{endW}' " +
                 $"AND CAST(a.Created AS DATE)>='{start}' AND CAST(a.Created AS DATE)<='{end}'";

        var rows = await mcp.QueryAsync($@"
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
            ORDER BY t.transitions DESC", "mfo summary");

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

    static async Task<IResult> HandleMfoDates(HttpContext ctx, McpClient mcp)
    {
        var mfoName = ctx.Request.Query["mfo"].FirstOrDefault() ?? "";
        var mfoSafe = mfoName.Replace("'", "''");
        var start = SafeDate(ctx.Request.Query["start"].FirstOrDefault());
        var end = SafeDate(ctx.Request.Query["end"].FirstOrDefault());
        if (string.IsNullOrEmpty(mfoName) || start == null || end == null)
            return Results.BadRequest(new { error = "mfo/start/end required" });

        var startW = DateTime.Parse(start).AddDays(-1).ToString("yyyy-MM-dd");
        var endW = DateTime.Parse(end).AddDays(2).ToString("yyyy-MM-dd");
        var af = $"a.ProductTypeId=5 AND a.ChannelTypeId=2 AND a.Created>='{startW}' AND a.Created<'{endW}' " +
                 $"AND CAST(a.Created AS DATE)>='{start}' AND CAST(a.Created AS DATE)<='{end}'";
        var mf = $"fo.Name=N'{mfoSafe}'";

        var rows = await mcp.QueryAsync($@"
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
            ORDER BY t.dt", $"mfo-dates {mfoName}");

        var days = rows.Select(r => new
        {
            date = GetStr(r, "dt")[..10],
            transitions = GetInt(r, "transitions"),
            ankety = GetInt(r, "ankety"),
            rejected = GetInt(r, "rejected"),
            issued = GetInt(r, "issued"),
            kv = GetDbl(r, "kv")
        }).ToList();

        return Results.Ok(new { days });
    }
}
