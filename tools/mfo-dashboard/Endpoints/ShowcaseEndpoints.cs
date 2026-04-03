using System.Text.Json;
using System.Text.Json.Nodes;
using DashboardApi.Services;
using static DashboardApi.Services.QueryHelpers;

namespace DashboardApi.Endpoints;

public static class ShowcaseEndpoints
{
    public static WebApplication MapShowcaseEndpoints(this WebApplication app)
    {
        app.MapGet("/api/showcase-events", HandleEvents);
        app.MapGet("/api/showcase-order", HandleOrder);
        app.MapPost("/api/showcase/products", HandleProducts);
        app.MapPost("/api/showcase/update", HandleUpdate);
        app.MapPost("/api/showcase/invalidate", HandleInvalidate);
        return app;
    }

    static async Task<IResult> HandleEvents(McpClient mcp)
    {
        var rows = await mcp.QueryAsync(@"
            SELECT p.Date, LEFT(p.RequestBody, 500) as body
            FROM PublicApiLogs p
            WHERE p.Url LIKE '%UpdateOrderReferralProducts%'
              AND p.Date >= DATEADD(hour, -48, GETDATE())
            ORDER BY p.Date DESC", "showcase events", "InsappLogProd");

        var events = rows.Select(r =>
        {
            var time = GetStr(r, "Date");
            var label = time.Length >= 19 ? time[..19].Replace("T", " ") : time;
            return new { time, label };
        }).ToList();

        return Results.Ok(new { events });
    }

    static async Task<IResult> HandleOrder(ShowcaseProxy proxy)
    {
        var order = await proxy.GetShowcaseOrderAsync();
        return Results.Ok(new { order });
    }

    static async Task<IResult> HandleProducts(HttpContext ctx, ShowcaseProxy proxy)
    {
        var body = await JsonDocument.ParseAsync(ctx.Request.Body);
        var env = "test";
        if (body.RootElement.TryGetProperty("env", out var envEl))
            env = envEl.GetString() ?? "test";

        var (respBody, status) = await proxy.GetProductsAsync(env);
        ctx.Response.ContentType = "application/json";
        ctx.Response.StatusCode = status;
        await ctx.Response.WriteAsync(respBody);
        return Results.Empty;
    }

    static async Task<IResult> HandleUpdate(HttpContext ctx, ShowcaseProxy proxy)
    {
        var raw = await new StreamReader(ctx.Request.Body).ReadToEndAsync();
        var node = JsonNode.Parse(raw);
        var env = node?["env"]?.GetValue<string>() ?? "test";
        node?.AsObject().Remove("env");
        var forwarded = node?.ToJsonString() ?? "{}";

        var (respBody, status) = await proxy.UpdateAsync(env, forwarded);
        ctx.Response.ContentType = "application/json";
        ctx.Response.StatusCode = status;
        await ctx.Response.WriteAsync(respBody);
        return Results.Empty;
    }

    static async Task<IResult> HandleInvalidate(HttpContext ctx, ShowcaseProxy proxy)
    {
        var body = await JsonDocument.ParseAsync(ctx.Request.Body);
        var env = "test";
        if (body.RootElement.TryGetProperty("env", out var envEl))
            env = envEl.GetString() ?? "test";

        var (respBody, status) = await proxy.InvalidateAsync(env);
        ctx.Response.ContentType = "application/json";
        ctx.Response.StatusCode = status;
        await ctx.Response.WriteAsync(respBody);
        return Results.Empty;
    }
}
