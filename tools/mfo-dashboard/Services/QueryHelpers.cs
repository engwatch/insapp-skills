using System.Text.Json;
using System.Text.RegularExpressions;
using DashboardApi.Models;

namespace DashboardApi.Services;

public static class QueryHelpers
{
    private static readonly Regex DateRe = new(@"^\d{4}-\d{2}-\d{2}$");

    public static string? SafeDate(string? s) =>
        s != null && DateRe.IsMatch(s) ? s : null;

    public static double Flt(JsonElement el)
    {
        if (el.ValueKind == JsonValueKind.Number)
            return el.GetDouble();
        if (el.ValueKind == JsonValueKind.String &&
            double.TryParse(el.GetString(), out var d))
            return d;
        return 0.0;
    }

    public static double Flt(object? v)
    {
        if (v is JsonElement el) return Flt(el);
        if (v is double d) return d;
        if (v is int i) return i;
        return 0.0;
    }

    public static ParsedPartner? ParsePartners(string pkStr, Dictionary<string, PartnerConfig> partners)
    {
        var keys = pkStr.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        var found = keys.Where(k => partners.ContainsKey(k)).Select(k => partners[k]).ToList();
        if (found.Count == 0) return null;

        var pids = found.Select(p => p.Id).ToList();
        string filter;
        if (pids.Count == 1)
            filter = $"ak.PartnerId='{pids[0]}'";
        else
            filter = "ak.PartnerId IN (" + string.Join(",", pids.Select(p => $"'{p}'")) + ")";

        var avgSplit = (int)Math.Round(found.Average(p => p.Split));
        var name = string.Join(" + ", found.Select(p => p.Name));
        return new ParsedPartner(name, avgSplit, filter);
    }

    public static string BuildPf(ParsedPartner pp, string start, string end)
    {
        var startW = DateTime.Parse(start).AddDays(-1).ToString("yyyy-MM-dd");
        var endW = DateTime.Parse(end).AddDays(2).ToString("yyyy-MM-dd");
        return $"{pp.Filter} AND a.ProductTypeId=5 AND a.ChannelTypeId=2 " +
               $"AND a.Created>='{startW}' AND a.Created<'{endW}' " +
               $"AND CAST(a.Created AS DATE)>='{start}' AND CAST(a.Created AS DATE)<='{end}'";
    }

    public static string GetStr(Dictionary<string, JsonElement> row, string key)
    {
        if (row.TryGetValue(key, out var el))
        {
            if (el.ValueKind == JsonValueKind.String) return el.GetString() ?? "";
            return el.ToString();
        }
        return "";
    }

    public static int GetInt(Dictionary<string, JsonElement> row, string key)
    {
        if (row.TryGetValue(key, out var el))
        {
            if (el.ValueKind == JsonValueKind.Number) return el.GetInt32();
        }
        return 0;
    }

    public static double GetDbl(Dictionary<string, JsonElement> row, string key)
    {
        if (row.TryGetValue(key, out var el)) return Flt(el);
        return 0.0;
    }
}
