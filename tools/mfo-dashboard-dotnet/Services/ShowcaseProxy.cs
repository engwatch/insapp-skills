using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using DashboardApi.Models;
using Microsoft.Extensions.Options;

namespace DashboardApi.Services;

public class ShowcaseProxy
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly ShowcaseSettings _settings;

    public ShowcaseProxy(IHttpClientFactory httpFactory, IOptions<ShowcaseSettings> settings)
    {
        _httpFactory = httpFactory;
        _settings = settings.Value;
    }

    public async Task<(string Body, int Status)> GetProductsAsync(string env)
    {
        var client = _httpFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(15);
        var url = $"{_settings.BaseUrl(env)}/Internal/GetReferralProducts";
        var req = new HttpRequestMessage(HttpMethod.Post, url);
        req.Headers.Add("Authorization", _settings.AuthInternal);
        req.Content = new StringContent("{}", Encoding.UTF8, "application/json");
        var resp = await client.SendAsync(req);
        var body = await resp.Content.ReadAsStringAsync();
        return (body, (int)resp.StatusCode);
    }

    public async Task<(string Body, int Status)> UpdateAsync(string env, string jsonBody)
    {
        var client = _httpFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(15);
        var url = $"{_settings.BaseUrl(env)}/Internal/UpdateOrderReferralProducts";
        var req = new HttpRequestMessage(HttpMethod.Post, url);
        req.Headers.Add("Authorization", _settings.AuthInternal);
        req.Content = new StringContent(jsonBody, Encoding.UTF8, "application/json");
        var resp = await client.SendAsync(req);
        var body = await resp.Content.ReadAsStringAsync();
        return (body, (int)resp.StatusCode);
    }

    public async Task<(string Body, int Status)> InvalidateAsync(string env)
    {
        var client = _httpFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(15);
        var url = $"{_settings.BaseUrl(env)}/Dictionaries/InvalidateCaches";
        var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Add("Authorization", _settings.AuthCache);
        var resp = await client.SendAsync(req);
        var body = await resp.Content.ReadAsStringAsync();
        return (body, (int)resp.StatusCode);
    }

    public async Task<Dictionary<string, object>> GetShowcaseOrderAsync()
    {
        try
        {
            var (body, _) = await GetProductsAsync("prod");
            var doc = JsonDocument.Parse(body);
            var items = doc.RootElement.GetProperty("value").EnumerateArray()
                .OrderBy(p => p.GetProperty("order").GetInt32())
                .ToList();

            var order = new Dictionary<string, object>();
            int activePos = 0;
            foreach (var p in items)
            {
                var name = p.GetProperty("finOrgName").GetString() ?? "";
                var off = p.GetProperty("isDisabled").GetBoolean();
                if (!off) activePos++;
                if (!string.IsNullOrEmpty(name) && !order.ContainsKey(name))
                    order[name] = new { pos = off ? 0 : activePos, off };
            }
            return order;
        }
        catch
        {
            return new Dictionary<string, object>();
        }
    }
}
