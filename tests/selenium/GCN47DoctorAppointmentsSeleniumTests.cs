using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.SeleniumTests;

/// <summary>
/// GCN-47 Doctor Appointments: exactly five Selenium tests in headless Chrome against the local Vite frontend (http://localhost:3000).
/// Every call to the CareNova API ports (5133-5199) is answered by a deterministic, stateful in-test MOCK (Selenium network interception) that mirrors the
/// contract of the GCN-47 backend (DoctorAppointmentsController / DoctorAppointmentService): [Authorize(Roles = "Doctor")], identity = the token's subject,
/// every read and write filtered by the owning doctor (404 for another doctor's appointment), PATCH status with expectedStatus / expectedUpdatedAtUtc
/// (409 when stale, 400 when the transition is not allowed). No backend, database or user-auth service is contacted.
///
/// WHAT THESE TESTS PROVE: what the browser shows and sends: routes, role guards, tab/view behaviour, the details page, the update flow and its confirmed state,
/// and how the UI behaves when the server refuses or hides data. WHAT THEY CANNOT PROVE: that the REAL server enforces ownership and roles. That is covered by the
/// backend integration tests (DoctorAppointmentsIntegrationTests: ReadsAreOwned..., OtherRolesCannotReadOrWrite, SuccessfulStatusChange...StaleAndForeignWritesAreRejected).
/// Sessions are test-made (unsigned token in localStorage); no real credential exists.
///
///   GCN47-S01 Doctor views assigned appointments and switches schedule views
///   GCN47-S02 Doctor opens an assigned appointment and sees the correct patient and appointment details
///   GCN47-S03 Doctor updates an appointment status and sees the confirmed, persisted state
///   GCN47-S04 Unauthenticated users and non-Doctor roles cannot reach Doctor Appointments or Doctor-only actions
///   GCN47-S05 A Doctor cannot view or modify another Doctor's appointments (with a built-in negative control)
/// </summary>
[TestFixture]
[NonParallelizable]
[Category("GCN47")]
public class GCN47DoctorAppointmentsSeleniumTests
{
    private static readonly string BaseUrl = Environment.GetEnvironmentVariable("CARENOVA_BASE_URL") ?? "http://localhost:3000";
    private static readonly string Root = Environment.GetEnvironmentVariable("GCN47_REPORT_DIR")
        ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "carenova", "qa-reports", "GCN-47", "selenium");
    private static readonly string ShotDir = Path.Combine(Root, "screenshots");

    private const string D1 = "d1d10000-0000-4000-8000-000000000001";   // the signed-in doctor
    private const string D2 = "d2d20000-0000-4000-8000-000000000002";   // another doctor
    private const string D3 = "d3d30000-0000-4000-8000-000000000003";   // a doctor with no appointments
    private const string P1 = "11111111-1111-1111-1111-111111111111";   // a patient (non-doctor role tests)

    private IWebDriver _driver = null!;
    private WebDriverWait _wait = null!;
    private INetwork? _network;
    private readonly object _lock = new();
    private readonly List<Req> _requests = new();
    private List<Appt> _all = new();
    private int _forceReadStatus;           // 0 = normal; otherwise every doctor GET answers this status
    private int _forcePatchStatus;          // 0 = normal; otherwise every PATCH answers this status
    private bool _leakOwnership;            // NEGATIVE CONTROL ONLY: removes the owner filter, simulating a broken server
    private int _stamp;
    private int _shots;

    private sealed record Req(string Method, int Port, string Path, string Authorization, string Subject, string Role, string Body, int Status);
    private sealed class Appt
    {
        public int Id; public string Ref = ""; public string Owner = ""; public string PatientId = ""; public string? Patient; public string? Phone;
        public string Start = "", End = "", Status = "Booked"; public string? UpdatedAt; public string? Method, PayStatus;
        public bool Today, UpcomingBase, HistoryBase, CanComplete, CanNoShow, ContactsMissing;
        public bool IsCompleted => Status == "Completed";
        public bool IsUpcoming => UpcomingBase && Status is "Booked" or "Confirmed";
        public bool IsHistory => Status is "NoShow" or "Cancelled" || (!IsCompleted && HistoryBase);
        public List<string> Allowed()
        {   // DoctorAppointmentService.AllowedStatuses: Booked -> Confirmed; Completed once started; NoShow once ended
            var list = new List<string>(); if (Status is not ("Booked" or "Confirmed")) return list;
            if (Status == "Booked") list.Add("Confirmed"); if (CanComplete) list.Add("Completed"); if (CanNoShow) list.Add("NoShow"); return list;
        }
    }

    private static Appt A(int id, string owner, string patientId, string patient, string phone, string start, string end, string status, string? method, string? pay,
                          bool today = false, bool upcoming = false, bool history = false, bool complete = false, bool noShow = false) =>
        new() { Id = id, Ref = $"CN-APT-DOC-{id}", Owner = owner, PatientId = patientId, Patient = patient, Phone = phone, Start = start, End = end, Status = status, Method = method, PayStatus = pay,
                Today = today, UpcomingBase = upcoming, HistoryBase = history, CanComplete = complete, CanNoShow = noShow };
    private static string Pid(int n) => $"7a7a0000-0000-4000-8000-{n:000000000000}";

    /// <summary>Synthetic data. Times are Sri Lanka = UTC + 5:30. Doctor 1 owns 301-309, doctor 2 owns 401-402; no real person or number.</summary>
    private static List<Appt> Data() => new()
    {
        A(308, D1, Pid(8), "Chamari Wickrama",       "0771234508", "2031-02-10T05:00:00Z", "2031-02-10T05:30:00Z", "Booked",    "Cash",           "Pending",                  history: true, complete: true, noShow: true),
        A(306, D1, Pid(6), "Tharindu Bandara",       "0771234506", "2031-02-21T03:00:00Z", "2031-02-21T03:30:00Z", "NoShow",    null,             null,                       history: true),
        A(305, D1, Pid(5), "Ruwan Jayasuriya",       "0771234505", "2031-03-02T04:30:00Z", "2031-03-02T05:00:00Z", "Completed", "Cash",           "Successful"),
        A(307, D1, Pid(7), "Sanduni Rathnayake",     "0771234507", "2031-03-04T06:00:00Z", "2031-03-04T06:30:00Z", "Cancelled", "BankTransfer",   "AwaitingBankTransferReceipt", history: true),
        A(309, D1, Pid(9), "Ishara Gunawardena",     "0771234509", "2031-03-09T08:00:00Z", "2031-03-09T08:30:00Z", "Completed", "PaymentGateway", "Successful"),
        A(302, D1, Pid(2), "Kasun Fernando",         "0771234502", "2031-03-12T02:00:00Z", "2031-03-12T02:30:00Z", "Confirmed", "BankTransfer",   "ReceiptUnderVerification", today: true, complete: true),
        A(301, D1, Pid(1), "Nimali Perera",          "0771234501", "2031-03-12T04:00:00Z", "2031-03-12T04:30:00Z", "Booked",    "Cash",           "Pending",                  today: true),
        A(303, D1, Pid(3), "Dilani Silva",           "0771234503", "2031-03-14T05:30:00Z", "2031-03-14T06:00:00Z", "Booked",    "PaymentGateway", "Successful",               upcoming: true),
        A(304, D1, Pid(1), "Nimali Perera",          "0771234501", "2031-03-20T09:00:00Z", "2031-03-20T09:30:00Z", "Confirmed", null,             null,                       upcoming: true),
        A(401, D2, Pid(41), "Private Patientofdoctortwo", "0779999401", "2031-03-12T05:00:00Z", "2031-03-12T05:30:00Z", "Booked",    "Cash", "Pending", today: true),
        A(402, D2, Pid(42), "Hidden Otherpatient",        "0779999402", "2031-03-15T05:00:00Z", "2031-03-15T05:30:00Z", "Confirmed", "Cash", "Pending", upcoming: true),
    };

    // ------------------------------------------------------------------------------------------------ lifecycle
    private async Task Start()
    {
        _shots = 0; _forceReadStatus = 0; _forcePatchStatus = 0; _leakOwnership = false; _stamp = 0; _all = Data();
        lock (_lock) _requests.Clear();
        var options = new ChromeOptions();
        options.AddArgument("--headless");
        options.AddArgument("--window-size=1400,1000");
        _driver = new ChromeDriver(options);
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

    // ------------------------------------------------------------------------------------------------ mock API (mirrors the GCN-47 backend contract)
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
    private object Dto(Appt a) => new
    {
        id = a.Id, appointmentReference = a.Ref, patientId = a.PatientId, patientName = a.ContactsMissing ? null : a.Patient, patientPhone = a.ContactsMissing ? null : a.Phone,
        appointmentStartUtc = a.Start, appointmentEndUtc = a.End, status = a.Status, updatedAtUtc = a.UpdatedAt, paymentMethod = a.Method, paymentStatus = a.PayStatus,
        isToday = a.Today, isUpcoming = a.IsUpcoming, isCompleted = a.IsCompleted, isHistory = a.IsHistory, allowedStatuses = a.Allowed(), contactsUnavailable = a.ContactsMissing,
    };

    private HttpResponseData Supply(HttpRequestData request)
    {
        var uri = new Uri(request.Url!); var path = uri.AbsolutePath.TrimEnd('/'); var method = (request.Method ?? "GET").ToUpperInvariant();
        if (method == "OPTIONS") return Respond(204, "");
        var auth = request.Headers.FirstOrDefault(h => h.Key.Equals("Authorization", StringComparison.OrdinalIgnoreCase)).Value ?? "";
        var (sub, role) = Identity(auth); var body = request.PostData ?? "";
        HttpResponseData Done(int status, string content) { lock (_lock) _requests.Add(new(method, uri.Port, path, auth, sub, role, body, status)); return Respond(status, content); }

        if (uri.Port == 5136 && path.StartsWith("/api/doctor/appointments", StringComparison.OrdinalIgnoreCase))
        {
            if (!auth.StartsWith("Bearer ") || !Guid.TryParse(sub, out var guid) || guid == Guid.Empty) return Done(401, "{}");     // missing token / invalid identity
            if (role != "Doctor") return Done(403, "{}");                                                                          // [Authorize(Roles = "Doctor")]
            lock (_lock)
            {
                if (method == "GET" && _forceReadStatus != 0) return Done(_forceReadStatus, "{}");
                if (method == "PATCH" && _forcePatchStatus != 0) return Done(_forcePatchStatus, "{}");
                bool Mine(Appt a) => _leakOwnership || a.Owner == sub;                                                               // the owner filter of Query(doctorId)
                if (method == "GET" && path.Equals("/api/doctor/appointments", StringComparison.OrdinalIgnoreCase))
                {
                    var mine = _all.Where(Mine).OrderBy(a => a.Start).ThenBy(a => a.Id).ToList();
                    return Done(200, JsonSerializer.Serialize(new
                    {
                        appointments = mine.Select(Dto).ToList(),
                        statistics = new { today = mine.Count(a => a.Today), upcoming = mine.Count(a => a.IsUpcoming), completed = mine.Count(a => a.IsCompleted), patientCount = mine.Select(a => a.PatientId).Distinct().Count() },
                        contactsUnavailable = mine.Any(a => a.ContactsMissing),
                    }));
                }
                var m = Regex.Match(path, "^/api/doctor/appointments/(\\d+)(/status)?$", RegexOptions.IgnoreCase);
                if (!m.Success) return Done(404, "{}");
                var found = _all.FirstOrDefault(a => a.Id == int.Parse(m.Groups[1].Value) && Mine(a));
                if (found is null) return Done(404, "");                                                                               // NotFound(): another doctor's or unknown id
                if (method == "GET" && !m.Groups[2].Success) return Done(200, JsonSerializer.Serialize(Dto(found)));
                if (method == "PATCH" && m.Groups[2].Success)
                {
                    var req = JsonDocument.Parse(body).RootElement; var wanted = req.GetProperty("status").GetString()!;
                    var expectedUpdated = req.TryGetProperty("expectedUpdatedAtUtc", out var eu) && eu.ValueKind == JsonValueKind.String ? eu.GetString() : null;
                    if (found.Status != req.GetProperty("expectedStatus").GetString() || found.UpdatedAt != expectedUpdated) return Done(409, "{\"message\":\"This appointment changed. Refresh it before trying again.\"}");
                    if (!found.Allowed().Contains(wanted)) return Done(400, "{\"message\":\"This status change is not allowed.\"}");
                    found.Status = wanted; found.UpdatedAt = $"2026-10-12T10:00:{++_stamp:00}.1234560Z";
                    return Done(200, JsonSerializer.Serialize(new { id = found.Id, status = found.Status, updatedAtUtc = found.UpdatedAt }));
                }
            }
        }
        return Done(200, "[]");   // layout extras (notifications etc.)
    }

    private List<Req> Sent(Func<Req, bool> filter) { lock (_lock) return _requests.Where(filter).ToList(); }
    private List<Req> DoctorCalls() => Sent(r => r.Path.StartsWith("/api/doctor/appointments"));
    private List<Req> ListCalls() => Sent(r => r.Method == "GET" && r.Path == "/api/doctor/appointments");
    private Appt Find(int id) { lock (_lock) return _all.First(a => a.Id == id); }

    // ------------------------------------------------------------------------------------------------ browser helpers
    private static string B64(string s) => Convert.ToBase64String(Encoding.UTF8.GetBytes(s)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    private void Go(string path) => _driver.Navigate().GoToUrl(BaseUrl + path);
    private T Js<T>(string script, params object[] args) => (T)((IJavaScriptExecutor)_driver).ExecuteScript(script, args)!;
    private string BodyText() => _driver.FindElement(By.TagName("body")).Text;
    private string PathNow() => new Uri(_driver.Url).AbsolutePath;
    private string QueryNow() => new Uri(_driver.Url).Query;
    private void WaitText(string text) => _wait.Until(d => d.FindElement(By.TagName("body")).Text.Contains(text));
    private IWebElement Heading(string text) => _wait.Until(d => d.FindElements(By.XPath($"//h1[normalize-space()='{text}'] | //h2[normalize-space()='{text}']")).FirstOrDefault(e => e.Displayed)!);
    private void Click(IWebElement e) { Js<object?>("arguments[0].scrollIntoView({block:'center'});", e); e.Click(); }

    /// <summary>Signs in with a test-made session (no login call, no password).</summary>
    private void SignIn(string role, string sub = D1, string name = "QA Doctor")
    {
        Go("/login");
        _wait.Until(d => d.FindElements(By.TagName("form")).Any());
        var payload = JsonSerializer.Serialize(new { sub, role, exp = DateTimeOffset.UtcNow.AddHours(2).ToUnixTimeSeconds() });
        var token = $"{B64("{\"alg\":\"none\",\"typ\":\"JWT\"}")}.{B64(payload)}.test";
        var user = JsonSerializer.Serialize(new { userId = sub, email = "qa@example.test", role, fullName = name });
        Js<object?>("localStorage.setItem('carenova_token', arguments[0]); localStorage.setItem('carenova_user', arguments[1]);", token, user);
    }
    private void SignOut() { Go("/login"); Js<object?>("localStorage.clear();"); }

    private void OpenSchedule(string query = "") { Go("/doctor/appointments" + query); Heading("My appointment schedule"); _wait.Until(d => d.FindElements(By.CssSelector("section[role=tabpanel]")).Any()); }
    private IWebElement Tab(string name) => _wait.Until(d => d.FindElements(By.XPath($"//button[@role='tab'][starts-with(normalize-space(),'{name}')]")).FirstOrDefault(e => e.Displayed)!);
    private string SelectedTab() => _driver.FindElements(By.CssSelector("button[role=tab][aria-selected=true]")).Select(t => t.Text).SingleOrDefault() ?? "";
    private List<string> Refs() => _driver.FindElements(By.CssSelector("section[role=tabpanel] a.appointment-reference")).Select(a => a.Text).ToList();
    private IWebElement CardOf(string reference) => _wait.Until(d => d.FindElements(By.CssSelector("article.order-card")).FirstOrDefault(c => c.FindElements(By.CssSelector("a.appointment-reference")).Any(a => a.Text == reference))!);
    private static string Field(ISearchContext scope, string label) => scope.FindElement(By.XPath($".//div[span[normalize-space()='{label}']]/strong")).Text;
    private static void AssertTime(string actual, string start, string end) => Assert.That(actual, Does.Match($"(?i)^{start}\\s?(am|pm)\\s?[–-]\\s?{end}\\s?(am|pm)$"), "appointment time (Sri Lanka time)");
    private void OpenDetails(int id) { Go($"/doctor/appointments/{id}"); }
    private IWebElement DetailsHeading(int id) => Heading($"Appointment CN-APT-DOC-{id}");
    private IWebElement Summary() => _wait.Until(d => d.FindElements(By.CssSelector("section.order-details-summary")).FirstOrDefault(e => e.Displayed)!);
    private List<string> Actions() => _driver.FindElements(By.CssSelector("button.doctor-status-action")).Select(b => b.Text).ToList();
    private string Chip() => Summary().FindElement(By.CssSelector(".appointment-status")).Text;
    private string StatValue(string title) => _driver.FindElements(By.XPath($"//div[contains(@class,'stat-card')][div[normalize-space()=\"{title}\"]]/div[contains(@class,'stat-card-value')]")).FirstOrDefault()?.Text ?? "";   // no wait here: callers wait for the expected value
    private void Shot(string step) => Save($"{TestContext.CurrentContext.Test.Name}-{++_shots:00}-{step}");
    private void Save(string file) { Directory.CreateDirectory(ShotDir); ((ITakesScreenshot)_driver).GetScreenshot().SaveAsFile(Path.Combine(ShotDir, file + ".png")); }

    // =============================================================================================================
    // GCN47-S01  Doctor views assigned appointments and switches schedule views
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN47-S01"), Description("MOCKED API. A signed-in Doctor sees dashboard totals, opens the schedule through the dashboard entry point and the sidebar, sees the Today / Upcoming / Completed / History views with the right counts, order and card details, switches views without reloading the data, deep-links to a view, and sees the empty state when nothing is assigned.")]
    public async Task GCN47_S01_DoctorViewsAssignedAppointmentsAndSwitchesViews()
    {
        await Start();
        SignIn("Doctor");
        Go("/doctor-dashboard");
        _wait.Until(d => StatValue("Today's Appointments") == "2");
        _wait.Until(d => StatValue("Upcoming Appointments") == "2");
        Assert.That(StatValue("Completed Appointments"), Is.EqualTo("2"));
        Assert.That(StatValue("Patient Count"), Is.EqualTo("8"), "eight distinct patients (one patient has two appointments)");
        Assert.That(_driver.FindElements(By.CssSelector("article.order-card a.appointment-reference")).Select(a => a.Text), Is.EqualTo(new[] { "CN-APT-DOC-302", "CN-APT-DOC-301" }), "dashboard shows today's appointments in time order");
        Shot("dashboard");

        // dashboard entry point -> the schedule on the right view
        Click(_wait.Until(d => d.FindElements(By.LinkText("Upcoming appointments")).FirstOrDefault(e => e.Displayed)!));
        _wait.Until(d => PathNow() == "/doctor/appointments" && QueryNow() == "?view=upcoming");
        Heading("My appointment schedule"); _wait.Until(d => d.FindElements(By.CssSelector("section[role=tabpanel]")).Any());
        Assert.That(SelectedTab(), Is.EqualTo("Upcoming (2)"));
        Assert.That(Refs(), Is.EqualTo(new[] { "CN-APT-DOC-303", "CN-APT-DOC-304" }));
        Assert.That(BodyText(), Does.Contain("Total patients: 8").And.Contain("All times are in Sri Lanka time."));
        var loadsAfterOpening = ListCalls().Count;
        Shot("upcoming");

        // the four views: counts, order (completed and history newest first) and card contents
        string[] tabs = { "Today (2)", "Upcoming (2)", "Completed (2)", "History (3)" };
        Assert.That(_driver.FindElements(By.CssSelector("button[role=tab]")).Select(t => t.Text), Is.EqualTo(tabs));
        void Switch(string name, string selected, string query, string[] refs)
        {
            Click(Tab(name)); _wait.Until(d => SelectedTab() == selected);
            _wait.Until(d => Refs().SequenceEqual(refs));
            Assert.That(QueryNow(), Is.EqualTo(query)); Assert.That(_driver.FindElement(By.CssSelector("section[role=tabpanel]")).GetAttribute("aria-labelledby"), Is.EqualTo("doctor-tab-" + query.Substring(6)));
        }
        Switch("Today", "Today (2)", "?view=today", new[] { "CN-APT-DOC-302", "CN-APT-DOC-301" });
        var c302 = CardOf("CN-APT-DOC-302");
        Assert.That(Field(c302, "Patient"), Is.EqualTo("Kasun Fernando")); Assert.That(Field(c302, "Phone number"), Is.EqualTo("0771234502"));
        Assert.That(Field(c302, "Appointment date"), Is.EqualTo("March 12, 2031")); AssertTime(Field(c302, "Appointment time"), "7:30", "8:00");
        Assert.That(Field(c302, "Payment method"), Is.EqualTo("Bank transfer")); Assert.That(Field(c302, "Payment status"), Is.EqualTo("Receipt under verification"));
        Assert.That(c302.FindElement(By.CssSelector(".appointment-status")).Text, Is.EqualTo("Confirmed"));
        var c301 = CardOf("CN-APT-DOC-301"); AssertTime(Field(c301, "Appointment time"), "9:30", "10:00"); Assert.That(Field(c301, "Patient"), Is.EqualTo("Nimali Perera"));
        Switch("Completed", "Completed (2)", "?view=completed", new[] { "CN-APT-DOC-309", "CN-APT-DOC-305" });
        Assert.That(Field(CardOf("CN-APT-DOC-309"), "Patient"), Is.EqualTo("Ishara Gunawardena"));
        Assert.That(CardOf("CN-APT-DOC-309").FindElement(By.CssSelector(".appointment-status")).Text, Is.EqualTo("Completed"));
        Switch("History", "History (3)", "?view=history", new[] { "CN-APT-DOC-307", "CN-APT-DOC-306", "CN-APT-DOC-308" });
        Assert.That(CardOf("CN-APT-DOC-307").FindElement(By.CssSelector(".appointment-status")).Text, Is.EqualTo("Cancelled"));
        Assert.That(CardOf("CN-APT-DOC-306").FindElement(By.CssSelector(".appointment-status")).Text, Is.EqualTo("No Show"));
        Assert.That(CardOf("CN-APT-DOC-308").FindElement(By.CssSelector(".appointment-status")).Text, Is.EqualTo("Booked"));
        Shot("history");
        Switch("Upcoming", "Upcoming (2)", "?view=upcoming", new[] { "CN-APT-DOC-303", "CN-APT-DOC-304" });
        Assert.That(ListCalls().Count, Is.EqualTo(loadsAfterOpening), "switching views is client-side: it must not reload the appointments");
        Assert.That(_driver.FindElements(By.XPath("//*[contains(.,'CN-APT-DOC-401') or contains(.,'Private Patientofdoctortwo')]")), Is.Empty, "no appointment of another doctor appears in any view");
        var call = ListCalls().First(); Assert.That(call.Authorization, Does.StartWith("Bearer ")); Assert.That(call.Subject, Is.EqualTo(D1)); Assert.That(call.Role, Is.EqualTo("Doctor"));

        // deep links and the sidebar
        OpenSchedule("?view=history"); Assert.That(SelectedTab(), Is.EqualTo("History (3)"), "the view is kept in the URL");
        OpenSchedule("?view=bogus"); Assert.That(SelectedTab(), Is.EqualTo("Today (2)"), "an unknown view falls back to Today");
        Go("/doctor-dashboard"); Click(_wait.Until(d => d.FindElements(By.XPath("//a[@href='/doctor/appointments'][normalize-space()='Appointments']")).FirstOrDefault(e => e.Displayed)!));
        _wait.Until(d => PathNow() == "/doctor/appointments"); Heading("My appointment schedule"); Assert.That(SelectedTab(), Is.EqualTo("Today (2)"));

        // a doctor with nothing assigned: empty state, not an error
        SignIn("Doctor", D3, "QA Empty"); OpenSchedule();
        Assert.That(BodyText(), Does.Contain("No scheduled appointments").And.Contain("Your assigned consultations will appear here.").And.Contain("Total patients: 0"));
        Assert.That(_driver.FindElements(By.CssSelector("[role=alert]")), Is.Empty); Assert.That(_driver.FindElements(By.CssSelector("article.order-card")), Is.Empty);
        Shot("empty");
    }

    // =============================================================================================================
    // GCN47-S02  Doctor opens an assigned appointment and sees the correct patient and appointment details
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN47-S02"), Description("MOCKED API. Clicking a reference opens /doctor/appointments/{id} with the patient name and phone, Sri Lanka date and time, payment labels, status and only the actions the API allows; the back link returns to the list; deep links work; a No Show appointment has no actions; missing patient contacts show the documented fallback and warning.")]
    public async Task GCN47_S02_DoctorOpensAppointmentAndSeesCorrectDetails()
    {
        await Start();
        SignIn("Doctor");
        OpenSchedule();
        Click(_wait.Until(d => d.FindElements(By.CssSelector("a.appointment-reference")).FirstOrDefault(a => a.Text == "CN-APT-DOC-301")!));
        _wait.Until(d => PathNow() == "/doctor/appointments/301");
        DetailsHeading(301);
        Assert.That(BodyText(), Does.Contain("CONSULTATION DETAILS · SRI LANKA TIME"));
        var s = Summary();
        Assert.That(Chip(), Is.EqualTo("Booked"));
        Assert.That(Field(s, "Patient"), Is.EqualTo("Nimali Perera")); Assert.That(Field(s, "Phone number"), Is.EqualTo("0771234501"));
        Assert.That(Field(s, "Appointment date"), Is.EqualTo("March 12, 2031")); AssertTime(Field(s, "Appointment time"), "9:30", "10:00");
        Assert.That(Field(s, "Payment method"), Is.EqualTo("Cash")); Assert.That(Field(s, "Payment status"), Is.EqualTo("Pending"));
        Assert.That(Actions(), Is.EqualTo(new[] { "Mark Confirmed" }), "a Booked appointment that has not started can only be confirmed");
        Assert.That(_driver.FindElements(By.CssSelector("[role=alert]")), Is.Empty);
        var call = DoctorCalls().Last(r => r.Path == "/api/doctor/appointments/301" && r.Method == "GET");
        Assert.That(call.Authorization, Does.StartWith("Bearer ")); Assert.That(call.Subject, Is.EqualTo(D1));
        Shot("details-301");

        Click(_driver.FindElement(By.LinkText("My appointment schedule")));
        _wait.Until(d => PathNow() == "/doctor/appointments"); Heading("My appointment schedule");

        // another of the doctor's own appointments, by direct link: a different patient and a different set of actions
        OpenDetails(308); DetailsHeading(308); s = Summary();
        Assert.That(Chip(), Is.EqualTo("Booked")); Assert.That(Field(s, "Patient"), Is.EqualTo("Chamari Wickrama")); Assert.That(Field(s, "Phone number"), Is.EqualTo("0771234508"));
        Assert.That(Field(s, "Appointment date"), Is.EqualTo("February 10, 2031")); AssertTime(Field(s, "Appointment time"), "10:30", "11:00");
        Assert.That(Actions(), Is.EqualTo(new[] { "Mark Confirmed", "Mark Completed", "Mark No Show" }), "an ended Booked appointment offers all three transitions");
        Assert.That(BodyText(), Does.Not.Contain("Nimali Perera"), "no patient data of the previously opened appointment remains");

        OpenDetails(306); DetailsHeading(306); s = Summary();
        Assert.That(Chip(), Is.EqualTo("No Show")); Assert.That(Field(s, "Patient"), Is.EqualTo("Tharindu Bandara")); Assert.That(Field(s, "Payment method"), Is.EqualTo("Not selected")); Assert.That(Field(s, "Payment status"), Is.EqualTo("Not paid"));
        Assert.That(Actions(), Is.Empty); Assert.That(BodyText(), Does.Contain("No status changes are available for this appointment."));

        OpenDetails(305); DetailsHeading(305);
        Assert.That(Chip(), Is.EqualTo("Completed")); Assert.That(Field(Summary(), "Payment method"), Is.EqualTo("Cash")); Assert.That(Field(Summary(), "Payment status"), Is.EqualTo("Successful")); Assert.That(Actions(), Is.Empty);
        Shot("details-305");

        // patient contacts temporarily unavailable: documented fallback texts and the warning, other appointments unaffected
        lock (_lock) { Find(303).ContactsMissing = true; }
        OpenSchedule("?view=upcoming");
        _wait.Until(d => BodyText().Contains("Some patient contact information is unavailable. Refresh to try again."));
        var c303 = CardOf("CN-APT-DOC-303"); Assert.That(Field(c303, "Patient"), Is.EqualTo("Patient name unavailable")); Assert.That(Field(c303, "Phone number"), Is.EqualTo("Phone number unavailable"));
        Assert.That(Field(CardOf("CN-APT-DOC-304"), "Patient"), Is.EqualTo("Nimali Perera"), "an appointment whose contacts loaded keeps its data");
        OpenDetails(303); DetailsHeading(303); Assert.That(Field(Summary(), "Patient"), Is.EqualTo("Patient name unavailable"));
        Assert.That(Actions(), Is.EqualTo(new[] { "Mark Confirmed" }), "missing contact data does not remove the available actions");
        Shot("contacts-unavailable");
    }

    // =============================================================================================================
    // GCN47-S03  Doctor updates an appointment status and sees the confirmed, persisted state
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN47-S03"), Description("MOCKED API. Marking a Booked appointment Confirmed and an ongoing Confirmed one Completed sends the expected PATCH (status, expectedStatus, expectedUpdatedAtUtc, token), shows the success message and the state re-read from the server, offers no further action, survives a reload, and moves the appointment into the Completed view and counts.")]
    public async Task GCN47_S03_DoctorUpdatesStatusAndSeesConfirmedState()
    {
        await Start();
        SignIn("Doctor");
        OpenDetails(301); DetailsHeading(301);
        Assert.That(Chip(), Is.EqualTo("Booked")); Assert.That(Actions(), Is.EqualTo(new[] { "Mark Confirmed" }));
        Click(_wait.Until(d => d.FindElements(By.XPath("//button[normalize-space()='Mark Confirmed']")).FirstOrDefault(e => e.Enabled)!));
        _wait.Until(d => d.FindElements(By.CssSelector("p[role=status].doctor-update-success")).Any(e => e.Text == "Appointment marked Confirmed."));
        _wait.Until(d => Chip() == "Confirmed" && Actions().Count == 0);
        Assert.That(BodyText(), Does.Contain("No status changes are available for this appointment."));
        Assert.That(_driver.FindElements(By.CssSelector("[role=alert]")), Is.Empty, "a successful update shows no error");

        var patches = Sent(r => r.Method == "PATCH");
        Assert.That(patches, Has.Count.EqualTo(1), "exactly one update request");
        var patch = patches.Single(); Assert.That(patch.Path, Is.EqualTo("/api/doctor/appointments/301/status")); Assert.That(patch.Status, Is.EqualTo(200));
        Assert.That(patch.Authorization, Does.StartWith("Bearer ")); Assert.That(patch.Subject, Is.EqualTo(D1)); Assert.That(patch.Role, Is.EqualTo("Doctor"));
        var sent = JsonDocument.Parse(patch.Body).RootElement;
        Assert.That(sent.GetProperty("status").GetString(), Is.EqualTo("Confirmed")); Assert.That(sent.GetProperty("expectedStatus").GetString(), Is.EqualTo("Booked"));
        Assert.That(sent.GetProperty("expectedUpdatedAtUtc").ValueKind, Is.EqualTo(JsonValueKind.Null), "the state the doctor saw (never updated) is sent for the stale-write check");
        int patchAt, rereadAt; lock (_lock) { patchAt = _requests.IndexOf(patch); rereadAt = _requests.FindIndex(patchAt + 1, r => r.Method == "GET" && r.Path == "/api/doctor/appointments/301"); }
        Assert.That(rereadAt, Is.GreaterThan(patchAt), "after the update the page re-reads the appointment from the server");
        Assert.That(Find(301).Status, Is.EqualTo("Confirmed"), "the server state changed");
        Shot("confirmed");

        OpenDetails(301); DetailsHeading(301);
        Assert.That(Chip(), Is.EqualTo("Confirmed"), "the new state is the server's, it survives a reload"); Assert.That(Actions(), Is.Empty);
        Assert.That(Sent(r => r.Method == "PATCH"), Has.Count.EqualTo(1), "reloading does not send the update again");

        // an ongoing confirmed appointment is completed and then appears in the Completed view
        OpenDetails(302); DetailsHeading(302);
        Assert.That(Chip(), Is.EqualTo("Confirmed")); Assert.That(Actions(), Is.EqualTo(new[] { "Mark Completed" }));
        Click(_wait.Until(d => d.FindElements(By.XPath("//button[normalize-space()='Mark Completed']")).FirstOrDefault(e => e.Enabled)!));
        _wait.Until(d => d.FindElements(By.CssSelector("p[role=status]")).Any(e => e.Text == "Appointment marked Completed."));
        _wait.Until(d => Chip() == "Completed" && Actions().Count == 0);
        var second = JsonDocument.Parse(Sent(r => r.Method == "PATCH").Last().Body).RootElement;
        Assert.That(second.GetProperty("status").GetString(), Is.EqualTo("Completed")); Assert.That(second.GetProperty("expectedStatus").GetString(), Is.EqualTo("Confirmed"));

        Click(_driver.FindElement(By.LinkText("My appointment schedule")));
        _wait.Until(d => PathNow() == "/doctor/appointments"); Heading("My appointment schedule"); _wait.Until(d => d.FindElements(By.CssSelector("button[role=tab]")).Any());
        _wait.Until(d => Tab("Completed").Text == "Completed (3)");
        Assert.That(Tab("Today").Text, Is.EqualTo("Today (2)"), "a completed appointment of today stays in Today as well");
        Assert.That(CardOf("CN-APT-DOC-302").FindElement(By.CssSelector(".appointment-status")).Text, Is.EqualTo("Completed"));
        Click(Tab("Completed")); _wait.Until(d => Refs().SequenceEqual(new[] { "CN-APT-DOC-302", "CN-APT-DOC-309", "CN-APT-DOC-305" }));
        Shot("completed-view");
    }

    // =============================================================================================================
    // GCN47-S04  Unauthenticated users and non-Doctor roles cannot reach Doctor Appointments or Doctor-only actions
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN47-S04"), Description("MOCKED API. A visitor is sent to login and Patient, PharmacyStaff and Admin sessions to 403 Forbidden for the schedule, a details page and the dashboard, with no Doctor API request and no data; only the Doctor sidebar links to the schedule; and when a Doctor's access is revoked mid-session (401 on read, 403 on update) the UI shows the right message, no appointment data and no actions, and nothing is changed.")]
    public async Task GCN47_S04_UnauthenticatedAndNonDoctorCannotUseDoctorAppointments()
    {
        await Start();
        // 1. visitor
        SignOut(); lock (_lock) _requests.Clear();
        foreach (var p in new[] { "/doctor/appointments", "/doctor/appointments/301", "/doctor/appointments?view=history", "/doctor-dashboard" })
        {
            Go(p); _wait.Until(d => PathNow() == "/login");
            Assert.That(PathNow(), Is.EqualTo("/login"), $"visitor opening {p}"); Assert.That(BodyText(), Does.Not.Contain("CN-APT-DOC-"));
        }
        Assert.That(DoctorCalls(), Is.Empty, "no Doctor API request is made for a visitor"); Shot("visitor");

        // 2. every other role
        foreach (var role in new[] { "Patient", "PharmacyStaff", "Admin" })
        {
            SignIn(role, P1, "QA " + role); lock (_lock) _requests.Clear();
            foreach (var p in new[] { "/doctor/appointments", "/doctor/appointments/301", "/doctor-dashboard" })
            {
                Go(p); _wait.Until(d => PathNow() == "/forbidden");
                Assert.That(BodyText(), Does.Contain("403 Forbidden").And.Contain("You do not have permission to access this page."), $"{role} opening {p}");
                Assert.That(BodyText(), Does.Not.Contain("CN-APT-DOC-").And.Not.Contain("Nimali Perera").And.Not.Contain("0771234501"));
                Assert.That(_driver.FindElements(By.CssSelector("button.doctor-status-action")), Is.Empty, $"{role} must not see a Doctor-only action");
            }
            Assert.That(DoctorCalls(), Is.Empty, $"no Doctor API request is made for the {role} role");
        }
        Shot("forbidden");

        // 3. navigation only offers the schedule to a Doctor
        SignIn("Patient", P1); Go("/patient/appointments"); Heading("My appointments");
        Assert.That(_driver.FindElements(By.CssSelector("a[href='/doctor/appointments']")), Is.Empty, "a Patient's sidebar has no link to the Doctor schedule");
        Assert.That(_driver.FindElements(By.CssSelector("a[href='/patient/appointments']")), Is.Not.Empty);
        SignIn("Doctor", D1); OpenSchedule();
        Assert.That(_driver.FindElements(By.CssSelector("a[href='/doctor/appointments']")), Is.Not.Empty, "a Doctor's sidebar links to the schedule");
        Assert.That(_driver.FindElements(By.CssSelector("a[href='/patient/appointments']")), Is.Empty, "a Doctor's sidebar has no link to the patient appointments");

        // 4. the Doctor's access is revoked while the update page is open: the update is refused, nothing changes, data and actions disappear
        OpenDetails(301); DetailsHeading(301); Assert.That(Actions(), Is.EqualTo(new[] { "Mark Confirmed" }));
        lock (_lock) { _forcePatchStatus = 403; _forceReadStatus = 403; }
        Click(_wait.Until(d => d.FindElements(By.XPath("//button[normalize-space()='Mark Confirmed']")).FirstOrDefault(e => e.Enabled)!));
        _wait.Until(d => BodyText().Contains("You do not have access to these appointments."));
        Assert.That(Sent(r => r.Method == "PATCH").Single().Status, Is.EqualTo(403), "the server refused the update");
        Assert.That(Find(301).Status, Is.EqualTo("Booked"), "the refused update changed nothing");
        Assert.That(BodyText(), Does.Not.Contain("Nimali Perera").And.Not.Contain("0771234501")); Assert.That(Actions(), Is.Empty, "no Doctor-only action remains once access is gone");
        Assert.That(_driver.FindElements(By.CssSelector("p[role=status].doctor-update-success")), Is.Empty, "no success message for a refused update");
        Shot("revoked-on-update");

        // 5. expired session on the list: message, no data
        lock (_lock) { _forcePatchStatus = 0; _forceReadStatus = 401; }
        OpenScheduleExpectingError("Please sign in to view your appointments.");
        Assert.That(_driver.FindElements(By.CssSelector("article.order-card")), Is.Empty); Assert.That(BodyText(), Does.Not.Contain("CN-APT-DOC-"));
        Shot("expired");
    }
    private void OpenScheduleExpectingError(string message) { Go("/doctor/appointments"); WaitText(message); }

    // =============================================================================================================
    // GCN47-S05  A Doctor cannot view or modify another Doctor's appointments
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN47-S05"), Description("MOCKED API (mirrors the owner filter of the real service). Doctor 1 never sees doctor 2's appointments in any view, dashboard total or details URL; a direct link to doctor 2's appointment shows 'Appointment not found.' with none of its data; when an appointment is taken away mid-session, the update is refused and changes nothing; a doctor who signs in next on the same browser sees only their own data. A built-in negative control proves the assertions detect a server that leaks or lets the write through.")]
    public async Task GCN47_S05_DoctorCannotViewOrModifyAnotherDoctorsAppointments()
    {
        await Start();
        SignIn("Doctor", D1);

        // 1. lists and totals contain only doctor 1's data
        OpenSchedule();
        foreach (var (name, _) in new[] { ("Today", 0), ("Upcoming", 0), ("Completed", 0), ("History", 0) }) { Click(Tab(name)); _wait.Until(d => SelectedTab().StartsWith(name)); Assert.That(Refs().Any(r => r is "CN-APT-DOC-401" or "CN-APT-DOC-402"), Is.False, $"{name} view"); }
        AssertNoForeignDoctorData();
        Go("/doctor-dashboard"); _wait.Until(d => StatValue("Upcoming Appointments") == "2");
        _wait.Until(d => StatValue("Today's Appointments") == "2");   // would be 3 if doctor 2's appointment were counted
        Assert.That(StatValue("Today's Appointments"), Is.EqualTo("2"), "doctor 2's today appointment is not counted"); Assert.That(StatValue("Patient Count"), Is.EqualTo("8"));
        AssertNoForeignDoctorData();

        // 2. direct link to doctor 2's appointment: not found, no data, no actions, no retry
        OpenDetails(401); WaitText("Appointment not found.");
        AssertNoForeignDoctorData();
        Assert.That(Actions(), Is.Empty);
        // Observation GCN47-O1 (not asserted): the shared feedback component also offers "Retry" for a missing appointment, unlike GCN-46's patient page. It exposes no data and changes nothing.
        var attempt = DoctorCalls().Last(r => r.Path == "/api/doctor/appointments/401");
        Assert.That(attempt.Subject, Is.EqualTo(D1), "the request was made as doctor 1"); Assert.That(attempt.Status, Is.EqualTo(404), "and the server (mock of the real owner filter) refused it");
        Shot("foreign-details");

        // 3. the appointment is taken away from doctor 1 while the update page is open: the write is refused and changes nothing
        OpenDetails(301); DetailsHeading(301); Assert.That(Actions(), Is.EqualTo(new[] { "Mark Confirmed" }));
        lock (_lock) { Find(301).Owner = D2; }
        Click(_wait.Until(d => d.FindElements(By.XPath("//button[normalize-space()='Mark Confirmed']")).FirstOrDefault(e => e.Enabled)!));
        _wait.Until(d => BodyText().Contains("Appointment not found."));
        var refused = Sent(r => r.Method == "PATCH").Single(); Assert.That(refused.Subject, Is.EqualTo(D1)); Assert.That(refused.Status, Is.EqualTo(404));
        Assert.That(Find(301).Status, Is.EqualTo("Booked"), "doctor 1's attempt did not change the other doctor's appointment"); Assert.That(Find(301).UpdatedAt, Is.Null);
        Assert.That(BodyText(), Does.Not.Contain("Nimali Perera").And.Not.Contain("0771234501")); Assert.That(Actions(), Is.Empty);
        Assert.That(_driver.FindElements(By.CssSelector("p[role=status].doctor-update-success")), Is.Empty);
        Shot("write-refused");
        lock (_lock) { Find(301).Owner = D1; }

        // 4. identity switch on the same browser: doctor 2 sees only their own data and none of doctor 1's
        SignIn("Doctor", D2, "QA Doctor Two"); OpenSchedule();
        Assert.That(Refs(), Is.EqualTo(new[] { "CN-APT-DOC-401" }), "doctor 2's Today view"); Assert.That(Tab("Upcoming").Text, Is.EqualTo("Upcoming (1)"));
        Assert.That(Field(CardOf("CN-APT-DOC-401"), "Patient"), Is.EqualTo("Private Patientofdoctortwo"));
        Assert.That(BodyText(), Does.Not.Contain("Nimali Perera").And.Not.Contain("CN-APT-DOC-301").And.Not.Contain("Kasun Fernando").And.Contain("Total patients: 2"));
        OpenDetails(301); WaitText("Appointment not found."); Assert.That(BodyText(), Does.Not.Contain("Nimali Perera"));

        // 5. NEGATIVE CONTROL: against a server that does not filter by owner, the very same assertions MUST fail (otherwise they would prove nothing)
        SignIn("Doctor", D1); lock (_lock) { _leakOwnership = true; }
        OpenDetails(401); DetailsHeading(401);
        Assert.Throws<AssertionException>(AssertNoForeignDoctorData, "negative control (read): the leak of doctor 2's patient must be detected");
        // ...and a write that the broken server lets through is caught by the state check
        Click(_wait.Until(d => d.FindElements(By.XPath("//button[normalize-space()='Mark Confirmed']")).FirstOrDefault(e => e.Enabled)!));
        _wait.Until(d => Find(401).Status == "Confirmed");
        Assert.Throws<AssertionException>(() => Assert.That(Find(401).Status, Is.EqualTo("Booked"), "another doctor's appointment must be unchanged"), "negative control (write): the modification must be detected");
        lock (_lock) { _leakOwnership = false; }
    }

    /// <summary>Asserts that nothing of doctor 2 (appointment references, patients, phone numbers) is on the page.</summary>
    private void AssertNoForeignDoctorData()
    {
        var text = BodyText();
        foreach (var secret in new[] { "CN-APT-DOC-401", "CN-APT-DOC-402", "Private Patientofdoctortwo", "Hidden Otherpatient", "0779999401", "0779999402" })
            Assert.That(text, Does.Not.Contain(secret), "data of another doctor is visible: " + secret);
    }
}
