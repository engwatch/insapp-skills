namespace DashboardApi.Models;

public class McpSettings
{
    public string Url { get; set; } = "";
    public string ApiKey { get; set; } = "";
}

public class ShowcaseSettings
{
    public string TestUrl { get; set; } = "";
    public string ProdUrl { get; set; } = "";
    public string AuthInternal { get; set; } = "";
    public string AuthCache { get; set; } = "";

    public string BaseUrl(string env) =>
        env == "prod" ? ProdUrl : TestUrl;
}

public record PartnerConfig(string Id, string Name, int Split);

public record ParsedPartner(string Name, int Split, string Filter);
