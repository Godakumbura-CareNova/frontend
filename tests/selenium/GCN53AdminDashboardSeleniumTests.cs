using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.SeleniumTests;

/// <summary>
/// GCN-53 Admin Dashboard (frontend only): exactly seven Selenium tests in headless Chrome against the local Vite frontend (http://localhost:3000).
/// The dashboard reads five admin endpoints on four services: GET /api/admin/dashboard/users (user service), /operations (pharmacy), /appointments and /appointment-payments
/// (appointment service) and /medicine-payments (doctor-payment service). Every call to the CareNova API ports (5133-5199) is answered by a deterministic in-test MOCK
/// (Selenium network interception) that applies the same role rule as the backends (401 without a valid identity, 403 for a role other than Admin) and can be told to fail,
/// answer invalid data or answer slowly, per endpoint. No backend, database or other service is contacted; sessions are test-made (unsigned token in localStorage);
/// all data is synthetic.
///
/// WHAT THESE TESTS PROVE: what the browser shows and does (statistics, module summaries, shortcuts, empty/failed/retry/stale states and warnings).
/// WHAT THEY CANNOT PROVE: that the real servers return correct admin data or enforce roles (backend tests), or the unit-level behaviour covered by Vitest.
///
///   GCN53-S01 Dashboard loads for an authenticated Admin          GCN53-S05 Partial API failure: affected module shows an error, healthy ones stay
///   GCN53-S02 Statistics, counts and module summaries are correct GCN53-S06 Retry recovers one section without reloading healthy ones
///   GCN53-S03 Shortcuts navigate to the right pages               GCN53-S07 Failed refresh keeps the data, labels it stale and warns (undated income)
///   GCN53-S04 Empty queues show valid zeros and empty states
/// </summary>
[TestFixture]
[NonParallelizable]
[Category("GCN53")]
public class GCN53AdminDashboardSeleniumTests
{
    private static readonly string BaseUrl = Environment.GetEnvironmentVariable("CARENOVA_BASE_URL") ?? "http://localhost:3000";
    private static readonly string Root = Environment.GetEnvironmentVariable("GCN53_REPORT_DIR")
        ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "carenova", "qa-reports", "GCN-53", "selenium");
    private static readonly string ShotDir = Path.Combine(Root, "screenshots");

    private const string Admin1 = "53e10000-0000-4000-8000-000000000001";
    private const string Gen = "2026-10-12T04:00:00Z";
    private const string Users = "/api/admin/dashboard/users", Operations = "/api/admin/dashboard/operations", Appointments = "/api/admin/dashboard/appointments";
    private const string MedicinePayments = "/api/admin/dashboard/medicine-payments", AppointmentPayments = "/api/admin/dashboard/appointment-payments";
    private static readonly string[] AllEndpoints = { Users, Operations, Appointments, MedicinePayments, AppointmentPayments };

    private IWebDriver _driver = null!;
    private WebDriverWait _wait = null!;
    private INetwork? _network;
    private readonly object _lock = new();
    private readonly List<Req> _requests = new();
    private readonly Dictionary<string, int> _fail = new();         // path -> status every call answers
    private readonly HashSet<string> _malformed = new();             // path -> 200 with a body the dashboard must reject
    private readonly Dictionary<string, int> _delay = new();         // path -> milliseconds before answering
    private bool _empty;                                              // true: operations, appointments and payments are empty
    private bool _undated;                                            // true: the medicine payment income reports undated successful payments
    private int _shots;

    private sealed record Req(string Method, string Path, string Authorization, string Subject, string Role, int Status);

    // ------------------------------------------------------------------------------------------------ synthetic data (every figure is consistent with the dashboard's own validation rules)
    private static object Order(int id, string status, decimal total) => new { id, reference = $"CN-ORD-ADM-{id}", orderDate = "2031-03-10T04:00:00Z", status, totalAmount = total };
    private static object MedPay(int id, int orderId, string method, string status, decimal amount, bool confirmed) =>
        new { id, orderId, reference = $"CN-PAY-ADM-{id}", amount, method, status, confirmedAtUtc = confirmed ? "2031-03-10T05:00:00Z" : null, updatedAtUtc = "2031-03-10T05:00:00Z" };
    private static object AptPay(int id, int appointmentId, string method, string status, decimal amount, bool confirmed) =>
        new { id, appointmentId, reference = $"CN-APTPAY-ADM-{id}", amount, method, status, confirmedAtUtc = confirmed ? "2031-03-10T05:00:00Z" : null, updatedAtUtc = "2031-03-10T05:00:00Z" };
    private static object Income(decimal today, decimal month, int undated, decimal undatedAmount) =>
        new { todayAmount = today, monthAmount = month, undatedSuccessfulCount = undated, undatedSuccessfulAmount = undatedAmount, currency = "LKR", timeZone = "Asia/Colombo", asOfUtc = Gen };

    private object Body(string path) => path switch
    {
        Users => new { totalUsers = 25, patients = 14, pharmacyStaff = 4, doctors = 5, generatedAtUtc = Gen },
        Operations when _empty => new { totalOrders = 0, orderStatusCounts = new Dictionary<string, int>(), recentOrders = Array.Empty<object>(), lowStock = new { totalCount = 0, items = Array.Empty<object>() }, generatedAtUtc = Gen },
        Operations => new
        {
            totalOrders = 12, orderStatusCounts = new Dictionary<string, int> { ["Pending"] = 5, ["ReadyForCollection"] = 3, ["Collected"] = 4 },
            recentOrders = new[] { Order(901, "Pending", 1200m), Order(902, "ReadyForCollection", 2500m), Order(903, "Collected", 800m) },
            lowStock = new { totalCount = 3, items = new[] { new { medicineId = 7, medicineName = "Paracetamol QA", quantity = 0, threshold = 10 }, new { medicineId = 8, medicineName = "Amoxicillin QA", quantity = 4, threshold = 10 }, new { medicineId = 9, medicineName = "Cetirizine QA", quantity = 9, threshold = 10 } } },
            generatedAtUtc = Gen,
        },
        Appointments when _empty => new { totalAppointments = 0, statusCounts = new Dictionary<string, int>(), todayCount = 0, upcomingCount = 0, recentAppointments = Array.Empty<object>(), generatedAtUtc = Gen },
        Appointments => new
        {
            totalAppointments = 40, statusCounts = new Dictionary<string, int> { ["Booked"] = 20, ["Confirmed"] = 8, ["Completed"] = 9, ["Cancelled"] = 3 }, todayCount = 4, upcomingCount = 18,
            recentAppointments = new[]
            {
                new { id = 801, reference = "CN-APT-ADM-801", doctorName = "Dr Synthetic Admin", startUtc = "2031-03-12T04:00:00Z", status = "Booked", paymentMethod = (string?)"Cash", paymentStatus = (string?)"Pending" },
                new { id = 802, reference = "CN-APT-ADM-802", doctorName = "Dr Synthetic Admin", startUtc = "2031-03-13T04:00:00Z", status = "Confirmed", paymentMethod = (string?)"BankTransfer", paymentStatus = (string?)"ReceiptUnderVerification" },
                new { id = 803, reference = "CN-APT-ADM-803", doctorName = "", startUtc = "2031-03-01T04:00:00Z", status = "Completed", paymentMethod = (string?)null, paymentStatus = (string?)null },
            },
            generatedAtUtc = Gen,
        },
        MedicinePayments when _empty => new { totalPayments = 0, statusCounts = new Dictionary<string, int>(), pendingTransfers = new { totalCount = 0, items = Array.Empty<object>() }, recentPayments = Array.Empty<object>(), income = Income(0m, 0m, 0, 0m), generatedAtUtc = Gen },
        MedicinePayments => new
        {
            totalPayments = 10, statusCounts = new Dictionary<string, int> { ["Successful"] = 6, ["Pending"] = 2, ["Failed"] = 2 },
            pendingTransfers = new { totalCount = 2, items = new[] { MedPay(11, 901, "BankTransfer", "PendingVerification", 1200m, false), MedPay(12, 902, "BankTransfer", "PendingVerification", 900m, false) } },
            recentPayments = new[] { MedPay(13, 903, "BankTransfer", "Successful", 800m, true), MedPay(14, 904, "Cash", "Successful", 1500m, true) },
            income = _undated ? Income(3500m, 18500m, 2, 700m) : Income(3500m, 18500m, 0, 0m), generatedAtUtc = Gen,
        },
        AppointmentPayments when _empty => new { totalPayments = 0, statusCounts = new Dictionary<string, int>(), pendingTransfers = new { totalCount = 0, items = Array.Empty<object>() }, recentPayments = Array.Empty<object>(), income = Income(0m, 0m, 0, 0m), generatedAtUtc = Gen },
        AppointmentPayments => new
        {
            totalPayments = 15, statusCounts = new Dictionary<string, int> { ["Successful"] = 9, ["ReceiptUnderVerification"] = 3, ["Pending"] = 3 },
            pendingTransfers = new { totalCount = 3, items = new[] { AptPay(21, 801, "BankTransfer", "ReceiptUnderVerification", 2000m, false) } },
            recentPayments = new[] { AptPay(24, 802, "BankTransfer", "Successful", 2000m, true) },
            income = Income(2000m, 9000m, 0, 0m), generatedAtUtc = Gen,
        },
        _ => new { },
    };

    // ------------------------------------------------------------------------------------------------ lifecycle
    private async Task Start()
    {
        _shots = 0; _fail.Clear(); _malformed.Clear(); _delay.Clear(); _empty = false; _undated = false;
        lock (_lock) _requests.Clear();
        var options = new ChromeOptions();
        options.AddArgument("--headless");
        options.AddArgument("--window-size=1400,1000");
        // the first page load of a fresh Chrome against the Vite dev server can exceed WebDriver's default 60 s command timeout (modules are compiled on demand)
        _driver = new ChromeDriver(ChromeDriverService.CreateDefaultService(), options, TimeSpan.FromMinutes(4));
        _wait = new WebDriverWait(_driver, TimeSpan.FromSeconds(20));
        _wait.IgnoreExceptionTypes(typeof(StaleElementReferenceException), typeof(NoSuchElementException));
        _network = _driver.Manage().Network;
        _network.AddRequestHandler(new NetworkRequestHandler
        {
            RequestMatcher = r => Uri.TryCreate(r.Url, UriKind.Absolute, out var u) && u.Host == "localhost" && u.Port is >= 5133 and <= 5199,
            ResponseSupplier = Supply,
        });
        await _network.StartMonitoring();
    }

    [TearDown]
    public async Task TearDown()
    {
        var name = TestContext.CurrentContext.Test.Name;
        var failed = TestContext.CurrentContext.Result.Outcome.Status == NUnit.Framework.Interfaces.TestStatus.Failed;
        try { Shot("final-state"); if (failed) Save($"{name}-FAILURE"); } catch { /* browser may be gone */ }
        try { if (_network != null) await _network.StopMonitoring(); } catch { /* best effort */ }
        try { _driver.Quit(); _driver.Dispose(); } catch { /* best effort */ }
        _network = null;
    }

    // ------------------------------------------------------------------------------------------------ mock API
    private static HttpResponseData Respond(int status, string body)
    {
        var r = new HttpResponseData { StatusCode = status, Body = body };
        r.Headers["Access-Control-Allow-Origin"] = BaseUrl;
        r.Headers["Access-Control-Allow-Headers"] = "authorization, content-type";
        r.Headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
        r.Headers["Content-Type"] = "application/json";
        return r;
    }
    private static (string Sub, string Role) Identity(string authorization)
    {
        try
        {
            var payload = authorization.Substring("Bearer ".Length).Split('.')[1].Replace('-', '+').Replace('_', '/');
            payload = payload.PadRight(payload.Length + (4 - payload.Length % 4) % 4, '=');
            var json = JsonDocument.Parse(Convert.FromBase64String(payload)).RootElement;
            return (json.GetProperty("sub").GetString() ?? "", json.GetProperty("role").GetString() ?? "");
        }
        catch { return ("", ""); }
    }
    private HttpResponseData Supply(HttpRequestData request)
    {
        var uri = new Uri(request.Url!); var path = uri.AbsolutePath.TrimEnd('/'); var method = (request.Method ?? "GET").ToUpperInvariant();
        if (method == "OPTIONS") return Respond(204, "");
        var auth = request.Headers.FirstOrDefault(h => h.Key.Equals("Authorization", StringComparison.OrdinalIgnoreCase)).Value ?? "";
        var (sub, role) = Identity(auth);
        HttpResponseData Done(int status, string content) { lock (_lock) _requests.Add(new(method, path, auth, sub, role, status)); return Respond(status, content); }
        if (!AllEndpoints.Contains(path)) return Done(200, "[]");     // layout extras (notifications etc.)
        int wait; lock (_lock) _delay.TryGetValue(path, out wait);
        if (wait > 0) Thread.Sleep(wait);
        if (!auth.StartsWith("Bearer ") || !Guid.TryParse(sub, out var g) || g == Guid.Empty) return Done(401, "{}");
        if (role != "Admin") return Done(403, "");                                                         // admin-only endpoints
        lock (_lock)
        {
            if (_fail.TryGetValue(path, out var status) && status != 0) return Done(status, "{\"message\":\"simulated failure\"}");
            if (_malformed.Contains(path)) return Done(200, JsonSerializer.Serialize(new { generatedAtUtc = Gen, totalPayments = -1 }));
            return Done(200, JsonSerializer.Serialize(Body(path)));
        }
    }
    private int Count(string path) { lock (_lock) return _requests.Count(r => r.Path == path); }
    private Dictionary<string, int> Counts() => AllEndpoints.ToDictionary(p => p, Count);
    private List<Req> Dashboard() { lock (_lock) return _requests.Where(r => AllEndpoints.Contains(r.Path)).ToList(); }
    /// <summary>Waits until no further dashboard request arrives (the initial loads have all been answered), then returns the counts.</summary>
    private Dictionary<string, int> SettledCounts()
    {
        var last = -1; var wait = new WebDriverWait(_driver, TimeSpan.FromSeconds(20)) { PollingInterval = TimeSpan.FromMilliseconds(400) };
        wait.Until(d => { var now = Dashboard().Count; var same = now == last && now >= AllEndpoints.Length; last = now; return same; });
        return Counts();
    }

    // ------------------------------------------------------------------------------------------------ browser helpers
    private static string B64(string s) => Convert.ToBase64String(Encoding.UTF8.GetBytes(s)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    private void Go(string path) => _driver.Navigate().GoToUrl(BaseUrl + path);
    private T Js<T>(string script, params object[] args) => (T)((IJavaScriptExecutor)_driver).ExecuteScript(script, args)!;
    private string BodyText() => _driver.FindElement(By.TagName("body")).Text;
    private string PathNow() => new Uri(_driver.Url).AbsolutePath;
    private string QueryNow() => new Uri(_driver.Url).Query;
    private void Click(IWebElement e) { Js<object?>("arguments[0].scrollIntoView({block:'center'});", e); e.Click(); }
    private void Shot(string step) => Save($"{TestContext.CurrentContext.Test.Name}-{++_shots:00}-{step}");
    private void Save(string file) { Directory.CreateDirectory(ShotDir); ((ITakesScreenshot)_driver).GetScreenshot().SaveAsFile(Path.Combine(ShotDir, file + ".png")); }

    private void SignIn(string role = "Admin", string sub = Admin1, string name = "QA Admin")
    {
        Go("/about"); Js<object?>("localStorage.clear();");
        Go("/login");
        _wait.Until(d => d.FindElements(By.TagName("form")).Any());
        var payload = JsonSerializer.Serialize(new { sub, role, exp = DateTimeOffset.UtcNow.AddHours(2).ToUnixTimeSeconds() });
        var token = $"{B64("{\"alg\":\"none\",\"typ\":\"JWT\"}")}.{B64(payload)}.test";
        var user = JsonSerializer.Serialize(new { userId = sub, email = "qa@example.test", role, fullName = name });
        Js<object?>("localStorage.setItem('carenova_token', arguments[0]); localStorage.setItem('carenova_user', arguments[1]);", token, user);
    }
    private void OpenDashboard() { Go("/admin-dashboard"); _wait.Until(d => PathNow() == "/admin-dashboard" && BodyText().Contains("Welcome back")); }
    private IWebElement StatCard(string title) => _wait.Until(d => d.FindElements(By.XPath($"//*[contains(@class,'stat-card')][div[contains(@class,'stat-card-title')][normalize-space()=\"{title}\"]]")).FirstOrDefault(e => e.Displayed)!);
    private string StatValue(string title) => _driver.FindElements(By.XPath($"//*[contains(@class,'stat-card')][div[contains(@class,'stat-card-title')][normalize-space()=\"{title}\"]]/div[contains(@class,'stat-card-value')]")).FirstOrDefault()?.Text ?? "";
    private void WaitStat(string title, string value) => _wait.Until(d => StatValue(title) == value);
    private IWebElement Section(string label) => _wait.Until(d => d.FindElements(By.CssSelector($"section[aria-label=\"{label}\"]")).FirstOrDefault(e => e.Displayed)!);
    private string SectionText(string label) => _driver.FindElements(By.CssSelector($"section[aria-label=\"{label}\"]")).FirstOrDefault()?.Text ?? "";
    private void WaitSection(string label, string text) => _wait.Until(d => SectionText(label).Contains(text));
    private static string Href(IWebElement e) => new Uri(e.GetAttribute("href")!).PathAndQuery + new Uri(e.GetAttribute("href")!).Fragment;
    private void WaitPath(string path, string query = "") => _wait.Until(d => PathNow() == path && QueryNow() == query);
    private void AssertMoney(string text, string amount) => Assert.That(text, Does.Match($"LKR\\s*{Regex.Escape(amount)}"), $"expected LKR {amount} in: {text}");
    private IWebElement RetryButton(string section) => _wait.Until(d => d.FindElements(By.CssSelector($"button[aria-label='Retry {section.ToLowerInvariant()}']")).FirstOrDefault(e => e.Displayed)!);
    private IWebElement RefreshDashboard() => _wait.Until(d => d.FindElements(By.XPath("//button[normalize-space()='Refresh dashboard']")).FirstOrDefault(e => e.Displayed)!);
    private IWebElement Sidebar(string label) => _wait.Until(d => d.FindElements(By.XPath($"//*[contains(@class,'sidebar-nav-item')][normalize-space()='{label}']")).FirstOrDefault(e => e.Displayed)!);
    private const string Failure = "This information is unavailable. Please retry.";
    private static readonly string[] SectionTitles = { "User statistics", "Medicine order activity", "Appointment activity", "Medicine payments and income", "Appointment payments and income" };
    private void WaitAllLoaded() => _wait.Until(d => SectionTitles.All(t => SectionText(t).Contains("Last refreshed:") || SectionText(t).Contains(Failure)));

    // =============================================================================================================
    // GCN53-S01  Dashboard loads for an authenticated Admin
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN53-S01"), Description("MOCKED API. A signed-in Admin opens /admin-dashboard and sees the welcome banner, nine summary cards with real values (none Unavailable), the five module sections each marked 'Last refreshed' (Sri Lanka time), the Refresh button, the quick links and the admin sidebar without patient, doctor or pharmacy entries; no error is shown and each of the five admin endpoints was called with the admin's identity and role.")]
    public async Task GCN53_S01_AdminDashboardLoadsForAuthenticatedAdmin()
    {
        await Start();
        SignIn(); OpenDashboard();
        Assert.That(BodyText(), Does.Contain("Welcome back, Admin").And.Contain("Platform overview and user governance."));
        WaitAllLoaded();
        foreach (var title in new[] { "Total Users", "Patients", "Pharmacy Staff", "Doctors", "Medicine Orders", "Appointments", "Payment Summary", "Low-Stock Alerts" })
        { _wait.Until(d => StatValue(title) != "Unavailable" && StatValue(title) != ""); Assert.That(StatValue(title), Does.Match("^[0-9]+$"), title); }
        Assert.That(StatValue("Sales Totals"), Is.EqualTo("See income below"));
        foreach (var t in SectionTitles) { Assert.That(SectionText(t), Does.Contain("Last refreshed:").And.Contain("(Sri Lanka)"), t); Assert.That(SectionText(t), Does.Not.Contain(Failure), t); }
        Assert.That(RefreshDashboard().Enabled, Is.True);
        Assert.That(BodyText(), Does.Contain("Quick Links").And.Contain("Manage Users").And.Contain("Consultation Fee Requests"));
        Assert.That(_driver.FindElements(By.CssSelector("[role=alert]")), Is.Empty, "no error on a successful load");
        var side = new[] { "Dashboard", "Users", "Fee Requests", "Doctors", "Medicines", "Appointments", "Payments", "Reports" };
        foreach (var s in side) Assert.That(Sidebar(s).Displayed, Is.True, s);
        Assert.That(Sidebar("Dashboard").GetAttribute("class"), Does.Contain("active"));
        Assert.That(_driver.FindElements(By.CssSelector("a.sidebar-nav-item")).Select(a => new Uri(a.GetAttribute("href")!).AbsolutePath).Any(p => p.StartsWith("/patient") || p.StartsWith("/doctor") || p.StartsWith("/pharmacy")), Is.False, "an admin sees no patient, doctor or pharmacy entries");
        Shot("loaded");
        var calls = Dashboard();
        Assert.That(calls.Select(c => c.Path).Distinct().OrderBy(p => p), Is.EqualTo(AllEndpoints.OrderBy(p => p)), "exactly the five admin endpoints");
        Assert.That(calls.All(c => c.Subject == Admin1 && c.Role == "Admin" && c.Authorization.StartsWith("Bearer ") && c.Status == 200), Is.True);
    }

    // =============================================================================================================
    // GCN53-S02  Statistics and module summaries
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN53-S02"), Description("MOCKED API. The nine cards and the module sections show the figures of the five APIs: users 25/14/4/5, 12 orders with status counts and recent orders, 3 low-stock medicines with units and thresholds, 40 appointments (4 today, 18 upcoming) with status counts and recent appointments, and the medicine and appointment payment summaries (counts, bank transfers awaiting review, recent confirmed payments, today / month income) kept separate; the payment card is the sum 25.")]
    public async Task GCN53_S02_DashboardDisplaysCorrectStatisticsCountsAndModuleSummaries()
    {
        await Start();
        SignIn(); OpenDashboard(); WaitAllLoaded();
        var cards = new (string Title, string Value)[] { ("Total Users", "25"), ("Patients", "14"), ("Pharmacy Staff", "4"), ("Doctors", "5"), ("Medicine Orders", "12"), ("Appointments", "40"), ("Payment Summary", "25"), ("Low-Stock Alerts", "3") };
        foreach (var c in cards) WaitStat(c.Title, c.Value);
        Assert.That(SectionText("User statistics"), Does.Contain("include inactive accounts").And.Contain("administrators"));
        var ops = SectionText("Medicine order activity");
        Assert.That(ops, Does.Contain("Pending: 5").And.Contain("Ready for collection: 3").And.Contain("Collected: 4").And.Contain("CN-ORD-ADM-901").And.Contain("CN-ORD-ADM-902").And.Contain("CN-ORD-ADM-903"));
        AssertMoney(ops, "1,200.00"); AssertMoney(ops, "2,500.00");
        var stock = SectionText("Low-stock alerts");
        Assert.That(stock, Does.Contain("Low-stock alerts (3)").And.Contain("Paracetamol QA").And.Contain("Out of stock").And.Contain("Amoxicillin QA").And.Contain("4 units remaining").And.Contain("Cetirizine QA").And.Contain("9 units remaining").And.Contain("Alert threshold: 10"));
        var apt = SectionText("Appointment activity");
        Assert.That(apt, Does.Contain("Today: 4 · Upcoming active appointments: 18").And.Contain("Booked: 20").And.Contain("Confirmed: 8").And.Contain("Completed: 9").And.Contain("Cancelled: 3")
            .And.Contain("CN-APT-ADM-801").And.Contain("Dr Synthetic Admin").And.Contain("Booked · Cash · Pending").And.Contain("Confirmed · Bank transfer · Receipt under verification").And.Contain("Doctor name unavailable"));
        var med = SectionText("Medicine payments and income");
        Assert.That(med, Does.Contain("10 transactions").And.Contain("Successful: 6").And.Contain("Pending: 2").And.Contain("Failed: 2").And.Contain("2 uploaded receipts awaiting review")
            .And.Contain("CN-PAY-ADM-11").And.Contain("Pending verification").And.Contain("CN-PAY-ADM-13").And.Contain("Gross confirmed receipts").And.Contain("Today").And.Contain("This month").And.Not.Contain("have no confirmed date"));
        AssertMoney(med, "3,500.00"); AssertMoney(med, "18,500.00");
        var apay = SectionText("Appointment payments and income");
        Assert.That(apay, Does.Contain("15 transactions").And.Contain("Successful: 9").And.Contain("Receipt under verification: 3").And.Contain("3 uploaded receipts awaiting review").And.Contain("CN-APTPAY-ADM-21").And.Contain("CN-APTPAY-ADM-24"));
        AssertMoney(apay, "2,000.00"); AssertMoney(apay, "9,000.00");
        Assert.That(apay, Does.Not.Contain("CN-PAY-ADM").And.Not.Contain("18,500.00"), "appointment figures are not mixed with medicine figures");
        Assert.That(med, Does.Not.Contain("CN-APTPAY").And.Not.Contain("9,000.00"));
        Shot("summaries");
    }

    // =============================================================================================================
    // GCN53-S03  Shortcuts
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN53-S03"), Description("MOCKED API. Every card and link points at the right target (users, doctors, appointments, the in-page orders / income / payment-summary / low-stock anchors, manage users, fee requests, all medicine payments, a payment detail), no link leaves the admin area, and clicking them really navigates: page cards open their pages, in-page cards move to their section on the same page.")]
    public async Task GCN53_S03_AdminDashboardShortcutsNavigateToTheCorrectPages()
    {
        await Start();
        SignIn(); OpenDashboard(); WaitAllLoaded(); WaitStat("Total Users", "25");
        var targets = new (string Title, string Target)[] { ("Total Users", "/admin/users"), ("Patients", "/admin/users"), ("Pharmacy Staff", "/admin/users"), ("Doctors", "/admin/doctors"),
            ("Medicine Orders", "/admin-dashboard#admin-orders"), ("Appointments", "/admin/appointments"), ("Sales Totals", "/admin-dashboard#admin-income"),
            ("Payment Summary", "/admin-dashboard#admin-payment-summary"), ("Low-Stock Alerts", "/admin-dashboard#admin-low-stock") };
        foreach (var t in targets) Assert.That(Href(StatCard(t.Title)), Is.EqualTo(t.Target), t.Title);
        foreach (var anchor in new[] { "admin-orders", "admin-income", "admin-payment-summary", "admin-low-stock" }) Assert.That(_driver.FindElements(By.Id(anchor)), Has.Count.EqualTo(1), $"the target #{anchor} exists");
        Assert.That(Href(_driver.FindElement(By.XPath("//a[.//div[normalize-space()='Manage Users']]"))), Is.EqualTo("/admin/users"));
        Assert.That(Href(_driver.FindElement(By.XPath("//a[.//div[normalize-space()='Consultation Fee Requests']]"))), Is.EqualTo("/admin/fee-requests"));
        Assert.That(Href(_driver.FindElement(By.PartialLinkText("Manage registered users"))), Is.EqualTo("/admin/users"));
        Assert.That(Href(_driver.FindElement(By.PartialLinkText("View all medicine payments"))), Is.EqualTo("/admin/payments"));
        Assert.That(Href(Section("Medicine payments and income").FindElement(By.LinkText("CN-PAY-ADM-13"))), Is.EqualTo("/admin/payments/13"));
        Assert.That(_driver.FindElements(By.CssSelector("a[href]")).Select(a => new Uri(a.GetAttribute("href")!).AbsolutePath).Any(p => Regex.IsMatch(p, "^/(pharmacy|doctor|patient)")), Is.False, "no link leaves the admin area");
        Shot("targets");

        // in-page anchors: stay on the dashboard and move to the section
        Click(StatCard("Medicine Orders"));
        _wait.Until(d => _driver.Url.EndsWith("#admin-orders") && PathNow() == "/admin-dashboard");
        _wait.Until(d => Js<bool>("const r = document.getElementById('admin-orders').getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0;"));
        Click(StatCard("Low-Stock Alerts"));
        _wait.Until(d => _driver.Url.EndsWith("#admin-low-stock") && Js<bool>("const r = document.getElementById('admin-low-stock').getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0;"));
        Click(StatCard("Payment Summary"));
        _wait.Until(d => _driver.Url.EndsWith("#admin-payment-summary"));
        // page shortcuts
        foreach (var go in new (string Title, string Path)[] { ("Total Users", "/admin/users"), ("Doctors", "/admin/doctors"), ("Appointments", "/admin/appointments") })
        {
            OpenDashboard(); WaitStat(go.Title, go.Title == "Doctors" ? "5" : go.Title == "Appointments" ? "40" : "25");
            Click(StatCard(go.Title)); WaitPath(go.Path);
        }
        OpenDashboard(); WaitAllLoaded();
        Click(_driver.FindElement(By.XPath("//a[.//div[normalize-space()='Consultation Fee Requests']]"))); WaitPath("/admin/fee-requests");
        OpenDashboard(); WaitAllLoaded();
        Click(Section("Medicine payments and income").FindElement(By.LinkText("CN-PAY-ADM-13"))); WaitPath("/admin/payments/13");
        Shot("payment-detail");
    }

    // =============================================================================================================
    // GCN53-S04  Empty queues
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN53-S04"), Description("MOCKED API. With no orders, appointments, payments or low-stock medicines the cards show 0 (not Unavailable), every list shows its own empty message ('No medicine orders yet.', 'No appointments yet.', 'No low-stock alerts.', 'No dated confirmed payments available.' in both payment sections), counts read 0, income reads LKR 0.00, and no error or undated-income warning appears.")]
    public async Task GCN53_S04_EmptyQueuesDisplayZeroValuesAndEmptyStates()
    {
        await Start(); _empty = true;
        SignIn(); OpenDashboard(); WaitAllLoaded();
        foreach (var title in new[] { "Medicine Orders", "Appointments", "Payment Summary", "Low-Stock Alerts" }) WaitStat(title, "0");
        WaitStat("Total Users", "25");
        Assert.That(BodyText(), Does.Not.Contain("Unavailable"));
        Assert.That(SectionText("Medicine order activity"), Does.Contain("No medicine orders yet."));
        Assert.That(SectionText("Low-stock alerts"), Does.Contain("Low-stock alerts (0)").And.Contain("No low-stock alerts."));
        Assert.That(SectionText("Appointment activity"), Does.Contain("Today: 0 · Upcoming active appointments: 0").And.Contain("No appointments yet."));
        foreach (var t in new[] { "Medicine payments and income", "Appointment payments and income" })
        {
            var text = SectionText(t);
            Assert.That(text, Does.Contain("0 transactions").And.Contain("0 uploaded receipts awaiting review").And.Contain("No dated confirmed payments available.").And.Not.Contain("have no confirmed date"), t);
            AssertMoney(text, "0.00");
            Assert.That(_driver.FindElements(By.CssSelector($"section[aria-label=\"{t}\"] ul.role-dashboard-payment-list")), Is.Empty, $"{t} lists no payments");
        }
        Assert.That(_driver.FindElements(By.CssSelector("[role=alert]")), Is.Empty, "empty data is not an error");
        Assert.That(_driver.FindElements(By.CssSelector("section[aria-label='Medicine order activity'] article")), Is.Empty);
        Shot("empty");
    }

    // =============================================================================================================
    // GCN53-S05  Partial API failure
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN53-S05"), Description("MOCKED API. The pharmacy operations API fails (500) and the appointment-payment API answers invalid data: those two modules show the error and a Retry button and their cards read Unavailable (never zero, no empty-state message), while the user, appointment and medicine-payment modules stay fully visible with their own figures; the low-stock shortcut target still exists.")]
    public async Task GCN53_S05_PartialApiFailureShowsErrorForAffectedModuleWhileHealthySectionsRemainVisible()
    {
        await Start(); _fail[Operations] = 500; _malformed.Add(AppointmentPayments);
        SignIn(); OpenDashboard(); WaitAllLoaded();
        foreach (var failed in new[] { "Medicine order activity", "Appointment payments and income" })
        {
            _wait.Until(d => SectionText(failed).Contains(Failure));
            Assert.That(_driver.FindElements(By.CssSelector($"section[aria-label=\"{failed}\"] [role=alert]")), Has.Count.EqualTo(1), failed);
            Assert.That(RetryButton(failed).Displayed, Is.True, failed);
            Assert.That(SectionText(failed), Does.Not.Contain("No medicine orders yet.").And.Not.Contain("No dated confirmed payments available.").And.Not.Contain("0 transactions"), $"{failed}: an error is not shown as empty data");
        }
        Assert.That(StatValue("Medicine Orders"), Is.EqualTo("Unavailable")); Assert.That(StatValue("Low-Stock Alerts"), Is.EqualTo("Unavailable"));
        Assert.That(StatValue("Payment Summary"), Is.EqualTo("Unavailable"), "the payment total needs both payment modules");
        Assert.That(_driver.FindElements(By.Id("admin-low-stock")), Has.Count.EqualTo(1), "the low-stock shortcut target is still on the page");
        // the healthy modules are untouched
        WaitStat("Total Users", "25"); WaitStat("Doctors", "5"); WaitStat("Appointments", "40");
        Assert.That(SectionText("User statistics"), Does.Contain("Last refreshed:").And.Not.Contain(Failure));
        Assert.That(SectionText("Appointment activity"), Does.Contain("CN-APT-ADM-801").And.Contain("Booked: 20").And.Not.Contain(Failure));
        Assert.That(SectionText("Medicine payments and income"), Does.Contain("10 transactions").And.Contain("CN-PAY-ADM-13").And.Not.Contain(Failure));
        Assert.That(_driver.FindElements(By.CssSelector("[role=alert]")), Has.Count.EqualTo(2), "exactly the two failed modules report an error");
        Shot("partial-failure");
    }

    // =============================================================================================================
    // GCN53-S06  Retry
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN53-S06"), Description("MOCKED API. With two failed modules, a Retry that still fails keeps that module's error and sends exactly one request to its API only; after the server recovers, Retry restores the module's data, cards and low-stock list, while the other failed module and every healthy module are neither reloaded nor changed.")]
    public async Task GCN53_S06_RetryRecoversAFailedSectionWithoutReloadingHealthyModules()
    {
        await Start(); _fail[Operations] = 500; _fail[Appointments] = 503;
        SignIn(); OpenDashboard(); WaitAllLoaded();
        _wait.Until(d => SectionText("Medicine order activity").Contains(Failure) && SectionText("Appointment activity").Contains(Failure));
        var baseline = SettledCounts();
        Shot("two-failures");

        // retry that still fails: only the operations API is called again
        Click(RetryButton("Medicine order activity"));
        _wait.Until(d => Count(Operations) == baseline[Operations] + 1);
        _wait.Until(d => SectionText("Medicine order activity").Contains(Failure));
        Assert.That(StatValue("Medicine Orders"), Is.EqualTo("Unavailable"));
        foreach (var other in AllEndpoints.Where(p => p != Operations)) Assert.That(Count(other), Is.EqualTo(baseline[other]), $"{other} was not reloaded");

        // the server recovers
        _fail.Remove(Operations);
        Click(RetryButton("Medicine order activity"));
        WaitSection("Medicine order activity", "CN-ORD-ADM-901");
        WaitStat("Medicine Orders", "12"); WaitStat("Low-Stock Alerts", "3");
        Assert.That(SectionText("Medicine order activity"), Does.Not.Contain(Failure).And.Contain("Pending: 5").And.Contain("Last refreshed:"));
        Assert.That(SectionText("Low-stock alerts"), Does.Contain("Paracetamol QA"));
        Assert.That(Count(Operations), Is.EqualTo(baseline[Operations] + 2), "one request per Retry click");
        foreach (var other in AllEndpoints.Where(p => p != Operations)) Assert.That(Count(other), Is.EqualTo(baseline[other]), $"{other} still not reloaded");
        Assert.That(SectionText("Appointment activity"), Does.Contain(Failure), "the other failed module stays failed until it is retried");
        Assert.That(StatValue("Appointments"), Is.EqualTo("Unavailable")); Assert.That(StatValue("Total Users"), Is.EqualTo("25"));
        Assert.That(_driver.FindElements(By.CssSelector("[role=alert]")), Has.Count.EqualTo(1));
        Shot("operations-recovered");

        _fail.Remove(Appointments);
        Click(RetryButton("Appointment activity"));
        WaitStat("Appointments", "40"); WaitSection("Appointment activity", "CN-APT-ADM-801");
        Assert.That(Count(Appointments), Is.EqualTo(baseline[Appointments] + 1));
        _wait.Until(d => !d.FindElements(By.CssSelector("[role=alert]")).Any());
        Assert.That(Count(Operations), Is.EqualTo(baseline[Operations] + 2), "the recovered module was not reloaded again");
    }

    // =============================================================================================================
    // GCN53-S07  Failed refresh, stale data, undated income
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN53-S07"), Description("MOCKED API. After a good load that reports 2 undated successful medicine payments (warning with LKR 700.00, absent from the appointment payments), Refresh dashboard sends one request per API; the operations API answers slowly then fails: the section says 'Refreshing information…' with its data still shown, then keeps the data with the error, 'Showing the last loaded information. It may be out of date.' and the old 'Last refreshed' time, the card keeps 12, the other modules refresh normally and the warning stays; Retry then restores fresh data and removes the stale notice.")]
    public async Task GCN53_S07_FailedRefreshPreservesDataLabelsItStaleAndWarnsAboutUndatedIncome()
    {
        await Start(); _undated = true;
        SignIn(); OpenDashboard(); WaitAllLoaded(); WaitStat("Medicine Orders", "12");
        var warning = "2 successful payments have no confirmed date";
        Assert.That(SectionText("Medicine payments and income"), Does.Contain(warning).And.Contain("Period totals include only known dated receipts."));
        AssertMoney(SectionText("Medicine payments and income"), "700.00");
        Assert.That(SectionText("Appointment payments and income"), Does.Not.Contain("have no confirmed date"));
        Assert.That(_driver.FindElements(By.CssSelector("[role=alert]")), Is.Empty);
        var firstRefreshed = Regex.Match(SectionText("Medicine order activity"), "Last refreshed: [^\\n]+").Value;
        Assert.That(firstRefreshed, Is.Not.Empty);
        var baseline = SettledCounts();
        Shot("loaded-with-warning");

        // the refresh: operations is slow and then fails
        _delay[Operations] = 1500; _fail[Operations] = 500;
        Click(RefreshDashboard());
        _wait.Until(d => SectionText("Medicine order activity").Contains("Refreshing information…"));
        Assert.That(SectionText("Medicine order activity"), Does.Contain("CN-ORD-ADM-901"), "the previous data stays visible while refreshing");
        Shot("refreshing");
        _wait.Until(d => SectionText("Medicine order activity").Contains(Failure));
        var ops = SectionText("Medicine order activity");
        Assert.That(ops, Does.Contain("Showing the last loaded information. It may be out of date.").And.Contain("CN-ORD-ADM-901").And.Contain("Pending: 5").And.Not.Contain("Refreshing information…"));
        Assert.That(Regex.Match(ops, "Last refreshed: [^\\n]+").Value, Is.EqualTo(firstRefreshed), "the old refresh time is kept: the data is not presented as new");
        Assert.That(StatValue("Medicine Orders"), Is.EqualTo("12"), "the card keeps the last loaded value instead of Unavailable");
        Assert.That(SectionText("Low-stock alerts"), Does.Contain("Paracetamol QA"));
        Assert.That(_driver.FindElements(By.CssSelector("[role=alert]")), Has.Count.EqualTo(1), "only the failed module warns");
        foreach (var p in AllEndpoints) Assert.That(Count(p), Is.EqualTo(baseline[p] + 1), $"{p}: one request per refresh");
        Assert.That(SectionText("Medicine payments and income"), Does.Contain(warning), "the undated-income warning survives the refresh");
        Shot("stale");

        // recovery
        _delay.Clear(); _fail.Remove(Operations);
        Click(RetryButton("Medicine order activity"));
        _wait.Until(d => !SectionText("Medicine order activity").Contains(Failure));
        Assert.That(SectionText("Medicine order activity"), Does.Not.Contain("out of date").And.Contain("CN-ORD-ADM-901").And.Contain("Last refreshed:"));
        Assert.That(_driver.FindElements(By.CssSelector("[role=alert]")), Is.Empty);
        Assert.That(Count(Operations), Is.EqualTo(baseline[Operations] + 2));
        Shot("recovered");
    }
}
