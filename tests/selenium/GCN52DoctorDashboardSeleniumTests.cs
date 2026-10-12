using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.SeleniumTests;

/// <summary>
/// GCN-52 Doctor Dashboard (frontend only): exactly ten Selenium tests in headless Chrome against the local Vite frontend (http://localhost:3000).
/// The dashboard has no endpoint of its own: it reads the doctor appointment API (GET /api/doctor/appointments, details GET /api/doctor/appointments/{id},
/// status change PATCH /api/doctor/appointments/{id}/status). Every call to the CareNova API ports (5133-5199) is answered by a deterministic, stateful in-test MOCK
/// (Selenium network interception) that mirrors that contract and its role rules (401 without a valid identity, 403 for another role). No backend, database or
/// user-auth service is contacted; the sessions are test-made (unsigned token in localStorage); all people, phone numbers and references are synthetic.
///
/// WHAT THESE TESTS PROVE: what the browser shows and does: totals, bounded previews, section content, empty/failed/retry states, navigation, and that the dashboard reloads after a status change.
/// WHAT THEY CANNOT PROVE: that the real server returns correct data or enforces roles (backend tests), or the unit-level behaviour covered by Vitest.
///
///   GCN52-D01 Dashboard loads for an authenticated doctor          GCN52-D06 Sidebar navigation (Appointments / Dashboard)
///   GCN52-D02 Totals are correct and Refresh picks up changes      GCN52-D07 Empty sections show their own messages
///   GCN52-D03 Upcoming preview is bounded, ordered and complete    GCN52-D08 Failed responses: error, Unavailable, no fake empty states
///   GCN52-D04 Today's section content                              GCN52-D09 Retry recovers (and keeps the last good data on a later failure)
///   GCN52-D05 Details / schedule navigation                        GCN52-D10 Dashboard reflects an appointment status change
/// </summary>
[TestFixture]
[NonParallelizable]
[Category("GCN52")]
public class GCN52DoctorDashboardSeleniumTests
{
    private static readonly string BaseUrl = Environment.GetEnvironmentVariable("CARENOVA_BASE_URL") ?? "http://localhost:3000";
    private static readonly string Root = Environment.GetEnvironmentVariable("GCN52_REPORT_DIR")
        ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "carenova", "qa-reports", "GCN-52", "selenium");
    private static readonly string ShotDir = Path.Combine(Root, "screenshots");

    private const string Doctor1 = "52d10000-0000-4000-8000-000000000001";
    private const string Patient1 = "52a10000-0000-4000-8000-000000000001";
    private const string ListPath = "/api/doctor/appointments";

    private IWebDriver _driver = null!;
    private WebDriverWait _wait = null!;
    private INetwork? _network;
    private readonly object _lock = new();
    private readonly List<Req> _requests = new();
    private List<Appt> _all = new();
    private int _failStatus;          // 0 = normal; otherwise every GET of the doctor list answers this status
    private bool _malformed;          // answers 200 with a body the dashboard must reject
    private int _stamp;
    private int _shots;

    private sealed record Req(string Method, string Path, string Authorization, string Subject, string Role, string Body, int Status);
    private sealed class Appt
    {
        public int Id; public string Patient = ""; public string Name = ""; public string Phone = ""; public string Start = "", End = ""; public string Status = "Booked";
        public string? Method, PayStatus, UpdatedAt; public bool Today, Upcoming, Completed, History; public List<string> Allowed = new();
        public string Ref => $"CN-APT-DASH-{Id}";
    }
    private static string Pid(int n) => $"52b00000-0000-4000-8000-{n:000000000000}";
    private static Appt A(int id, int patient, string name, string start, string status, string? method, string? pay, bool today = false, bool upcoming = false, bool completed = false, string? allowed = null)
    {
        var s = DateTime.Parse(start).ToUniversalTime();
        return new Appt { Id = id, Patient = Pid(patient), Name = name, Phone = $"07712{id:00000}", Start = start, End = s.AddMinutes(30).ToString("yyyy-MM-ddTHH:mm:ssZ"), Status = status, Method = method, PayStatus = pay,
                          Today = today, Upcoming = upcoming, Completed = completed, Allowed = allowed is null ? new() : new() { allowed } };
    }

    /// <summary>Synthetic data. All times are UTC; the UI shows Sri Lanka time (UTC + 5:30). 2 today, 7 upcoming (preview shows 5), 6 completed (preview shows the newest 5).</summary>
    private static List<Appt> FullData() => new()
    {
        A(310, 9,  "Amali Fonseka",       "2031-03-01T04:00:00Z", "Completed", "Cash", "Successful", completed: true),
        A(311, 10, "Buddhika Senanayake", "2031-03-02T04:00:00Z", "Completed", "BankTransfer", "Successful", completed: true),
        A(312, 11, "Chathuri Gunasekara", "2031-03-03T04:00:00Z", "Completed", "PaymentGateway", "Successful", completed: true),
        A(313, 12, "Danushka Wijesinghe", "2031-03-04T04:00:00Z", "Completed", "Cash", "Successful", completed: true),
        A(314, 9,  "Amali Fonseka",       "2031-03-05T04:00:00Z", "Completed", null, null, completed: true),
        A(315, 13, "Eranga Ratnayake",    "2031-03-06T04:00:00Z", "Completed", "Cash", "Successful", completed: true),
        A(302, 2,  "Kasun Fernando",      "2031-03-12T02:00:00Z", "Confirmed", "BankTransfer", "Successful", today: true, allowed: "Completed"),
        A(301, 1,  "Nimali Perera",       "2031-03-12T03:00:00Z", "Booked", "Cash", "Pending", today: true, allowed: "Confirmed"),
        A(303, 3,  "Dilani Silva",        "2031-03-14T05:30:00Z", "Booked", "Cash", "Pending", upcoming: true, allowed: "Confirmed"),
        A(304, 1,  "Nimali Perera",       "2031-03-15T05:30:00Z", "Confirmed", "BankTransfer", "ReceiptUnderVerification", upcoming: true),
        A(305, 4,  "Farhan Mohamed",      "2031-03-16T05:30:00Z", "Booked", null, null, upcoming: true, allowed: "Confirmed"),
        A(306, 5,  "Gayani Abeysekara",   "2031-03-17T05:30:00Z", "Confirmed", "PaymentGateway", "Successful", upcoming: true),
        A(307, 6,  "Hasitha Liyanage",    "2031-03-18T05:30:00Z", "Booked", "Cash", "Pending", upcoming: true, allowed: "Confirmed"),
        A(308, 7,  "Ishara Gunawardena",  "2031-03-19T05:30:00Z", "Confirmed", "Cash", "Successful", upcoming: true),
        A(309, 8,  "Janaka Weerasinghe",  "2031-03-20T05:30:00Z", "Booked", "BankTransfer", "AwaitingBankTransferReceipt", upcoming: true, allowed: "Confirmed"),
    };

    // ------------------------------------------------------------------------------------------------ lifecycle
    private async Task Start(List<Appt>? data = null)
    {
        _shots = 0; _failStatus = 0; _malformed = false; _stamp = 0; _all = data ?? FullData();
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

    // ------------------------------------------------------------------------------------------------ mock API (the doctor appointment contract)
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
    private static object Dto(Appt a) => new
    {
        id = a.Id, appointmentReference = a.Ref, patientId = a.Patient, patientName = a.Name, patientPhone = a.Phone, appointmentStartUtc = a.Start, appointmentEndUtc = a.End, status = a.Status,
        updatedAtUtc = a.UpdatedAt, paymentMethod = a.Method, paymentStatus = a.PayStatus, isToday = a.Today, isUpcoming = a.Upcoming && (a.Status is "Booked" or "Confirmed"), isCompleted = a.Completed,
        isHistory = a.History, allowedStatuses = a.Allowed, contactsUnavailable = false,
    };
    private object ListBody() { var mine = _all.OrderBy(a => a.Start).ThenBy(a => a.Id).ToList(); return new { appointments = mine.Select(Dto).ToList(),
        statistics = new { today = mine.Count(a => a.Today), upcoming = mine.Count(a => a.Upcoming), completed = mine.Count(a => a.Completed), patientCount = mine.Select(a => a.Patient).Distinct().Count() }, contactsUnavailable = false }; }

    private HttpResponseData Supply(HttpRequestData request)
    {
        var uri = new Uri(request.Url!); var path = uri.AbsolutePath.TrimEnd('/'); var method = (request.Method ?? "GET").ToUpperInvariant();
        if (method == "OPTIONS") return Respond(204, "");
        var auth = request.Headers.FirstOrDefault(h => h.Key.Equals("Authorization", StringComparison.OrdinalIgnoreCase)).Value ?? "";
        var (sub, role) = Identity(auth); var body = request.PostData ?? "";
        HttpResponseData Done(int status, string content) { lock (_lock) _requests.Add(new(method, path, auth, sub, role, body, status)); return Respond(status, content); }
        if (!path.StartsWith(ListPath, StringComparison.OrdinalIgnoreCase)) return Done(200, "[]");     // layout extras (notifications etc.)
        if (!auth.StartsWith("Bearer ") || !Guid.TryParse(sub, out var g) || g == Guid.Empty) return Done(401, "{}");
        if (role != "Doctor") return Done(403, "");                                                       // [Authorize(Roles = "Doctor")]
        lock (_lock)
        {
            if (path.Equals(ListPath, StringComparison.OrdinalIgnoreCase) && method == "GET")
            {
                if (_failStatus != 0) return Done(_failStatus, "{}");
                if (_malformed) return Done(200, JsonSerializer.Serialize(new { appointments = new List<object>(), statistics = new { } }));
                return Done(200, JsonSerializer.Serialize(ListBody()));
            }
            var m = Regex.Match(path, "^/api/doctor/appointments/(\\d+)(/status)?$", RegexOptions.IgnoreCase);
            var found = m.Success ? _all.FirstOrDefault(a => a.Id == int.Parse(m.Groups[1].Value)) : null;
            if (found is null) return Done(404, "");
            if (method == "GET" && !m.Groups[2].Success) return Done(200, JsonSerializer.Serialize(Dto(found)));
            if (method == "PATCH" && m.Groups[2].Success)
            {
                var req = JsonDocument.Parse(body).RootElement; var wanted = req.GetProperty("status").GetString()!;
                var expectedUpdated = req.TryGetProperty("expectedUpdatedAtUtc", out var eu) && eu.ValueKind == JsonValueKind.String ? eu.GetString() : null;
                if (found.Status != req.GetProperty("expectedStatus").GetString() || found.UpdatedAt != expectedUpdated) return Done(409, "{\"message\":\"This appointment changed. Refresh it before trying again.\"}");
                if (!found.Allowed.Contains(wanted)) return Done(400, "{\"message\":\"This status change is not allowed.\"}");
                found.Status = wanted; found.Allowed = new(); found.UpdatedAt = $"2026-10-12T10:00:{++_stamp:00}.1234560Z";
                if (wanted == "Completed") found.Completed = true;
                return Done(200, JsonSerializer.Serialize(new { id = found.Id, status = found.Status, updatedAtUtc = found.UpdatedAt }));
            }
        }
        return Done(404, "");
    }
    private List<Req> Sent(Func<Req, bool> filter) { lock (_lock) return _requests.Where(filter).ToList(); }
    private int ListLoads() => Sent(r => r.Method == "GET" && r.Path == ListPath).Count;

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

    private void SignIn(string role = "Doctor", string sub = Doctor1, string name = "Lakmal Perera")
    {
        Go("/about"); Js<object?>("localStorage.clear();");
        Go("/login");
        _wait.Until(d => d.FindElements(By.TagName("form")).Any());
        var payload = JsonSerializer.Serialize(new { sub, role, exp = DateTimeOffset.UtcNow.AddHours(2).ToUnixTimeSeconds() });
        var token = $"{B64("{\"alg\":\"none\",\"typ\":\"JWT\"}")}.{B64(payload)}.test";
        var user = JsonSerializer.Serialize(new { userId = sub, email = "qa@example.test", role, fullName = name });
        Js<object?>("localStorage.setItem('carenova_token', arguments[0]); localStorage.setItem('carenova_user', arguments[1]);", token, user);
    }
    private void OpenDashboard() { Go("/doctor-dashboard"); _wait.Until(d => PathNow() == "/doctor-dashboard" && BodyText().Contains("Welcome back")); }
    private IWebElement StatCard(string title) => _wait.Until(d => d.FindElements(By.XPath($"//*[contains(@class,'stat-card')][div[contains(@class,'stat-card-title')][normalize-space()=\"{title}\"]]")).FirstOrDefault(e => e.Displayed)!);
    private string StatValue(string title) => _driver.FindElements(By.XPath($"//*[contains(@class,'stat-card')][div[contains(@class,'stat-card-title')][normalize-space()=\"{title}\"]]/div[contains(@class,'stat-card-value')]")).FirstOrDefault()?.Text ?? "";
    private void WaitStat(string title, string value) => _wait.Until(d => StatValue(title) == value);
    private IWebElement Section(string label) => _wait.Until(d => d.FindElements(By.CssSelector($"section[aria-label=\"{label}\"]")).FirstOrDefault(e => e.Displayed)!);
    private string SectionText(string label) => _driver.FindElements(By.CssSelector($"section[aria-label=\"{label}\"]")).FirstOrDefault()?.Text ?? "";
    private List<IWebElement> Cards(string label) => Section(label).FindElements(By.CssSelector("article.order-card")).ToList();
    private List<string> CardRefs(string label) => Section(label).FindElements(By.CssSelector("article.order-card a.appointment-reference")).Select(a => a.Text).ToList();
    private static string Field(ISearchContext scope, string label) => scope.FindElement(By.XPath($".//div[span[normalize-space()='{label}']]/strong")).Text;
    private static string Chip(ISearchContext card) => card.FindElement(By.CssSelector(".appointment-status")).Text;
    private static void AssertTime(string actual, string start, string end) => Assert.That(actual, Does.Match($"(?i)^{start}\\s?(am|pm)\\s?[–-]\\s?{end}\\s?(am|pm)$"), "appointment time (Sri Lanka time)");
    private IWebElement Sidebar(string label) => _wait.Until(d => d.FindElements(By.XPath($"//nav//*[contains(@class,'sidebar-nav-item')][contains(normalize-space(),'{label}')] | //aside//*[contains(@class,'sidebar-nav-item')][contains(normalize-space(),'{label}')]")).FirstOrDefault(e => e.Displayed)!);
    private IWebElement DashLink(string text) => _wait.Until(d => d.FindElements(By.XPath($"//div[contains(@class,'doctor-appointments')]//a[normalize-space()=\"{text}\"]")).FirstOrDefault(e => e.Displayed)!);
    private IWebElement RefreshButton() => _wait.Until(d => d.FindElements(By.XPath("//button[normalize-space()='Refresh appointments']")).FirstOrDefault(e => e.Displayed)!);
    private IWebElement Alert() => _wait.Until(d => d.FindElements(By.CssSelector("[role=alert]")).FirstOrDefault(e => e.Displayed)!);
    private string SelectedTab() => _driver.FindElements(By.CssSelector("button[role=tab][aria-selected=true]")).Select(t => t.Text).SingleOrDefault() ?? "";
    private void WaitPath(string path, string query = "") => _wait.Until(d => PathNow() == path && QueryNow() == query);
    private static readonly string[] EmptyMessages = { "No scheduled appointments today.", "No upcoming appointments.", "No completed appointments yet." };

    // =============================================================================================================
    // GCN52-D01  The dashboard loads for an authenticated doctor
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN52-D01"), Description("MOCKED API. A signed-in Doctor opens /doctor-dashboard and sees the welcome banner with their first name, the Sri Lanka time note, the four statistic cards filled with real values (not Unavailable), the three appointment sections with content, the professional-profile shortcut and the doctor sidebar; no error is shown, and the appointment API was called with the doctor's identity and role.")]
    public async Task GCN52_D01_DashboardLoadsForAuthenticatedDoctor()
    {
        await Start();
        SignIn();
        OpenDashboard();
        Assert.That(PathNow(), Is.EqualTo("/doctor-dashboard"));
        Assert.That(BodyText(), Does.Contain("Welcome back, Dr. Lakmal").And.Contain("Your schedule and patient queue for today.").And.Contain("All consultation times are in Sri Lanka time."));
        foreach (var title in new[] { "Today's Appointments", "Upcoming Appointments", "Patient Count", "Completed Appointments" })
        { _wait.Until(d => StatValue(title) != "" && StatValue(title) != "Unavailable"); Assert.That(StatValue(title), Does.Match("^[0-9]+$"), title); }
        foreach (var label in new[] { "Today's appointments", "Upcoming appointments", "Completed appointments" }) Assert.That(Section(label).Displayed, Is.True, label);
        Assert.That(Cards("Today's appointments").Count + Cards("Upcoming appointments").Count + Cards("Completed appointments").Count, Is.GreaterThan(0));
        Assert.That(BodyText(), Does.Contain("Professional Profile"));
        Assert.That(_driver.FindElements(By.CssSelector("[role=alert]")), Is.Empty, "no error on a successful load");
        Assert.That(Sidebar("Dashboard").Displayed && Sidebar("Appointments").Displayed, Is.True);
        Assert.That(BodyText(), Does.Not.Contain("Loading appointments..."), "loading finished");
        Shot("loaded");
        var call = Sent(r => r.Method == "GET" && r.Path == ListPath).First();
        Assert.That(call.Authorization, Does.StartWith("Bearer ")); Assert.That(call.Subject, Is.EqualTo(Doctor1)); Assert.That(call.Role, Is.EqualTo("Doctor")); Assert.That(call.Status, Is.EqualTo(200));
    }

    // =============================================================================================================
    // GCN52-D02  Totals
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN52-D02"), Description("MOCKED API. The four cards show the statistics computed from the data (2 today, 7 upcoming, 6 completed, 13 distinct patients), each card links to its schedule view, the 'Showing N of M' lines agree with the cards, and after the server gains an appointment the Refresh appointments button updates the totals (one extra request) without leaving the page.")]
    public async Task GCN52_D02_DashboardShowsCorrectAppointmentTotalsAndRefreshUpdatesThem()
    {
        await Start();
        SignIn(); OpenDashboard();
        WaitStat("Today's Appointments", "2"); WaitStat("Upcoming Appointments", "7"); WaitStat("Completed Appointments", "6");
        var patients = _all.Select(a => a.Patient).Distinct().Count();
        Assert.That(patients, Is.EqualTo(13), "the synthetic data has 13 distinct patients (patients 1 and 9 have two appointments each)");
        WaitStat("Patient Count", "13");
        Assert.That(new Uri(StatCard("Today's Appointments").GetAttribute("href")!).PathAndQuery, Is.EqualTo("/doctor/appointments?view=today"));
        Assert.That(new Uri(StatCard("Upcoming Appointments").GetAttribute("href")!).PathAndQuery, Is.EqualTo("/doctor/appointments?view=upcoming"));
        Assert.That(new Uri(StatCard("Completed Appointments").GetAttribute("href")!).PathAndQuery, Is.EqualTo("/doctor/appointments?view=completed"));
        Assert.That(new Uri(StatCard("Patient Count").GetAttribute("href")!).PathAndQuery, Is.EqualTo("/doctor/appointments"));
        Assert.That(SectionText("Today's appointments"), Does.Contain("Showing 2 of 2 appointments"));
        Assert.That(SectionText("Upcoming appointments"), Does.Contain("Showing 5 of 7 appointments"));
        Assert.That(SectionText("Completed appointments"), Does.Contain("Showing 5 of 6 appointments"));
        Shot("totals");

        // the server gains an upcoming appointment: the dashboard does not know until it is refreshed
        lock (_lock) _all.Add(A(316, 14, "Kavindu Peiris", "2031-03-21T05:30:00Z", "Booked", "Cash", "Pending", upcoming: true, allowed: "Confirmed"));
        Assert.That(StatValue("Upcoming Appointments"), Is.EqualTo("7"), "no silent update before the refresh");
        var loads = ListLoads();
        Click(RefreshButton());
        WaitStat("Upcoming Appointments", "8"); WaitStat("Patient Count", (patients + 1).ToString());
        _wait.Until(d => SectionText("Upcoming appointments").Contains("Showing 5 of 8 appointments"));
        Assert.That(ListLoads(), Is.EqualTo(loads + 1), "one request per refresh");
        Assert.That(PathNow(), Is.EqualTo("/doctor-dashboard"));
        Assert.That(StatValue("Today's Appointments"), Is.EqualTo("2")); Assert.That(StatValue("Completed Appointments"), Is.EqualTo("6"));
        Shot("refreshed");
    }

    // =============================================================================================================
    // GCN52-D03  Upcoming previews
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN52-D03"), Description("MOCKED API. The Upcoming section previews exactly the first five of seven upcoming appointments in start order, each card showing reference, status, patient, phone, Sri Lanka date and time and payment information; the 6th and 7th are not shown; the link opens the schedule's Upcoming tab with all seven.")]
    public async Task GCN52_D03_UpcomingAppointmentPreviewsDisplayCorrectly()
    {
        await Start();
        SignIn(); OpenDashboard();
        _wait.Until(d => CardRefs("Upcoming appointments").Count == 5);
        Assert.That(CardRefs("Upcoming appointments"), Is.EqualTo(new[] { "CN-APT-DASH-303", "CN-APT-DASH-304", "CN-APT-DASH-305", "CN-APT-DASH-306", "CN-APT-DASH-307" }), "first five by start time");
        Assert.That(SectionText("Upcoming appointments"), Does.Not.Contain("CN-APT-DASH-308").And.Not.Contain("CN-APT-DASH-309").And.Not.Contain("Janaka Weerasinghe"), "the preview is bounded");
        var c303 = Cards("Upcoming appointments")[0];
        Assert.That(Chip(c303), Is.EqualTo("Booked")); Assert.That(Field(c303, "Patient"), Is.EqualTo("Dilani Silva")); Assert.That(Field(c303, "Phone number"), Is.EqualTo("0771200303"));
        Assert.That(Field(c303, "Appointment date"), Is.EqualTo("March 14, 2031")); AssertTime(Field(c303, "Appointment time"), "11:00", "11:30");
        Assert.That(Field(c303, "Payment method"), Is.EqualTo("Cash")); Assert.That(Field(c303, "Payment status"), Is.EqualTo("Pending"));
        var c304 = Cards("Upcoming appointments")[1];
        Assert.That(Chip(c304), Is.EqualTo("Confirmed")); Assert.That(Field(c304, "Payment method"), Is.EqualTo("Bank transfer")); Assert.That(Field(c304, "Payment status"), Is.EqualTo("Receipt under verification"));
        Assert.That(Field(c304, "Patient"), Is.EqualTo("Nimali Perera"));
        var c305 = Cards("Upcoming appointments")[2];
        Assert.That(Field(c305, "Payment method"), Is.EqualTo("Not selected")); Assert.That(Field(c305, "Payment status"), Is.EqualTo("Not paid"), "an appointment without payment is described, not blank");
        Assert.That(Field(Cards("Upcoming appointments")[3], "Payment method"), Is.EqualTo("Online payment"));
        Shot("upcoming-preview");
        Click(DashLink("View all upcoming appointments"));
        WaitPath("/doctor/appointments", "?view=upcoming");
        _wait.Until(d => SelectedTab() == "Upcoming (7)");
        _wait.Until(d => _driver.FindElements(By.CssSelector("section[role=tabpanel] a.appointment-reference")).Count == 7);
    }

    // =============================================================================================================
    // GCN52-D04  Today's appointments
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN52-D04"), Description("MOCKED API. Today's section lists only today's two appointments in time order with status, patient, date, Sri Lanka time and payment details, none of the upcoming or completed ones, and its link opens the schedule's Today tab with the same two.")]
    public async Task GCN52_D04_TodaysAppointmentSectionDisplaysCorrectly()
    {
        await Start();
        SignIn(); OpenDashboard();
        _wait.Until(d => CardRefs("Today's appointments").Count == 2);
        Assert.That(CardRefs("Today's appointments"), Is.EqualTo(new[] { "CN-APT-DASH-302", "CN-APT-DASH-301" }), "time order: 7:30 before 9:00");
        var text = SectionText("Today's appointments");
        Assert.That(text, Does.Contain("Showing 2 of 2 appointments").And.Not.Contain("CN-APT-DASH-303").And.Not.Contain("CN-APT-DASH-310").And.Not.Contain("No scheduled appointments today."));
        var first = Cards("Today's appointments")[0]; var second = Cards("Today's appointments")[1];
        Assert.That(Chip(first), Is.EqualTo("Confirmed")); Assert.That(Field(first, "Patient"), Is.EqualTo("Kasun Fernando")); Assert.That(Field(first, "Appointment date"), Is.EqualTo("March 12, 2031"));
        AssertTime(Field(first, "Appointment time"), "7:30", "8:00"); Assert.That(Field(first, "Payment method"), Is.EqualTo("Bank transfer")); Assert.That(Field(first, "Payment status"), Is.EqualTo("Successful"));
        Assert.That(Chip(second), Is.EqualTo("Booked")); Assert.That(Field(second, "Patient"), Is.EqualTo("Nimali Perera")); AssertTime(Field(second, "Appointment time"), "8:30", "9:00");
        Assert.That(Field(second, "Payment status"), Is.EqualTo("Pending"));
        Shot("today");
        Click(DashLink("View today's appointments"));
        WaitPath("/doctor/appointments", "?view=today");
        _wait.Until(d => SelectedTab() == "Today (2)");
        Assert.That(_driver.FindElements(By.CssSelector("section[role=tabpanel] a.appointment-reference")).Select(a => a.Text), Is.EqualTo(new[] { "CN-APT-DASH-302", "CN-APT-DASH-301" }));
    }

    // =============================================================================================================
    // GCN52-D05  Details and schedule navigation
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN52-D05"), Description("MOCKED API. A reference link on a dashboard card opens that appointment's details page with the right patient and payment information and a link back to the schedule; the statistic cards open the schedule on the matching view and count (Upcoming 7, Completed 6, all patients).")]
    public async Task GCN52_D05_AppointmentDetailsAndScheduleNavigationWork()
    {
        await Start();
        SignIn(); OpenDashboard();
        _wait.Until(d => CardRefs("Today's appointments").Count == 2);
        Click(Section("Today's appointments").FindElement(By.LinkText("CN-APT-DASH-301")));
        WaitPath("/doctor/appointments/301");
        _wait.Until(d => d.FindElements(By.XPath("//h1[normalize-space()='Appointment CN-APT-DASH-301']")).Any());
        var summary = _wait.Until(d => d.FindElements(By.CssSelector("section.order-details-summary")).FirstOrDefault(e => e.Displayed)!);
        Assert.That(Field(summary, "Patient"), Is.EqualTo("Nimali Perera")); Assert.That(Field(summary, "Phone number"), Is.EqualTo("0771200301")); Assert.That(Field(summary, "Appointment date"), Is.EqualTo("March 12, 2031"));
        Assert.That(Field(summary, "Payment method"), Is.EqualTo("Cash")); Assert.That(Chip(summary), Is.EqualTo("Booked"));
        Assert.That(summary.FindElements(By.CssSelector("button.doctor-status-action")).Select(b => b.Text), Is.EqualTo(new[] { "Mark Confirmed" }));
        Shot("details");
        Click(_driver.FindElement(By.PartialLinkText("My appointment schedule")));
        WaitPath("/doctor/appointments"); _wait.Until(d => d.FindElements(By.XPath("//h1[normalize-space()='My appointment schedule']")).Any());

        Go("/doctor-dashboard"); WaitStat("Upcoming Appointments", "7");
        Click(StatCard("Upcoming Appointments")); WaitPath("/doctor/appointments", "?view=upcoming"); _wait.Until(d => SelectedTab() == "Upcoming (7)");
        Go("/doctor-dashboard"); WaitStat("Completed Appointments", "6");
        Click(StatCard("Completed Appointments")); WaitPath("/doctor/appointments", "?view=completed"); _wait.Until(d => SelectedTab() == "Completed (6)");
        Assert.That(_driver.FindElements(By.CssSelector("section[role=tabpanel] a.appointment-reference")).Count, Is.EqualTo(6));
        Go("/doctor-dashboard"); WaitStat("Patient Count", _all.Select(a => a.Patient).Distinct().Count().ToString());
        Click(StatCard("Patient Count")); WaitPath("/doctor/appointments");
        _wait.Until(d => BodyText().Contains($"Total patients: {_all.Select(a => a.Patient).Distinct().Count()}"));
    }

    // =============================================================================================================
    // GCN52-D06  Sidebar
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN52-D06"), Description("MOCKED API. The Doctor sidebar offers Dashboard and Appointments links (Patients is a disabled 'Soon' item and not a link, and no patient or pharmacy links appear); Appointments opens the schedule with the Appointments entry active, Dashboard returns to the dashboard, which reloads its data.")]
    public async Task GCN52_D06_DoctorAppointmentsSidebarNavigationWorks()
    {
        await Start();
        SignIn(); OpenDashboard();
        Assert.That(Sidebar("Dashboard").GetAttribute("class"), Does.Contain("active"), "Dashboard is the active entry");
        Assert.That(new Uri(Sidebar("Appointments").GetAttribute("href")!).AbsolutePath, Is.EqualTo("/doctor/appointments"));
        var patients = Sidebar("Patients"); Assert.That(patients.GetAttribute("class"), Does.Contain("disabled")); Assert.That(patients.TagName.ToLowerInvariant(), Is.Not.EqualTo("a")); Assert.That(patients.Text, Does.Contain("Soon").IgnoreCase, "the item is marked as coming soon (the tag is displayed in capitals)");
        var sideText = _driver.FindElement(By.CssSelector("nav, aside")).Text;
        Assert.That(sideText, Does.Not.Contain("Medicines").And.Not.Contain("Orders").And.Not.Contain("Inventory"), "no patient or pharmacy navigation for a doctor");
        var loads = ListLoads();
        Click(Sidebar("Appointments"));
        WaitPath("/doctor/appointments"); _wait.Until(d => d.FindElements(By.XPath("//h1[normalize-space()='My appointment schedule']")).Any());
        Assert.That(Sidebar("Appointments").GetAttribute("class"), Does.Contain("active")); Assert.That(Sidebar("Dashboard").GetAttribute("class"), Does.Not.Contain("active"));
        _wait.Until(d => SelectedTab() == "Today (2)");
        Shot("schedule");
        Click(Sidebar("Dashboard"));
        WaitPath("/doctor-dashboard"); WaitStat("Upcoming Appointments", "7");
        Assert.That(Sidebar("Dashboard").GetAttribute("class"), Does.Contain("active"));
        Assert.That(ListLoads(), Is.GreaterThan(loads), "the dashboard reloads its data when it is opened again");
        Assert.That(Cards("Today's appointments").Count, Is.EqualTo(2));
    }

    // =============================================================================================================
    // GCN52-D07  Empty sections
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN52-D07"), Description("MOCKED API. A doctor with no appointments sees zeros (not 'Unavailable'), all three section headings and their own empty messages, no cards and no 'Showing' lines; with only completed appointments the Today and Upcoming sections still show their messages while Completed shows its card.")]
    public async Task GCN52_D07_EmptyAppointmentSectionsDisplayAppropriateMessages()
    {
        await Start(new List<Appt>());
        SignIn(); OpenDashboard();
        foreach (var title in new[] { "Today's Appointments", "Upcoming Appointments", "Patient Count", "Completed Appointments" }) WaitStat(title, "0");
        _wait.Until(d => EmptyMessages.All(m => BodyText().Contains(m)));
        Assert.That(SectionText("Today's appointments"), Does.Contain("No scheduled appointments today."));
        Assert.That(SectionText("Upcoming appointments"), Does.Contain("No upcoming appointments."));
        Assert.That(SectionText("Completed appointments"), Does.Contain("No completed appointments yet."));
        Assert.That(_driver.FindElements(By.CssSelector("article.order-card")), Is.Empty);
        Assert.That(BodyText(), Does.Not.Contain("Showing ").And.Not.Contain("Unavailable"));
        Assert.That(_driver.FindElements(By.CssSelector("[role=alert]")), Is.Empty, "an empty schedule is not an error");
        Shot("all-empty");

        // only one appointment, completed: the other two sections stay empty with their own messages
        lock (_lock) _all = new List<Appt> { A(315, 13, "Eranga Ratnayake", "2031-03-06T04:00:00Z", "Completed", "Cash", "Successful", completed: true) };
        Click(RefreshButton());
        WaitStat("Completed Appointments", "1"); WaitStat("Patient Count", "1");
        _wait.Until(d => CardRefs("Completed appointments").SequenceEqual(new[] { "CN-APT-DASH-315" }));
        Assert.That(SectionText("Completed appointments"), Does.Contain("Showing 1 of 1 appointments").And.Not.Contain("No completed appointments yet."));
        Assert.That(SectionText("Today's appointments"), Does.Contain("No scheduled appointments today."));
        Assert.That(SectionText("Upcoming appointments"), Does.Contain("No upcoming appointments."));
        Shot("only-completed");
    }

    // =============================================================================================================
    // GCN52-D08  Failed responses
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN52-D08"), Description("MOCKED API. When the appointment API fails the dashboard shows the matching message (500: could not load; 403: no access; 401: please sign in; 200 with invalid data: could not load) with a Retry button, the cards show 'Unavailable' instead of zeros, and it does NOT display the empty-state messages or any appointment as if the doctor had none.")]
    public async Task GCN52_D08_DashboardHandlesFailedApiResponses()
    {
        await Start();
        SignIn();
        var cases = new (string Name, int Status, bool Malformed, string Message)[]
        {
            ("server error 500", 500, false, "Could not load appointment information. Please try again."),
            ("forbidden 403", 403, false, "You do not have access to these appointments."),
            ("unauthorised 401", 401, false, "Please sign in to view your appointments."),
            ("invalid data", 0, true, "Could not load appointment information. Please try again."),
        };
        foreach (var c in cases)
        {
            _failStatus = c.Status; _malformed = c.Malformed;
            Go("/doctor-dashboard");
            _wait.Until(d => d.FindElements(By.CssSelector("[role=alert]")).Any(a => a.Text.Contains(c.Message)));
            Assert.That(Alert().Text, Does.Contain(c.Message).And.Contain("Retry"), c.Name);
            foreach (var title in new[] { "Today's Appointments", "Upcoming Appointments", "Patient Count", "Completed Appointments" }) Assert.That(StatValue(title), Is.EqualTo("Unavailable"), $"{c.Name}: {title} is unavailable, not zero");
            Assert.That(EmptyMessages.Any(BodyText().Contains), Is.False, $"{c.Name}: an error must not be shown as 'no appointments'");
            Assert.That(_driver.FindElements(By.CssSelector("article.order-card")), Is.Empty, c.Name);
            Assert.That(_driver.FindElements(By.CssSelector("section.doctor-dashboard-preview")), Is.Empty, $"{c.Name}: no section is rendered without data");
            Assert.That(_driver.FindElement(By.XPath("//button[normalize-space()='Retry']")).Displayed, Is.True);
            Shot(c.Name.Replace(' ', '-'));
        }
    }

    // =============================================================================================================
    // GCN52-D09  Retry
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN52-D09"), Description("MOCKED API. After a failed load a Retry that still fails keeps the error (one request per click); once the server recovers Retry loads the real totals and sections and removes the error; a later failure on Refresh keeps the last good data visible with 'Showing the last loaded information.' and a second Retry recovers.")]
    public async Task GCN52_D09_RetryRecoversFromAFailedDashboardLoad()
    {
        await Start();
        SignIn();
        _failStatus = 500;
        OpenDashboardAllowingError();
        _wait.Until(d => Alert().Text.Contains("Could not load appointment information. Please try again."));
        var loads = ListLoads();
        Click(_driver.FindElement(By.XPath("//button[normalize-space()='Retry']")));          // still failing
        _wait.Until(d => ListLoads() == loads + 1);
        Assert.That(Alert().Text, Does.Contain("Could not load appointment information")); Assert.That(StatValue("Upcoming Appointments"), Is.EqualTo("Unavailable"));
        Shot("still-failing");

        _failStatus = 0;                                                                         // the server recovers
        Click(_driver.FindElement(By.XPath("//button[normalize-space()='Retry']")));
        WaitStat("Upcoming Appointments", "7"); WaitStat("Today's Appointments", "2"); WaitStat("Completed Appointments", "6");
        _wait.Until(d => !d.FindElements(By.CssSelector("[role=alert]")).Any());
        Assert.That(CardRefs("Today's appointments"), Is.EqualTo(new[] { "CN-APT-DASH-302", "CN-APT-DASH-301" }));
        Assert.That(SectionText("Upcoming appointments"), Does.Contain("Showing 5 of 7 appointments"));
        Assert.That(ListLoads(), Is.EqualTo(loads + 2), "one request per Retry click");
        Shot("recovered");

        // a later failure keeps what was loaded, says so, and a Retry recovers again
        _failStatus = 500;
        Click(RefreshButton());
        _wait.Until(d => d.FindElements(By.CssSelector("[role=alert]")).Any(a => a.Text.Contains("Showing the last loaded information.")));
        Assert.That(StatValue("Upcoming Appointments"), Is.EqualTo("7"), "the last good totals stay visible"); Assert.That(CardRefs("Today's appointments").Count, Is.EqualTo(2));
        Assert.That(Alert().Text, Does.Contain("Could not load appointment information"));
        Shot("failed-after-success");
        _failStatus = 0;
        Click(_driver.FindElement(By.XPath("//button[normalize-space()='Retry']")));
        _wait.Until(d => !d.FindElements(By.CssSelector("[role=alert]")).Any());
        WaitStat("Upcoming Appointments", "7");
    }
    private void OpenDashboardAllowingError() { Go("/doctor-dashboard"); _wait.Until(d => PathNow() == "/doctor-dashboard" && d.FindElements(By.CssSelector("[role=alert]")).Any()); }

    // =============================================================================================================
    // GCN52-D10  Refresh after a status change
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN52-D10"), Description("MOCKED API. From the dashboard the doctor opens a started, confirmed appointment and marks it Completed (the request carries the expected status); returning to the dashboard through the sidebar shows Completed 7 instead of 6, 'Showing 5 of 7', the appointment first in the completed preview, and its card in Today's section now shows the Completed status.")]
    public async Task GCN52_D10_DashboardRefreshesAfterAppointmentStatusChange()
    {
        await Start();
        SignIn(); OpenDashboard();
        WaitStat("Completed Appointments", "6");
        Assert.That(Chip(Cards("Today's appointments")[0]), Is.EqualTo("Confirmed")); Assert.That(CardRefs("Completed appointments")[0], Is.EqualTo("CN-APT-DASH-315"));
        Click(Section("Today's appointments").FindElement(By.LinkText("CN-APT-DASH-302")));
        WaitPath("/doctor/appointments/302");
        _wait.Until(d => d.FindElements(By.XPath("//h1[normalize-space()='Appointment CN-APT-DASH-302']")).Any());
        var action = _wait.Until(d => d.FindElements(By.CssSelector("button.doctor-status-action")).FirstOrDefault(e => e.Displayed && e.Enabled)!);
        Assert.That(action.Text, Is.EqualTo("Mark Completed"));
        Click(action);
        _wait.Until(d => d.FindElements(By.CssSelector("p[role=status]")).Any(p => p.Text == "Appointment marked Completed."));
        _wait.Until(d => Chip(d.FindElement(By.CssSelector("section.order-details-summary"))) == "Completed");
        var patch = Sent(r => r.Method == "PATCH").Single();
        Assert.That(patch.Path, Is.EqualTo("/api/doctor/appointments/302/status")); Assert.That(patch.Status, Is.EqualTo(200)); Assert.That(patch.Subject, Is.EqualTo(Doctor1));
        var sent = JsonDocument.Parse(patch.Body).RootElement;
        Assert.That(sent.GetProperty("status").GetString(), Is.EqualTo("Completed")); Assert.That(sent.GetProperty("expectedStatus").GetString(), Is.EqualTo("Confirmed"));
        Shot("marked-completed");

        var loads = ListLoads();
        Click(Sidebar("Dashboard"));
        WaitPath("/doctor-dashboard");
        WaitStat("Completed Appointments", "7");
        Assert.That(ListLoads(), Is.GreaterThan(loads), "the dashboard asked the server again");
        _wait.Until(d => SectionText("Completed appointments").Contains("Showing 5 of 7 appointments"));
        Assert.That(CardRefs("Completed appointments")[0], Is.EqualTo("CN-APT-DASH-302"), "the newly completed appointment is the newest completed one");
        Assert.That(CardRefs("Completed appointments"), Does.Not.Contain("CN-APT-DASH-311"), "the preview stays bounded to five: the oldest ones drop out");
        var todays = Cards("Today's appointments"); Assert.That(todays.Count, Is.EqualTo(2));
        Assert.That(Chip(todays[0]), Is.EqualTo("Completed"), "the today card shows the new status"); Assert.That(Chip(todays[1]), Is.EqualTo("Booked"));
        WaitStat("Today's Appointments", "2"); Assert.That(StatValue("Upcoming Appointments"), Is.EqualTo("7"));
        Shot("dashboard-refreshed");
    }
}
