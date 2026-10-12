using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.SeleniumTests;

/// <summary>
/// GCN-51 Role Dashboards: exactly five Selenium tests in headless Chrome against the local Vite frontend (http://localhost:3000).
/// Every call to the CareNova API ports (5133-5199) is answered by a deterministic in-test MOCK (Selenium network interception) that mirrors the contract the dashboards consume:
///   patient   GET /api/patient/dashboard/orders | /medicine-payments | /appointments, and /api/public/home
///   staff     GET /api/staff/dashboard/operations | /medicine-payments | /appointment-payments
///   doctor    GET /api/doctor/appointments
/// with the same role rules as the backend ([Authorize] by role: 401 without a valid identity, 403 for another role). No backend, database, payment service or user-auth service is contacted,
/// and no existing account or data is used: the sessions are test-made (unsigned token in localStorage) and all data is synthetic.
///
/// WHAT THESE TESTS PROVE: what the browser shows and does: summaries, section content, navigation shortcuts, route guards (login / forbidden redirects), that a guarded page requests no dashboard data,
/// and how each dashboard section behaves while loading, when it fails and when the user retries.
/// WHAT THEY CANNOT PROVE: that the REAL servers return correct counts or enforce roles and ownership. That is covered by the backend tests (xUnit) and by the frontend unit tests (Vitest).
///
///   GCN51-S01 Patient dashboard: personal summaries, payment and appointment information, shortcuts
///   GCN51-S02 Doctor dashboard: statistics, today's appointments, navigation to the appointment schedule
///   GCN51-S03 Pharmacy staff dashboard: queue summaries, income and bank-transfer information, shortcuts
///   GCN51-S04 Role-based access: unauthenticated and wrong-role users cannot open dashboards or fetch their data
///   GCN51-S05 Dashboard failure and recovery: loading state, isolated section errors, Retry per section
/// </summary>
[TestFixture]
[NonParallelizable]
[Category("GCN51")]
public class GCN51RoleDashboardSeleniumTests
{
    private static readonly string BaseUrl = Environment.GetEnvironmentVariable("CARENOVA_BASE_URL") ?? "http://localhost:3000";
    private static readonly string Root = Environment.GetEnvironmentVariable("GCN51_REPORT_DIR")
        ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "carenova", "qa-reports", "GCN-51", "selenium");
    private static readonly string ShotDir = Path.Combine(Root, "screenshots");

    private const string Patient1 = "51a10000-0000-4000-8000-000000000001";
    private const string Doctor1 = "51d10000-0000-4000-8000-000000000001";
    private const string Staff1 = "51c10000-0000-4000-8000-000000000001";
    private const string Admin1 = "51e10000-0000-4000-8000-000000000001";
    private const string Gen = "2026-10-12T04:00:00Z";

    private const string OrdersPath = "/api/patient/dashboard/orders";
    private const string PatientPaymentsPath = "/api/patient/dashboard/medicine-payments";
    private const string AppointmentsPath = "/api/patient/dashboard/appointments";
    private const string OperationsPath = "/api/staff/dashboard/operations";
    private const string StaffMedicinePath = "/api/staff/dashboard/medicine-payments";
    private const string StaffAppointmentPath = "/api/staff/dashboard/appointment-payments";
    private const string HomePath = "/api/public/home";
    private const string DoctorListPath = "/api/doctor/appointments";

    private IWebDriver _driver = null!;
    private WebDriverWait _wait = null!;
    private INetwork? _network;
    private readonly object _lock = new();
    private readonly List<Req> _requests = new();
    private readonly Dictionary<string, int> _fail = new();        // path -> status every call answers (simulated server failure)
    private readonly HashSet<string> _malformed = new();            // path -> answers 200 with a body the dashboard must reject
    private readonly Dictionary<string, int> _delay = new();        // path -> milliseconds before answering
    private int _shots;

    private sealed record Req(string Method, string Path, string Authorization, string Subject, string Role, int Status);

    // ------------------------------------------------------------------------------------------------ synthetic data
    private static object Order(int id, string status, decimal total) => new { id, reference = $"CN-ORD-QA-{id}", orderDate = "2031-03-10T04:00:00Z", status, totalAmount = total };
    private static object MedicinePayment(int id, int orderId, string method, string status, decimal amount, bool confirmed) =>
        new { id, orderId, reference = $"CN-PAY-QA-{id}", amount, method, status, confirmedAtUtc = confirmed ? "2031-03-10T05:00:00Z" : null, updatedAtUtc = "2031-03-10T05:00:00Z" };
    private static object AppointmentPayment(int id, int appointmentId, string method, string status, decimal amount, bool confirmed) =>
        new { id, appointmentId, reference = $"CN-APTPAY-QA-{id}", amount, method, status, confirmedAtUtc = confirmed ? "2031-03-10T05:00:00Z" : null, updatedAtUtc = "2031-03-10T05:00:00Z" };
    private static object Income(decimal today, decimal month, int undatedCount, decimal undatedAmount) =>
        new { todayAmount = today, monthAmount = month, undatedSuccessfulCount = undatedCount, undatedSuccessfulAmount = undatedAmount, currency = "LKR", timeZone = "Asia/Colombo", asOfUtc = Gen };

    private object? Body(string path) => path switch
    {
        OrdersPath => new { totalCount = 7, recentOrders = new[] { Order(101, "ReadyForCollection", 2500m), Order(102, "Pending", 1800m) }, generatedAtUtc = Gen },
        PatientPaymentsPath => new
        {
            statusCounts = new Dictionary<string, int> { ["Successful"] = 1, ["Pending"] = 1 },
            recentPayments = new[] { MedicinePayment(1, 101, "BankTransfer", "Successful", 2500m, true), MedicinePayment(2, 102, "Cash", "Pending", 1800m, false) },
            generatedAtUtc = Gen,
        },
        AppointmentsPath => new
        {
            upcomingCount = 3,
            appointments = new[]
            {
                new { id = 301, reference = "CN-APT-QA-301", doctorName = "Dr Synthetic Dash", startUtc = "2031-03-12T04:00:00Z", status = "Booked", paymentMethod = (string?)"Cash", paymentStatus = (string?)"Pending" },
                new { id = 302, reference = "CN-APT-QA-302", doctorName = "Dr Synthetic Dash", startUtc = "2031-03-13T04:00:00Z", status = "Confirmed", paymentMethod = (string?)"BankTransfer", paymentStatus = (string?)"ReceiptUnderVerification" },
            },
            paymentStatusCounts = new Dictionary<string, int> { ["Pending"] = 1, ["ReceiptUnderVerification"] = 1 },
            generatedAtUtc = Gen,
        },
        OperationsPath => new
        {
            newOrders = new { totalCount = 4, items = new[] { Order(201, "Pending", 1200m), Order(202, "Pending", 900m) } },
            readyForCollection = new { totalCount = 2, items = new[] { Order(203, "ReadyForCollection", 3000m), Order(204, "ReadyForCollection", 450m) } },
            pendingPrescriptions = new { totalCount = 3, items = new[] { new { id = 1, medicineName = "Amoxicillin QA", quantity = 20, uploadedAtUtc = "2031-03-10T04:00:00Z", status = "Pending" } } },
            lowStock = new { totalCount = 1, items = new[] { new { medicineId = 9, medicineName = "Paracetamol QA", quantity = 3, threshold = 10 } } },
            generatedAtUtc = Gen,
        },
        StaffMedicinePath => new
        {
            pendingTransfers = new { totalCount = 2, items = new[] { MedicinePayment(11, 201, "BankTransfer", "PendingVerification", 1200m, false), MedicinePayment(12, 202, "BankTransfer", "PendingVerification", 900m, false) } },
            recentPayments = new[] { MedicinePayment(13, 203, "BankTransfer", "Successful", 3000m, true) },
            income = Income(1500m, 12000m, 1, 500m), generatedAtUtc = Gen,
        },
        StaffAppointmentPath => new
        {
            pendingTransfers = new { totalCount = 5, items = new[] { AppointmentPayment(21, 301, "BankTransfer", "ReceiptUnderVerification", 2000m, false) } },
            recentPayments = new[] { AppointmentPayment(22, 302, "BankTransfer", "Successful", 2000m, true) },
            income = Income(800m, 5600m, 0, 0m), generatedAtUtc = Gen,
        },
        HomePath => new { introduction = "Synthetic QA pharmacy introduction.", services = new[] { new { title = "QA Service", description = "Synthetic service description." } }, featuredMedicines = Array.Empty<object>(), featuredDoctors = Array.Empty<object>(), notices = Array.Empty<object>(), sectionErrors = Array.Empty<string>() },
        _ => null,
    };

    private sealed record Appt(int Id, string Patient, string Name, string Start, string Status, bool Today, bool Upcoming, bool Completed, bool History);
    private static readonly Appt[] DoctorData =
    {
        new(301, "7a7a0000-0000-4000-8000-000000000001", "Nimali Perera", "2031-03-12T03:00:00Z", "Booked", true, false, false, false),
        new(302, "7a7a0000-0000-4000-8000-000000000002", "Kasun Fernando", "2031-03-12T04:30:00Z", "Confirmed", true, false, false, false),
        new(303, "7a7a0000-0000-4000-8000-000000000001", "Nimali Perera", "2031-03-14T05:30:00Z", "Booked", false, true, false, false),
        new(304, "7a7a0000-0000-4000-8000-000000000003", "Dilani Silva", "2031-03-20T09:00:00Z", "Confirmed", false, true, false, false),
        new(305, "7a7a0000-0000-4000-8000-000000000004", "Ruwan Jayasuriya", "2031-03-02T04:30:00Z", "Completed", false, false, true, false),
        new(306, "7a7a0000-0000-4000-8000-000000000005", "Tharindu Bandara", "2031-02-21T03:00:00Z", "NoShow", false, false, false, true),
    };
    private static object DoctorBody() => new
    {
        appointments = DoctorData.OrderBy(a => a.Start).ThenBy(a => a.Id).Select(a => new
        {
            id = a.Id, appointmentReference = $"CN-APT-DASH-{a.Id}", patientId = a.Patient, patientName = a.Name, patientPhone = $"0771234{a.Id}", appointmentStartUtc = a.Start,
            appointmentEndUtc = DateTime.Parse(a.Start).ToUniversalTime().AddMinutes(30).ToString("yyyy-MM-ddTHH:mm:ssZ"), status = a.Status, updatedAtUtc = (string?)null,
            paymentMethod = (string?)"Cash", paymentStatus = (string?)"Pending", isToday = a.Today, isUpcoming = a.Upcoming, isCompleted = a.Completed, isHistory = a.History,
            allowedStatuses = Array.Empty<string>(), contactsUnavailable = false,
        }).ToList(),
        statistics = new { today = DoctorData.Count(a => a.Today), upcoming = DoctorData.Count(a => a.Upcoming), completed = DoctorData.Count(a => a.Completed), patientCount = DoctorData.Select(a => a.Patient).Distinct().Count() },
        contactsUnavailable = false,
    };

    // ------------------------------------------------------------------------------------------------ lifecycle
    private async Task Start()
    {
        _shots = 0; _fail.Clear(); _malformed.Clear(); _delay.Clear();
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
    private static bool InRole(string role, params string[] allowed) => allowed.Contains(role, StringComparer.OrdinalIgnoreCase);

    private HttpResponseData Supply(HttpRequestData request)
    {
        var uri = new Uri(request.Url!); var path = uri.AbsolutePath.TrimEnd('/'); var method = (request.Method ?? "GET").ToUpperInvariant();
        if (method == "OPTIONS") return Respond(204, "");
        var auth = request.Headers.FirstOrDefault(h => h.Key.Equals("Authorization", StringComparison.OrdinalIgnoreCase)).Value ?? "";
        var (sub, role) = Identity(auth);
        HttpResponseData Done(int status, string content) { lock (_lock) _requests.Add(new(method, path, auth, sub, role, status)); return Respond(status, content); }

        // pharmacy API is mounted under /api (http://localhost:5134/api + /patient/dashboard/orders): normalise to the paths above
        if (path.StartsWith("/api/api/")) path = path.Substring(4);
        var known = path is OrdersPath or PatientPaymentsPath or AppointmentsPath or OperationsPath or StaffMedicinePath or StaffAppointmentPath or HomePath or DoctorListPath;
        if (!known) return Done(200, "[]");   // layout extras (notifications etc.)

        if (_delay.TryGetValue(path, out var wait) && wait > 0) Thread.Sleep(wait);
        if (path != HomePath)
        {
            if (!auth.StartsWith("Bearer ") || !Guid.TryParse(sub, out var g) || g == Guid.Empty) return Done(401, "{}");
            var allowed = path.StartsWith("/api/patient/") ? InRole(role, "Patient", "User") : path.StartsWith("/api/staff/") ? InRole(role, "PharmacyStaff", "Pharmacy Staff") : InRole(role, "Doctor");
            if (!allowed) return Done(403, "");
        }
        if (_fail.TryGetValue(path, out var status) && status != 0) return Done(status, "{\"message\":\"simulated failure\"}");
        if (_malformed.Contains(path)) return Done(200, JsonSerializer.Serialize(new { upcomingCount = -1, appointments = Array.Empty<object>(), paymentStatusCounts = new { }, generatedAtUtc = Gen }));
        return Done(200, JsonSerializer.Serialize(path == DoctorListPath ? DoctorBody() : Body(path)));
    }

    private List<Req> Calls(string path) { lock (_lock) return _requests.Where(r => r.Path == path).ToList(); }
    private int Count(string path) => Calls(path).Count;
    private List<Req> DashboardCalls() { lock (_lock) return _requests.Where(r => r.Path.Contains("/dashboard/") || r.Path == DoctorListPath).ToList(); }

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

    /// <summary>Signs in with a test-made session (no login call, no password). expiredSeconds &gt; 0 makes the token already expired.</summary>
    private void SignIn(string role, string sub, string name, int expiredSeconds = 0)
    {
        Go("/about"); Js<object?>("localStorage.clear();");                       // a signed-in session would redirect /login away: start from no session
        Go("/login");
        _wait.Until(d => d.FindElements(By.TagName("form")).Any());
        var exp = expiredSeconds > 0 ? DateTimeOffset.UtcNow.AddSeconds(-expiredSeconds).ToUnixTimeSeconds() : DateTimeOffset.UtcNow.AddHours(2).ToUnixTimeSeconds();
        var payload = JsonSerializer.Serialize(new { sub, role, exp });
        var token = $"{B64("{\"alg\":\"none\",\"typ\":\"JWT\"}")}.{B64(payload)}.test";
        var user = JsonSerializer.Serialize(new { userId = sub, email = "qa@example.test", role, fullName = name });
        Js<object?>("localStorage.setItem('carenova_token', arguments[0]); localStorage.setItem('carenova_user', arguments[1]);", token, user);
    }
    private void SignOut() { Go("/login"); Js<object?>("localStorage.clear();"); }

    private IWebElement StatCard(string title) => _wait.Until(d => d.FindElements(By.XPath($"//*[contains(@class,'stat-card')][div[contains(@class,'stat-card-title')][normalize-space()=\"{title}\"]]")).FirstOrDefault(e => e.Displayed)!);
    private string StatValue(string title) => _driver.FindElements(By.XPath($"//*[contains(@class,'stat-card')][div[contains(@class,'stat-card-title')][normalize-space()=\"{title}\"]]/div[contains(@class,'stat-card-value')]")).FirstOrDefault()?.Text ?? "";
    private void WaitStat(string title, string value) => _wait.Until(d => StatValue(title) == value);
    private IWebElement Section(string label) => _wait.Until(d => d.FindElements(By.CssSelector($"section[aria-label=\"{label}\"]")).FirstOrDefault(e => e.Displayed)!);
    private string SectionText(string label) => _driver.FindElements(By.CssSelector($"section[aria-label=\"{label}\"]")).FirstOrDefault()?.Text ?? "";
    private void WaitSection(string label, string text) => _wait.Until(d => SectionText(label).Contains(text));
    private static string Href(IWebElement e) => new Uri(e.GetAttribute("href")!).PathAndQuery;
    private void WaitPath(string path, string query = "") => _wait.Until(d => PathNow() == path && QueryNow() == query);
    private void AssertMoney(string text, string amount) => Assert.That(text, Does.Match($"LKR\\s*{Regex.Escape(amount)}"), $"expected LKR {amount} in: {text}");
    private IWebElement QuickLink(string title) => _wait.Until(d => d.FindElements(By.XPath($"//section[@id='dashboard-quick-links']//a[.//*[normalize-space()=\"{title}\"]]")).FirstOrDefault(e => e.Displayed)!);
    private IWebElement ShortcutLink(string text) => _wait.Until(d => d.FindElements(By.XPath($"//a[contains(normalize-space(),\"{text}\")]")).FirstOrDefault(e => e.Displayed)!);

    // =============================================================================================================
    // GCN51-S01  Patient dashboard
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN51-S01"), Description("MOCKED API. A signed-in Patient sees summary cards with the counts from the dashboard APIs, the recent orders with their payment information, the upcoming appointments with payment-status counts and the medicine payment statuses, every card and link points to the right page, and the shortcuts navigate there. Only the patient endpoints are requested, with the patient's identity.")]
    public async Task GCN51_S01_PatientDashboardShowsPersonalSummariesAndShortcuts()
    {
        await Start();
        SignIn("Patient", Patient1, "Synthetic Patient");
        Go("/patient-dashboard");
        WaitStat("Recent Medicine Orders", "7");
        WaitStat("Upcoming Appointments", "3");
        Assert.That(StatValue("Payment Statuses"), Is.EqualTo("See below"));
        Assert.That(BodyText(), Does.Contain("Welcome to CareNova"));
        Shot("summary-cards");

        // recent orders with the payment information of each order
        WaitSection("Recent medicine orders", "Latest 2 of 7 orders");
        var orders = SectionText("Recent medicine orders");
        Assert.That(orders, Does.Contain("CN-ORD-QA-101").And.Contain("Ready for collection").And.Contain("Bank transfer · Successful").And.Contain("CN-ORD-QA-102").And.Contain("Pending").And.Contain("Cash · Pending"));
        AssertMoney(orders, "2,500.00"); AssertMoney(orders, "1,800.00");
        // upcoming appointments with the payment status counts
        WaitSection("Upcoming appointments", "Next 2 of 3 appointments");
        var appts = SectionText("Upcoming appointments");
        Assert.That(appts, Does.Contain("Appointment payment statuses").And.Contain("Pending: 1").And.Contain("Receipt under verification: 1")
            .And.Contain("CN-APT-QA-301").And.Contain("Dr Synthetic Dash").And.Contain("Booked · Cash · Pending").And.Contain("Confirmed · Bank transfer · Receipt under verification").And.Contain("CN-APT-QA-302"));
        // medicine payment statuses
        WaitSection("Medicine payment statuses", "CN-PAY-QA-1");
        var pays = SectionText("Medicine payment statuses");
        Assert.That(pays, Does.Contain("Successful: 1").And.Contain("Pending: 1").And.Contain("CN-PAY-QA-1").And.Contain("Bank transfer · Successful").And.Contain("CN-PAY-QA-2").And.Contain("Cash · Pending"));
        AssertMoney(pays, "2,500.00");
        Assert.That(SectionText("Upcoming appointments"), Does.Not.Contain("CN-ORD-QA"), "sections show only their own data");
        Shot("sections");

        // every target of the cards and links
        Assert.That(Href(StatCard("Recent Medicine Orders")), Is.EqualTo("/patient/orders"));
        Assert.That(Href(StatCard("Upcoming Appointments")), Is.EqualTo("/patient/appointments"));
        Assert.That(StatCard("Payment Statuses").GetAttribute("href"), Does.EndWith("#patient-payment-statuses"));
        Assert.That(Href(QuickLink("Medicines")), Is.EqualTo("/patient/medicines"));
        Assert.That(Href(QuickLink("Doctors")), Is.EqualTo("/patient/doctors"));
        Assert.That(Href(ShortcutLink("View all orders")), Is.EqualTo("/patient/orders"));
        Assert.That(Href(ShortcutLink("View all appointments")), Is.EqualTo("/patient/appointments"));
        Assert.That(Href(ShortcutLink("CN-ORD-QA-101")), Is.EqualTo("/patient/orders/101"));
        Assert.That(Href(ShortcutLink("CN-APT-QA-301")), Is.EqualTo("/patient/appointments/301"));

        // the shortcuts really navigate
        Click(StatCard("Recent Medicine Orders")); WaitPath("/patient/orders");
        Go("/patient-dashboard"); WaitStat("Upcoming Appointments", "3");
        Click(StatCard("Upcoming Appointments")); WaitPath("/patient/appointments");
        Go("/patient-dashboard"); WaitSection("Upcoming appointments", "CN-APT-QA-301");
        Click(ShortcutLink("CN-APT-QA-301")); WaitPath("/patient/appointments/301");
        Go("/patient-dashboard"); WaitStat("Recent Medicine Orders", "7");
        Click(QuickLink("Doctors")); WaitPath("/patient/doctors");
        Shot("shortcut-doctors");

        // only the patient endpoints were requested, always with the patient's identity and role
        var calls = DashboardCalls();
        Assert.That(calls.Select(c => c.Path).Distinct().OrderBy(p => p), Is.EqualTo(new[] { AppointmentsPath, OrdersPath, PatientPaymentsPath }.OrderBy(p => p)), "no staff or doctor endpoint is requested");
        Assert.That(calls.All(c => c.Subject == Patient1 && c.Role == "Patient" && c.Authorization.StartsWith("Bearer ") && c.Status == 200), Is.True);
    }

    // =============================================================================================================
    // GCN51-S02  Doctor dashboard
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN51-S02"), Description("MOCKED API. A signed-in Doctor sees the four statistics, today's appointments (only today's, in time order) with the patient and payment details, and the shortcuts open the appointment schedule on the right view (today, upcoming, completed) with matching counts; the professional-profile shortcut leads to the profile.")]
    public async Task GCN51_S02_DoctorDashboardShowsStatisticsAndOpensSchedule()
    {
        await Start();
        SignIn("Doctor", Doctor1, "Lakmal Perera");
        Go("/doctor-dashboard");
        WaitStat("Today's Appointments", "2");
        WaitStat("Upcoming Appointments", "2");
        Assert.That(StatValue("Completed Appointments"), Is.EqualTo("1"));
        Assert.That(StatValue("Patient Count"), Is.EqualTo("5"), "five distinct patients (one patient has two appointments)");
        Assert.That(BodyText(), Does.Contain("Welcome back, Dr. Lakmal").And.Contain("Your schedule and patient queue for today."));
        Shot("statistics");

        // today's appointments only, in time order, with patient and payment details
        _wait.Until(d => d.FindElements(By.CssSelector("article.order-card a.appointment-reference")).Count == 2);
        Assert.That(_driver.FindElements(By.CssSelector("article.order-card a.appointment-reference")).Select(a => a.Text), Is.EqualTo(new[] { "CN-APT-DASH-301", "CN-APT-DASH-302" }));
        var body = BodyText();
        Assert.That(body, Does.Contain("Nimali Perera").And.Contain("Kasun Fernando").And.Contain("Today's appointments"));
        Assert.That(body, Does.Not.Contain("CN-APT-DASH-303").And.Not.Contain("Dilani Silva").And.Not.Contain("CN-APT-DASH-305"), "upcoming and completed appointments are not listed as today's");
        Assert.That(body, Does.Not.Contain("No scheduled appointments today."));

        // shortcuts to the schedule
        Click(ShortcutLink("Upcoming appointments"));
        _wait.Until(d => PathNow() == "/doctor/appointments" && QueryNow() == "?view=upcoming");
        _wait.Until(d => d.FindElements(By.XPath("//h1[normalize-space()='My appointment schedule']")).Any());
        _wait.Until(d => SelectedTab() == "Upcoming (2)");
        Assert.That(Refs(), Is.EqualTo(new[] { "CN-APT-DASH-303", "CN-APT-DASH-304" }));
        Shot("schedule-upcoming");

        Go("/doctor-dashboard"); WaitStat("Completed Appointments", "1");
        Click(ShortcutLink("Completed appointments"));
        _wait.Until(d => PathNow() == "/doctor/appointments" && QueryNow() == "?view=completed");
        _wait.Until(d => SelectedTab() == "Completed (1)");
        Assert.That(Refs(), Is.EqualTo(new[] { "CN-APT-DASH-305" }));

        Go("/doctor-dashboard"); WaitStat("Today's Appointments", "2");
        Click(ShortcutLink("View today's appointments"));
        _wait.Until(d => PathNow() == "/doctor/appointments" && QueryNow() == "?view=today");
        _wait.Until(d => SelectedTab() == "Today (2)");
        Assert.That(Refs(), Is.EqualTo(new[] { "CN-APT-DASH-301", "CN-APT-DASH-302" }));

        Go("/doctor-dashboard"); WaitStat("Patient Count", "5");
        Click(ShortcutLink("Professional Profile")); WaitPath("/profile");

        // only the doctor endpoint, with the doctor's identity and role
        var calls = DashboardCalls();
        Assert.That(calls.Select(c => c.Path).Distinct().ToList(), Is.EqualTo(new[] { DoctorListPath }));
        Assert.That(calls.All(c => c.Subject == Doctor1 && c.Role == "Doctor" && c.Status == 200), Is.True);
    }
    private string SelectedTab() => _driver.FindElements(By.CssSelector("button[role=tab][aria-selected=true]")).Select(t => t.Text).SingleOrDefault() ?? "";
    private List<string> Refs() => _driver.FindElements(By.CssSelector("section[role=tabpanel] a.appointment-reference")).Select(a => a.Text).ToList();

    // =============================================================================================================
    // GCN51-S03  Pharmacy staff dashboard
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN51-S03"), Description("MOCKED API. A signed-in Pharmacy Staff user sees the six queue counts, the queue previews, the medicine and appointment income and bank-transfer information in their own sections (not mixed), the dated/undated receipts notice, and the cards and links go to the right pharmacy pages.")]
    public async Task GCN51_S03_PharmacyStaffDashboardShowsQueuesPaymentsAndShortcuts()
    {
        await Start();
        SignIn("PharmacyStaff", Staff1, "Nadeesha Silva");
        Go("/pharmacy-dashboard");
        WaitStat("New Medicine Orders", "4");
        Assert.That(StatValue("Awaiting Prescription Verification"), Is.EqualTo("3"));
        WaitStat("Medicine Bank Transfers Awaiting Verification", "2");
        WaitStat("Appointment Bank Transfers Awaiting Verification", "5");
        Assert.That(StatValue("Low-Stock Medicines"), Is.EqualTo("1"));
        Assert.That(StatValue("Ready for Collection"), Is.EqualTo("2"));
        Assert.That(BodyText(), Does.Contain("Welcome back, Nadeesha").And.Contain("what needs your attention at the pharmacy counter"));
        Shot("summary-cards");

        // queue previews
        WaitSection("Pharmacy operations", "New medicine orders (4)");
        var ops = SectionText("Pharmacy operations");
        Assert.That(ops, Does.Contain("Showing 2 of 4").And.Contain("CN-ORD-QA-201").And.Contain("CN-ORD-QA-202")
            .And.Contain("Pending prescriptions (3)").And.Contain("Amoxicillin QA").And.Contain("20 units")
            .And.Contain("Low-stock medicines (1)").And.Contain("Paracetamol QA").And.Contain("3 units remaining").And.Contain("Alert threshold: 10")
            .And.Contain("Ready for collection (2)").And.Contain("CN-ORD-QA-203").And.Contain("CN-ORD-QA-204"));
        AssertMoney(ops, "1,200.00"); AssertMoney(ops, "3,000.00");

        // payment information: the medicine and appointment sections carry their own figures
        WaitSection("Medicine payments and income", "Gross confirmed receipts");
        var med = SectionText("Medicine payments and income");
        Assert.That(med, Does.Contain("Today").And.Contain("This month").And.Contain("Bank transfers awaiting verification (2)").And.Contain("CN-PAY-QA-11").And.Contain("CN-PAY-QA-12").And.Contain("CN-PAY-QA-13")
            .And.Contain("1 successful payments have no confirmed date"));
        AssertMoney(med, "1,500.00"); AssertMoney(med, "12,000.00"); AssertMoney(med, "500.00");
        WaitSection("Appointment payments and income", "Gross confirmed receipts");
        var apt = SectionText("Appointment payments and income");
        Assert.That(apt, Does.Contain("Bank transfers awaiting verification (5)").And.Contain("Showing 1 of 5").And.Contain("CN-APTPAY-QA-21").And.Contain("CN-APTPAY-QA-22").And.Not.Contain("have no confirmed date"));
        AssertMoney(apt, "800.00"); AssertMoney(apt, "5,600.00");
        Assert.That(apt, Does.Not.Contain("CN-PAY-QA").And.Not.Contain("12,000.00"), "appointment figures are not mixed with medicine figures");
        Assert.That(med, Does.Not.Contain("CN-APTPAY").And.Not.Contain("5,600.00"));
        Shot("sections");

        // targets of the cards and links
        var cards = new (string Title, string Target)[]
        {
            ("New Medicine Orders", "/pharmacy/orders?status=Pending"), ("Awaiting Prescription Verification", "/pharmacy/prescriptions"),
            ("Medicine Bank Transfers Awaiting Verification", "/pharmacy/payments"), ("Appointment Bank Transfers Awaiting Verification", "/pharmacy/appointment-payments"),
            ("Low-Stock Medicines", "/pharmacy/inventory?lowStockOnly=true"), ("Ready for Collection", "/pharmacy/orders?status=ReadyForCollection"),
        };
        foreach (var c in cards) Assert.That(Href(StatCard(c.Title)), Is.EqualTo(c.Target), c.Title);
        Assert.That(Href(_driver.FindElement(By.XPath("//section[@aria-label='Medicine payments and income']//a[contains(normalize-space(),'CN-PAY-QA-13')]"))), Is.EqualTo("/pharmacy/payment-transactions/13"));
        Assert.That(Href(_driver.FindElement(By.XPath("//section[@aria-label='Medicine payments and income']//a[contains(normalize-space(),'View all medicine payments')]"))), Is.EqualTo("/pharmacy/payment-transactions"));
        Assert.That(Href(_driver.FindElement(By.XPath("//section[@aria-label='Appointment payments and income']//a[contains(normalize-space(),'View all')]"))), Is.EqualTo("/pharmacy/appointment-payments"));

        // the shortcuts really navigate
        Click(StatCard("Medicine Bank Transfers Awaiting Verification")); WaitPath("/pharmacy/payments");
        Go("/pharmacy-dashboard"); WaitStat("Low-Stock Medicines", "1");
        Click(StatCard("Low-Stock Medicines")); WaitPath("/pharmacy/inventory", "?lowStockOnly=true");
        Go("/pharmacy-dashboard"); WaitStat("Appointment Bank Transfers Awaiting Verification", "5");
        Click(StatCard("Appointment Bank Transfers Awaiting Verification")); WaitPath("/pharmacy/appointment-payments");
        Shot("shortcut-appointment-payments");

        // only the staff endpoints, with the staff identity and role
        var calls = DashboardCalls();
        Assert.That(calls.Select(c => c.Path).Distinct().OrderBy(p => p), Is.EqualTo(new[] { OperationsPath, StaffAppointmentPath, StaffMedicinePath }.OrderBy(p => p)));
        Assert.That(calls.All(c => c.Subject == Staff1 && c.Role == "PharmacyStaff" && c.Status == 200), Is.True);
    }

    // =============================================================================================================
    // GCN51-S04  Role-based access
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN51-S04"), Description("MOCKED API. Visitors without a session or with an expired session are sent to the login page, and signed-in users of the wrong role are sent to the forbidden page, for every dashboard; none of these visits displays any dashboard data or requests a dashboard endpoint. A control (the right role) does open its dashboard and does request data, so the empty request log is meaningful.")]
    public async Task GCN51_S04_UnauthenticatedAndWrongRoleUsersCannotOpenDashboards()
    {
        await Start();
        string[] dashboards = { "/patient-dashboard", "/doctor-dashboard", "/pharmacy-dashboard" };
        string[] secrets = { "CN-ORD-QA", "CN-APT-QA", "CN-APT-DASH", "CN-PAY-QA", "Awaiting Prescription Verification", "Today's Appointments", "Gross confirmed receipts" };

        // 1. no session at all
        foreach (var path in dashboards)
        {
            Go(path); WaitPath("/login");
            Assert.That(secrets.Any(BodyText().Contains), Is.False, $"{path} (visitor) shows no dashboard data");
        }
        Shot("visitor-login");

        // 2. an expired session is treated as no session
        SignIn("Patient", Patient1, "Synthetic Patient", expiredSeconds: 3600);
        Go("/patient-dashboard"); WaitPath("/login");
        Assert.That(secrets.Any(BodyText().Contains), Is.False);
        Assert.That(Js<string?>("return localStorage.getItem('carenova_token');"), Is.Null, "the expired token was discarded");

        // 3. wrong roles: forbidden, with the application's message and no data
        var cases = new (string Role, string Sub, string Name, string Path)[]
        {
            ("Patient", Patient1, "Synthetic Patient", "/doctor-dashboard"), ("Patient", Patient1, "Synthetic Patient", "/pharmacy-dashboard"),
            ("Doctor", Doctor1, "Lakmal Perera", "/patient-dashboard"), ("Doctor", Doctor1, "Lakmal Perera", "/pharmacy-dashboard"),
            ("PharmacyStaff", Staff1, "Nadeesha Silva", "/patient-dashboard"), ("PharmacyStaff", Staff1, "Nadeesha Silva", "/doctor-dashboard"),
            ("Admin", Admin1, "QA Admin", "/patient-dashboard"), ("Admin", Admin1, "QA Admin", "/doctor-dashboard"), ("Admin", Admin1, "QA Admin", "/pharmacy-dashboard"),
        };
        foreach (var c in cases)
        {
            SignIn(c.Role, c.Sub, c.Name);
            Go(c.Path);
            WaitPath("/forbidden");
            _wait.Until(d => BodyText().Contains("You do not have permission to access this page."));
            Assert.That(secrets.Any(BodyText().Contains), Is.False, $"{c.Role} on {c.Path} sees no dashboard data");
        }
        Shot("forbidden");

        // nothing was requested for any of the denied visits
        Assert.That(DashboardCalls(), Is.Empty, "no dashboard endpoint was requested by a visitor, an expired session or a wrong-role user");

        // 4. control: the right role opens the dashboard and the requests do happen
        SignOut(); SignIn("Patient", Patient1, "Synthetic Patient");
        Go("/patient-dashboard");
        WaitStat("Recent Medicine Orders", "7");
        Assert.That(PathNow(), Is.EqualTo("/patient-dashboard"));
        Assert.That(DashboardCalls().Count, Is.GreaterThanOrEqualTo(3), "control: the same check would have caught requests");
        Assert.That(DashboardCalls().All(c => c.Role == "Patient"), Is.True);
    }

    // =============================================================================================================
    // GCN51-S05  Failure and recovery
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN51-S05"), Description("MOCKED API. On the Patient dashboard a section shows a loading state, then its own error when its API fails (500) or answers invalid data, while the other sections keep working; cards show Unavailable instead of zero; Retry reloads only that section, a retry that still fails keeps the error, and a successful retry restores the data. The home-content block has its own error and Retry.")]
    public async Task GCN51_S05_DashboardSectionFailuresAreIsolatedAndRetryRecovers()
    {
        await Start();
        SignIn("Patient", Patient1, "Synthetic Patient");
        _fail[OrdersPath] = 500; _delay[OrdersPath] = 1500; _malformed.Add(AppointmentsPath); _fail[HomePath] = 500;
        Go("/patient-dashboard");

        // loading state first
        _wait.Until(d => SectionText("Recent medicine orders").Contains("Loading recent medicine orders"));
        Shot("loading");
        // then isolated errors
        const string failure = "This information is unavailable. Please retry.";
        _wait.Until(d => SectionText("Recent medicine orders").Contains(failure));
        _wait.Until(d => SectionText("Upcoming appointments").Contains(failure));
        _wait.Until(d => BodyText().Contains("We couldn’t load the home page information."));
        Assert.That(_driver.FindElements(By.CssSelector("section[aria-label='Recent medicine orders'] [role=alert]")), Has.Count.EqualTo(1));
        Assert.That(_driver.FindElement(By.CssSelector("button[aria-label='Retry recent medicine orders']")).Displayed, Is.True);
        Assert.That(_driver.FindElement(By.CssSelector("button[aria-label='Retry upcoming appointments']")).Displayed, Is.True);
        WaitSection("Medicine payment statuses", "CN-PAY-QA-1");                                  // the healthy section is unaffected
        Assert.That(SectionText("Medicine payment statuses"), Does.Not.Contain(failure));
        Assert.That(StatValue("Recent Medicine Orders"), Is.EqualTo("Unavailable"), "a failed section shows Unavailable, never a made-up zero");
        Assert.That(StatValue("Upcoming Appointments"), Is.EqualTo("Unavailable"));
        Assert.That(SectionText("Recent medicine orders"), Does.Not.Contain("CN-ORD-QA").And.Not.Contain("No medicine orders yet."));
        Shot("isolated-errors");
        _delay.Clear();
        int orders0 = Count(OrdersPath), appts0 = Count(AppointmentsPath), pays0 = Count(PatientPaymentsPath), home0 = Count(HomePath);

        // a retry that still fails keeps the error (and sends exactly one request for that section only)
        Click(_driver.FindElement(By.CssSelector("button[aria-label='Retry recent medicine orders']")));
        _wait.Until(d => Count(OrdersPath) == orders0 + 1);
        _wait.Until(d => SectionText("Recent medicine orders").Contains(failure));
        Assert.That(Count(AppointmentsPath), Is.EqualTo(appts0)); Assert.That(Count(PatientPaymentsPath), Is.EqualTo(pays0)); Assert.That(Count(HomePath), Is.EqualTo(home0));
        Assert.That(StatValue("Recent Medicine Orders"), Is.EqualTo("Unavailable"));

        // the server recovers: retry restores that section only
        _fail.Remove(OrdersPath);
        Click(_driver.FindElement(By.CssSelector("button[aria-label='Retry recent medicine orders']")));
        WaitSection("Recent medicine orders", "Latest 2 of 7 orders");
        WaitStat("Recent Medicine Orders", "7");
        Assert.That(SectionText("Recent medicine orders"), Does.Contain("CN-ORD-QA-101").And.Not.Contain(failure));
        Assert.That(Count(OrdersPath), Is.EqualTo(orders0 + 2), "one request per retry click");
        Assert.That(SectionText("Upcoming appointments"), Does.Contain(failure), "the other failed section is still failed: nothing was reloaded behind its back");
        Assert.That(Count(AppointmentsPath), Is.EqualTo(appts0));
        Shot("orders-recovered");

        _malformed.Remove(AppointmentsPath);
        Click(_driver.FindElement(By.CssSelector("button[aria-label='Retry upcoming appointments']")));
        WaitSection("Upcoming appointments", "Next 2 of 3 appointments");
        WaitStat("Upcoming Appointments", "3");
        Assert.That(Count(AppointmentsPath), Is.EqualTo(appts0 + 1));

        // the home-content block recovers independently
        _fail.Remove(HomePath);
        var homeAlert = _driver.FindElement(By.XPath("//section[contains(@class,'management-alert')][.//h2[contains(.,'load the home page information')]]"));
        Click(homeAlert.FindElement(By.XPath(".//button[normalize-space()='Retry']")));
        _wait.Until(d => BodyText().Contains("Welcome to CareNova pharmacy") && !BodyText().Contains("We couldn’t load the home page information."));
        Assert.That(Count(HomePath), Is.EqualTo(home0 + 1));
        Assert.That(Count(OrdersPath), Is.EqualTo(orders0 + 2), "retrying the home block did not reload the dashboard sections");
        Assert.That(_driver.FindElements(By.CssSelector("section[aria-label] [role=alert]")), Is.Empty, "no section error is left");
        Shot("all-recovered");
    }
}
