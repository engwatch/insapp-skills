using System.Net;
using System.Text;
using System.Text.Json;
using DashboardApi.Models;
using Microsoft.Extensions.Options;

namespace DashboardApi.Services;

public class McpClient
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly McpSettings _settings;
    private volatile string? _sessionId;
    private int _reqId;
    private readonly SemaphoreSlim _sessionLock = new(1, 1);

    public McpClient(IHttpClientFactory httpFactory, IOptions<McpSettings> settings)
    {
        _httpFactory = httpFactory;
        _settings = settings.Value;
    }

    private int NextId() => Interlocked.Increment(ref _reqId);

    private HttpClient CreateClient()
    {
        var client = _httpFactory.CreateClient("Mcp");
        client.DefaultRequestHeaders.Clear();
        client.DefaultRequestHeaders.Add("x-api-key", _settings.ApiKey);
        client.DefaultRequestHeaders.Add("Accept", "application/json, text/event-stream");
        if (_sessionId != null)
            client.DefaultRequestHeaders.Add("mcp-session-id", _sessionId);
        return client;
    }

    private async Task EnsureSessionAsync()
    {
        if (_sessionId != null) return;
        await _sessionLock.WaitAsync();
        try
        {
            if (_sessionId != null) return;
            var client = CreateClient();

            var initBody = JsonSerializer.Serialize(new
            {
                jsonrpc = "2.0",
                method = "initialize",
                @params = new
                {
                    protocolVersion = "2024-11-05",
                    capabilities = new { },
                    clientInfo = new { name = "dashboard-dotnet", version = "1.0" }
                },
                id = NextId()
            });
            var initResp = await client.PostAsync(_settings.Url,
                new StringContent(initBody, Encoding.UTF8, "application/json"));

            if (initResp.Headers.TryGetValues("mcp-session-id", out var vals))
                _sessionId = vals.First();
            else if (initResp.Headers.TryGetValues("Mcp-Session", out var vals2))
                _sessionId = vals2.First();

            client = CreateClient();
            var notifBody = JsonSerializer.Serialize(new
            {
                jsonrpc = "2.0",
                method = "notifications/initialized"
            });
            await client.PostAsync(_settings.Url,
                new StringContent(notifBody, Encoding.UTF8, "application/json"));
        }
        finally
        {
            _sessionLock.Release();
        }
    }

    private void ResetSession() => _sessionId = null;

    public async Task<List<Dictionary<string, JsonElement>>> QueryAsync(
        string sql, string desc = "dashboard", string db = "InsappCoreProd")
    {
        await EnsureSessionAsync();

        for (int attempt = 0; attempt < 3; attempt++)
        {
            try
            {
                var client = CreateClient();
                var body = JsonSerializer.Serialize(new
                {
                    jsonrpc = "2.0",
                    method = "tools/call",
                    @params = new
                    {
                        name = "query",
                        arguments = new
                        {
                            database = db,
                            sql,
                            user_prompt = "dashboard",
                            query_description = desc
                        }
                    },
                    id = NextId()
                });

                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(120));
                var resp = await client.PostAsync(_settings.Url,
                    new StringContent(body, Encoding.UTF8, "application/json"), cts.Token);

                var status = (int)resp.StatusCode;
                if (status is 401 or 403 or 404 or 410)
                {
                    ResetSession();
                    await EnsureSessionAsync();
                    if (attempt < 2) continue;
                    return [];
                }

                var text = await resp.Content.ReadAsStringAsync(cts.Token);
                if (string.IsNullOrWhiteSpace(text))
                {
                    if (attempt < 2) { ResetSession(); await EnsureSessionAsync(); continue; }
                    return [];
                }

                var ct = resp.Content.Headers.ContentType?.MediaType ?? "";
                if (ct == "text/event-stream")
                {
                    List<Dictionary<string, JsonElement>>? lastResult = null;
                    foreach (var line in text.Split('\n', '\r'))
                    {
                        if (!line.StartsWith("data: ")) continue;
                        try
                        {
                            var doc = JsonDocument.Parse(line[6..]);
                            var parsed = Parse(doc);
                            if (parsed != null) lastResult = parsed;
                        }
                        catch { }
                    }
                    if (lastResult != null) return lastResult;
                }
                else
                {
                    try
                    {
                        var doc = JsonDocument.Parse(text);
                        var parsed = Parse(doc);
                        if (parsed != null) return parsed;
                    }
                    catch { }
                }

                if (attempt < 2) { ResetSession(); await EnsureSessionAsync(); }
            }
            catch (Exception ex) when (ex is TaskCanceledException or HttpRequestException)
            {
                if (attempt < 2) { ResetSession(); await EnsureSessionAsync(); continue; }
            }
        }
        return [];
    }

    private static List<Dictionary<string, JsonElement>>? Parse(JsonDocument doc)
    {
        try
        {
            var root = doc.RootElement;
            if (!root.TryGetProperty("result", out var result)) return null;
            if (!result.TryGetProperty("content", out var content)) return null;

            foreach (var item in content.EnumerateArray())
            {
                if (item.TryGetProperty("type", out var t) && t.GetString() == "text" &&
                    item.TryGetProperty("text", out var textEl))
                {
                    var inner = JsonDocument.Parse(textEl.GetString()!);
                    var innerRoot = inner.RootElement;

                    if (innerRoot.TryGetProperty("error", out var err) &&
                        err.ValueKind == JsonValueKind.String &&
                        !string.IsNullOrEmpty(err.GetString()))
                        return [];

                    if (innerRoot.TryGetProperty("success", out var succ) && succ.GetBoolean() &&
                        innerRoot.TryGetProperty("rows", out var rows))
                    {
                        var list = new List<Dictionary<string, JsonElement>>();
                        foreach (var row in rows.EnumerateArray())
                        {
                            var dict = new Dictionary<string, JsonElement>();
                            foreach (var prop in row.EnumerateObject())
                                dict[prop.Name] = prop.Value.Clone();
                            list.Add(dict);
                        }
                        return list;
                    }
                }
            }
        }
        catch { }
        return null;
    }
}
