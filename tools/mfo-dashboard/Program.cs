using DashboardApi.Endpoints;
using DashboardApi.Models;
using DashboardApi.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<McpSettings>(builder.Configuration.GetSection("Mcp"));
builder.Services.Configure<ShowcaseSettings>(builder.Configuration.GetSection("Showcase"));
builder.Services.Configure<Dictionary<string, PartnerConfig>>(
    builder.Configuration.GetSection("Partners"));

builder.Services.AddHttpClient("Mcp");
builder.Services.AddSingleton<McpClient>();
builder.Services.AddTransient<ShowcaseProxy>();

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/", () => Results.File(
    Path.Combine(app.Environment.WebRootPath, "index.html"), "text/html"));
app.MapGet("/showcase", () => Results.File(
    Path.Combine(app.Environment.WebRootPath, "showcase.html"), "text/html"));

app.MapSummaryEndpoints();
app.MapMfoEndpoints();
app.MapPartnerMfoEndpoints();
app.MapShowcaseEndpoints();

app.Run();
