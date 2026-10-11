using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.RegularExpressions;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.SeleniumTests;

/// <summary>
/// KNOWN-DEFECT REPRODUCTION (not part of the final regression suite): GCN49-FE-01 - a guest refused by the pharmacy/doctor API (HTTP 401)
/// gets no in-page guidance. This is the ORIGINAL TC-06, preserved unchanged. It FAILS until the defect is fixed, so it is [Explicit]:
/// it is skipped by normal runs and only runs when selected, e.g.
///     dotnet test --filter "FullyQualifiedName~GCN49KnownDefectFE01Tests"
/// API mode: MOCKED 401 (the real pharmacy and doctor services are out of scope; the real 401 is BLOCKED).
/// </summary>
[TestFixture]
[NonParallelizable]
[Category("KnownDefect")]
[Explicit("Known defect GCN49-FE-01 reproduction: fails until the defect is fixed")]
public class GCN49KnownDefectFE01Tests
{
    private static readonly string BaseUrl = Environment.GetEnvironmentVariable("CARENOVA_BASE_URL") ?? "http://localhost:3000";
    private const string Api = "http://localhost:5136";
    private const string Stub = "http://localhost:5199";
    private static readonly string Root = Environment.GetEnvironmentVariable("GCN49_REPORT_DIR")
        ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "carenova", "qa-reports", "GCN-49");
    private static readonly string ShotDir = Path.Combine(Root, "screenshots", "selenium");
    private static readonly string LogDir = Path.Combine(Root, "selenium");

    private IWebDriver _driver = null!;
    private WebDriverWait _wait = null!;
    private INetwork? _network;
    private readonly List<(string Method, string Path)> _requests = new();
    private readonly object _lock = new();
    private ManualResetEventSlim? _gate;
    private object _home = FullHome();
    private bool _refuseAnonymous;
    private int _shots;
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(8) };

    private static object FullHome() => new
    {
        introduction = "QA introduction: CareNova connects you with pharmacy services.",
        services = new[] { new { title = "QA Pharmacy services", description = "Browse medicines." }, new { title = "QA Healthcare professionals", description = "Find doctors." }, new { title = "QA Patient services", description = "Create an account." } },
        notices = new[] { new { title = "QA Prescription medicines", message = "A valid prescription is required." }, new { title = "QA Holiday hours", message = "Closed on public holidays." } },
        featuredMedicines = new object[]
        {
            new { id = 1, name = "QA Vitamin C", categoryName = "Vitamins", price = 200, availabilityStatus = "In stock", prescriptionRequired = false },
            new { id = 2, name = "QA Amoxicillin", categoryName = "Antibiotics", price = 450.5, availabilityStatus = "Low stock", prescriptionRequired = true },
        },
        featuredDoctors = new object[] { new { doctorId = "a/b c", fullName = "QA Dr Silva <b>MBBS</b>", specialization = "Cardiologist", consultationFee = 4500, availabilityStatus = "3 open slots" } },
        sectionErrors = Array.Empty<string>(),
    };

    [OneTimeSetUp]
    public void Folders() { Directory.CreateDirectory(ShotDir); Directory.CreateDirectory(LogDir); }

    // ------------------------------------------------------------------------------------------------ lifecycle
    private async Task Start(bool mocked)
    {
        _shots = 0; _gate = null; _home = FullHome(); _refuseAnonymous = false;
        lock (_lock) _requests.Clear();
        var options = new ChromeOptions();
        options.AddArgument("--headless");
        options.AddArgument("--window-size=1400,1000");
        _driver = new ChromeDriver(options);
        _wait = new WebDriverWait(_driver, TimeSpan.FromSeconds(15));
        _wait.IgnoreExceptionTypes(typeof(StaleElementReferenceException), typeof(NoSuchElementException));
        if (!mocked) return;
        _network = _driver.Manage().Network;
        _network.AddRequestHandler(new NetworkRequestHandler
        {
            RequestMatcher = r => Uri.TryCreate(r.Url, UriKind.Absolute, out var u) && u.Host == "localhost" && u.Port is >= 5133 and <= 5136,
            ResponseSupplier = Supply,
        });
        await _network.StartMonitoring();
    }

    [TearDown]
    public async Task TearDown()
    {
        var name = TestContext.CurrentContext.Test.Name;
        var failed = TestContext.CurrentContext.Result.Outcome.Status == NUnit.Framework.Interfaces.TestStatus.Failed;
        try { _gate?.Set(); Shot("final-state"); if (failed) Save($"{name}-FAILURE"); } catch { /* browser may be gone */ }
        try { if (_network != null) await _network.StopMonitoring(); } catch { /* best effort */ }
        try { _driver.Quit(); _driver.Dispose(); } catch { /* best effort */ }
        _network = null;
        try { await StubMode("ok", "ok"); } catch { /* stub may be down */ }
    }

    // ------------------------------------------------------------------------------------------------ real environment
    private static async Task StubMode(string medicines, string doctors, int delay = 2500) =>
        await Http.GetStringAsync($"{Stub}/__mode?medicines={medicines}&doctors={doctors}&delay={delay}");

    private static async Task RequireRealEnvironment()
    {
        try
        {
            using var api = await Http.GetAsync($"{Api}/api/public/home");
            if (!api.IsSuccessStatusCode) Assert.Inconclusive($"BLOCKED: the real GCN-49 backend on {Api} answered HTTP {(int)api.StatusCode}.");
            await StubMode("ok", "ok");
        }
        catch (HttpRequestException e) { Assert.Inconclusive("BLOCKED: the real backend (5136) or the stub upstream (5199) is not running: " + e.Message); }
        catch (TaskCanceledException) { Assert.Inconclusive("BLOCKED: the real backend (5136) or the stub upstream (5199) did not answer in time."); }
    }

    // ------------------------------------------------------------------------------------------------ interception
    private HttpResponseData Supply(HttpRequestData request)
    {
        var uri = new Uri(request.Url!);
        var path = uri.AbsolutePath.TrimEnd('/');
        var method = request.Method ?? "GET";
        if (method.Equals("OPTIONS", StringComparison.OrdinalIgnoreCase)) return Respond(204, "");
        lock (_lock) _requests.Add((method, $"{uri.Port}{path}"));

        if (uri.Port == 5136 && path.Equals("/api/public/home", StringComparison.OrdinalIgnoreCase))
        {
            _gate?.Wait(TimeSpan.FromSeconds(20));
            return Respond(200, JsonSerializer.Serialize(_home));
        }
        if (_refuseAnonymous && (path.StartsWith("/api/catalogue", StringComparison.OrdinalIgnoreCase) || path.StartsWith("/api/doctors", StringComparison.OrdinalIgnoreCase)))
            return Respond(401, "{}"); // what [Authorize(Policy = Patient)] does to an anonymous request
        if (path.Equals("/api/catalogue/medicines", StringComparison.OrdinalIgnoreCase)) return Respond(200, "{\"items\":[],\"page\":1,\"pageSize\":12,\"totalCount\":0,\"totalPages\":0}");
        if (path.Equals("/api/catalogue/categories", StringComparison.OrdinalIgnoreCase)) return Respond(200, "[]");
        if (path.Equals("/api/doctors", StringComparison.OrdinalIgnoreCase)) return Respond(200, "{\"items\":[],\"page\":1,\"pageSize\":6,\"totalCount\":0,\"totalPages\":0}");
        if (path.Equals("/api/doctors/specializations", StringComparison.OrdinalIgnoreCase)) return Respond(200, "[]");
        return Respond(200, "[]");
    }

    private static HttpResponseData Respond(int status, string body)
    {
        var r = new HttpResponseData { StatusCode = status, Body = body };
        r.Headers["Access-Control-Allow-Origin"] = BaseUrl;
        r.Headers["Access-Control-Allow-Headers"] = "authorization, content-type";
        r.Headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
        r.Headers["Content-Type"] = "application/json";
        return r;
    }

    // =============================================================================================================
    // TC-06  Guest access and HTTP 401 handling on the medicine and doctor pages (MOCKED 401; GCN49-FE-01)
    // =============================================================================================================
    [Test, Description("MOCKED 401 from the pharmacy/doctor API ports (what [Authorize(Policy = Patient)] does to an anonymous request). A guest who follows the public medicines and doctors links must be told on the page what to do next. Real 401 verification is BLOCKED because the real services are out of scope. Investigates GCN49-FE-01 / GCN49-PID-02.")]
    public async Task TC06_GuestAccessAndHttp401HandlingOnMedicineAndDoctorPages()
    {
        await Start(mocked: true);
        _refuseAnonymous = true;
        var problems = new List<string>();
        var observed = new List<string>();

        Go("/");
        _wait.Until(d => d.FindElements(By.XPath("//h2[normalize-space()='Our services']")).Any());
        _driver.FindElement(By.LinkText("Browse all medicines →")).Click();
        H1("Medicine Catalogue");
        _wait.Until(d => d.PageSource.Contains("Unable to load"));
        Shot("guest-medicines-401");
        var medicineMain = MainText();
        observed.Add($"Medicine Catalogue (mocked 401): main area text = \"{Squash(medicineMain)}\"");
        if (!Regex.IsMatch(medicineMain, "log ?in|sign ?in|register", RegexOptions.IgnoreCase))
            problems.Add($"Medicine Catalogue shows \"{FirstMatchingLine(medicineMain, "Unable to load")}\" with no hint on the page to log in or register (and Retry cannot help a guest).");

        Sidebar("Doctors").Click();
        H1("Find a Doctor");
        _wait.Until(d => d.PageSource.Contains("not authorized"));
        Shot("guest-doctors-401");
        var doctorMain = MainText();
        observed.Add($"Find a Doctor (mocked 401): main area text = \"{Squash(doctorMain)}\"");
        if (!Regex.IsMatch(doctorMain, "log ?in|sign ?in|register", RegexOptions.IgnoreCase))
            problems.Add($"Find a Doctor shows \"{FirstMatchingLine(doctorMain, "not authorized")}\" with no hint on the page to log in or register.");

        // real-service verification (GCN49-PID-02): the pharmacy and doctor services are not running
        var probe = new List<string>();
        foreach (var (name, url) in new[] { ("pharmacy-order-service", "http://localhost:5134/api/catalogue/medicines"), ("doctor-payment-service", "http://localhost:5135/api/doctors") })
        {
            try { using var r = await Http.GetAsync(url); probe.Add($"{name}: GET {url} -> HTTP {(int)r.StatusCode}"); }
            catch (Exception e) { probe.Add($"{name}: BLOCKED - not running ({e.GetType().Name}); the real HTTP 401 for an anonymous request could not be observed. Code evidence: [Authorize(Policy = Patient)] on the controller."); }
        }
        File.WriteAllLines(Path.Combine(LogDir, "TC06-observed-messages-and-real-service-probe.txt"), observed.Concat(probe));
        Assert.That(problems, Is.Empty, "GCN49-FE-01 - a guest refused by the API gets no in-page guidance (only the header Login button remains):" + Environment.NewLine + string.Join(Environment.NewLine, problems));
    }

    // ------------------------------------------------------------------------------------------------ page helpers
    private void Go(string path) => _driver.Navigate().GoToUrl($"{BaseUrl}{path}");
    private string BodyText() => _driver.FindElement(By.TagName("body")).Text;
    private string MainText() => _driver.FindElement(By.CssSelector("main")).Text;
    private static string Squash(string text) => Regex.Replace(text, @"\s+", " ").Trim();
    private static string FirstMatchingLine(string text, string needle) => text.Split('\n').FirstOrDefault(l => l.Contains(needle))?.Trim() ?? needle;
    private T Js<T>(string script) => (T)((IJavaScriptExecutor)_driver).ExecuteScript(script)!;
    private IWebElement H1(string text) => _wait.Until(d => d.FindElements(By.CssSelector("h1")).FirstOrDefault(h => h.Text.Contains(text)));
    private IWebElement Sidebar(string label) => _wait.Until(d => d.FindElement(By.XPath($"//nav[contains(@class,'sidebar-nav')]//a[normalize-space()='{label}']")));
    private IWebElement Card(string name) => _driver.FindElement(By.XPath($"//a[contains(@class,'quicklink-card')][.//h3[normalize-space()='{name}']]"));
    private void Shot(string step) => Save($"{TestContext.CurrentContext.Test.Name}-{++_shots:00}-{step}");
    private void Save(string file) { Directory.CreateDirectory(ShotDir); ((ITakesScreenshot)_driver).GetScreenshot().SaveAsFile(Path.Combine(ShotDir, file + ".png")); }
}
