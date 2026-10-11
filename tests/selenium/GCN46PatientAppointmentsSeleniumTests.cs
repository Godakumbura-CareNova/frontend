using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.SeleniumTests;

/// <summary>
/// GCN-46 Patient Appointments: exactly five Selenium tests in headless Chrome against the local Vite frontend (http://localhost:3000).
/// Every call to the CareNova API ports (5133-5199) is answered by a deterministic in-test MOCK (Selenium network interception) that mirrors the
/// contract of the GCN-46 backend (GET /api/appointments and GET /api/appointments/{id}: results filtered by the patient id in the token, 404 for
/// another patient's appointment, 403 for a non-patient role). No backend, database, doctor or payment service is contacted; no payment is made.
/// Sessions are test-made (unsigned token in localStorage). The browser time zone is fixed to Asia/Colombo so dates and times are deterministic.
///
///   GCN46-S01 Patient sees their own appointments with correct details (and nobody else's)
///   GCN46-S02 Upcoming and previous appointments are categorised and sorted correctly
///   GCN46-S03 Patient opens an appointment and sees its details (navigation, direct link, refresh)
///   GCN46-S04 Payment status and available actions are shown correctly
///   GCN46-S05 Unauthorised access is prevented, including another patient's appointment
/// </summary>
[TestFixture]
[NonParallelizable]
[Category("GCN46")]
public class GCN46PatientAppointmentsSeleniumTests
{
    private static readonly string BaseUrl = Environment.GetEnvironmentVariable("CARENOVA_BASE_URL") ?? "http://localhost:3000";
    private static readonly string Root = Environment.GetEnvironmentVariable("GCN46_REPORT_DIR")
        ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "carenova", "qa-reports", "GCN-46", "selenium");
    private static readonly string ShotDir = Path.Combine(Root, "screenshots");

    private const string P1 = "11111111-1111-1111-1111-111111111111";   // the signed-in patient
    private const string P2 = "22222222-2222-2222-2222-222222222222";   // another patient
    private const string P3 = "33333333-3333-3333-3333-333333333333";   // a patient without appointments

    private IWebDriver _driver = null!;
    private WebDriverWait _wait = null!;
    private INetwork? _network;
    private readonly object _lock = new();
    private readonly List<Req> _requests = new();
    private Dictionary<string, List<Appt>> _data = new();
    private int _forcedStatus;                         // 0 = normal; otherwise every appointment API call answers this status
    private bool _paid102;                             // the test confirms the payment of appointment 102 between two loads
    private int _shots;

    private sealed record Req(string Method, int Port, string Path, string Authorization, string Subject);
    private sealed record Appt(int Id, string Reference, string Doctor, string Start, string End, string Status, string Section,
                               string? Method, string? PayStatus, bool CanPay);

    // ------------------------------------------------------------------------------------------------ deterministic data
    private static List<Appt> PatientOne() => new()
    {   // deliberately NOT in display order
        new(104, "CN-APT-AAA104", "Dr Kamal Fernando",   "2025-11-20T05:00:00Z", "2025-11-20T05:30:00Z", "Completed", "Previous",  "PaymentGateway", "Successful",              false),
        new(101, "CN-APT-AAA101", "Dr Anura Perera",     "2031-03-12T04:30:00Z", "2031-03-12T05:00:00Z", "Booked",    "Upcoming",  null,             null,                      true),
        new(106, "CN-APT-AAA106", "Dr Ishara Jayasinghe","2026-03-03T06:30:00Z", "2026-03-03T07:00:00Z", "Cancelled", "Previous",  "Cash",           "Pending",                 false),
        new(103, "CN-APT-AAA103", "Dr Ruwan Wijesekara", "2031-04-02T03:00:00Z", "2031-04-02T03:30:00Z", "Booked",    "Upcoming",  "BankTransfer",   "ReceiptUnderVerification", false),
        new(102, "CN-APT-AAA102", "Dr Nilmini Silva",    "2031-03-05T09:00:00Z", "2031-03-05T09:30:00Z", "Confirmed", "Upcoming",  "Cash",           "Pending",                 true),
        new(107, "CN-APT-AAA107", "Dr Hasini Gunawardena","2031-05-10T04:00:00Z","2031-05-10T04:30:00Z", "Unavailable","Unavailable", null,           "Unavailable",             false),
        new(105, "CN-APT-AAA105", "Dr Chamath Dias",     "2026-01-15T10:00:00Z", "2026-01-15T10:30:00Z", "Completed", "Previous",  "Cash",           "Pending",                 false),
        new(108, "CN-APT-AAA108", "Dr Sanduni Rathnayake","2031-06-01T05:00:00Z","2031-06-01T05:30:00Z", "Booked",    "Upcoming",  "PaymentGateway", "Failed",                  true),
    };
    private static List<Appt> PatientTwo() => new()
        { new(201, "CN-APT-BBB201", "Dr Private Other", "2031-03-20T05:00:00Z", "2031-03-20T05:30:00Z", "Booked", "Upcoming", "Cash", "Pending", true) };

    // ------------------------------------------------------------------------------------------------ lifecycle
    private async Task Start()
    {
        _shots = 0; _forcedStatus = 0; _paid102 = false;
        _data = new() { [P1] = PatientOne(), [P2] = PatientTwo(), [P3] = new() };
        lock (_lock) _requests.Clear();
        var options = new ChromeOptions();
        options.AddArgument("--headless");
        options.AddArgument("--window-size=1400,1000");
        _driver = new ChromeDriver(options);
        _wait = new WebDriverWait(_driver, TimeSpan.FromSeconds(15));
        _wait.IgnoreExceptionTypes(typeof(StaleElementReferenceException), typeof(NoSuchElementException));
        ((ChromeDriver)_driver).ExecuteCdpCommand("Emulation.setTimezoneOverride", new Dictionary<string, object> { ["timezoneId"] = "Asia/Colombo" });
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

    // ------------------------------------------------------------------------------------------------ mock API (mirrors the GCN-46 backend contract)
    private static HttpResponseData Respond(int status, string body)
    {
        var r = new HttpResponseData { StatusCode = status, Body = body };
        r.Headers["Access-Control-Allow-Origin"] = BaseUrl;
        r.Headers["Access-Control-Allow-Headers"] = "authorization, content-type";
        r.Headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
        r.Headers["Content-Type"] = "application/json";
        return r;
    }
    private static string Dto(Appt a) => JsonSerializer.Serialize(new
    {
        id = a.Id, appointmentReference = a.Reference, doctorName = a.Doctor, appointmentStartUtc = a.Start, appointmentEndUtc = a.End,
        status = a.Status, section = a.Section, paymentMethod = a.Method, paymentStatus = a.PayStatus, canPay = a.CanPay,
    });

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
        var uri = new Uri(request.Url!);
        var path = uri.AbsolutePath.TrimEnd('/');
        var method = (request.Method ?? "GET").ToUpperInvariant();
        if (method == "OPTIONS") return Respond(204, "");
        var auth = request.Headers.FirstOrDefault(h => h.Key.Equals("Authorization", StringComparison.OrdinalIgnoreCase)).Value ?? "";
        var (sub, role) = Identity(auth);
        lock (_lock) _requests.Add(new(method, uri.Port, path, auth, sub));

        if (uri.Port == 5136 && method == "GET" && path.StartsWith("/api/appointments", StringComparison.OrdinalIgnoreCase) && !path.Contains("/payment"))
        {
            if (_forcedStatus != 0) return Respond(_forcedStatus, JsonSerializer.Serialize(new { message = "forced by the test" }));
            if (!auth.StartsWith("Bearer ")) return Respond(401, "{}");
            if (!Guid.TryParse(sub, out _)) return Respond(401, JsonSerializer.Serialize(new { message = "The token does not identify a valid patient." }));
            if (role is not ("Patient" or "User")) return Respond(403, "{}");           // [Authorize(Roles = "Patient,User")]
            var mine = _data.TryGetValue(sub, out var own) ? own : new List<Appt>();
            if (path.Equals("/api/appointments", StringComparison.OrdinalIgnoreCase)) return Respond(200, "[" + string.Join(",", mine.Select(Dto)) + "]");
            var m = Regex.Match(path, "^/api/appointments/(\\d+)$", RegexOptions.IgnoreCase);
            if (!m.Success) return Respond(404, "{}");                                   // route constraint {appointmentId:int:min(1)}
            var id = int.Parse(m.Groups[1].Value);
            var found = mine.FirstOrDefault(a => a.Id == id);                           // only the caller's own appointments are visible
            if (found is null) return Respond(404, JsonSerializer.Serialize(new { message = "Appointment not found." }));
            if (id == 102 && _paid102) found = found with { PayStatus = "Successful", CanPay = false };   // payment confirmed between two loads
            return Respond(200, Dto(found));
        }
        if (uri.Port == 5136 && path.StartsWith("/api/appointments/", StringComparison.OrdinalIgnoreCase) && path.EndsWith("/payment"))
            return Respond(404, JsonSerializer.Serialize(new { message = "Payment information was not found for this appointment." }));   // payment page only
        return Respond(200, "[]");   // layout extras (notifications etc.)
    }

    private List<Req> Sent(Func<Req, bool> filter) { lock (_lock) return _requests.Where(filter).ToList(); }
    private List<Req> AppointmentCalls() => Sent(r => r.Port == 5136 && r.Path.StartsWith("/api/appointments") && !r.Path.EndsWith("/payment"));

    // ------------------------------------------------------------------------------------------------ browser helpers
    private static string B64(string s) => Convert.ToBase64String(Encoding.UTF8.GetBytes(s)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    private void Go(string path) => _driver.Navigate().GoToUrl(BaseUrl + path);
    private T Js<T>(string script, params object[] args) => (T)((IJavaScriptExecutor)_driver).ExecuteScript(script, args)!;
    private string BodyText() => _driver.FindElement(By.TagName("body")).Text;
    private string PathNow() => new Uri(_driver.Url).AbsolutePath;
    private void WaitText(string text) => _wait.Until(d => d.FindElement(By.TagName("body")).Text.Contains(text));
    private IWebElement Heading(string text) => _wait.Until(d => d.FindElements(By.XPath($"//h1[normalize-space()='{text}'] | //h2[normalize-space()='{text}']")).FirstOrDefault(e => e.Displayed));
    private void Click(IWebElement e) { Js<object?>("arguments[0].scrollIntoView({block:'center'});", e); e.Click(); }

    /// <summary>Signs in with a test-made session (no login call, no password).</summary>
    private void SignIn(string role, string sub = P1)
    {
        Go("/login");
        _wait.Until(d => d.FindElements(By.TagName("form")).Any());
        var payload = JsonSerializer.Serialize(new { sub, role, exp = DateTimeOffset.UtcNow.AddHours(2).ToUnixTimeSeconds() });
        var token = $"{B64("{\"alg\":\"none\",\"typ\":\"JWT\"}")}.{B64(payload)}.test";
        var user = JsonSerializer.Serialize(new { userId = sub, email = "qa@example.test", role, fullName = "QA Patient" });
        Js<object?>("localStorage.setItem('carenova_token', arguments[0]); localStorage.setItem('carenova_user', arguments[1]);", token, user);
    }
    private void SignOut() { Go("/login"); Js<object?>("localStorage.clear();"); }

    private void OpenList() { Go("/patient/appointments"); Heading("My appointments"); }
    private IWebElement Card(string reference) => _wait.Until(d => d.FindElements(By.CssSelector("article.order-card")).FirstOrDefault(c => c.FindElements(By.CssSelector("a.appointment-reference")).Any(a => a.Text == reference))!);
    private string Field(IWebElement scope, string label) => scope.FindElement(By.XPath($".//div[span[normalize-space()='{label}']]/strong")).Text;
    private List<string> References(string sectionHeading)
    {
        var section = _driver.FindElement(By.XPath($"//section[contains(@class,'orders-history')][.//h2[normalize-space()='{sectionHeading}']]"));
        return section.FindElements(By.CssSelector("a.appointment-reference")).Select(a => a.Text).ToList();
    }
    private static void AssertTime(string actual, string startHour, string endHour) =>
        Assert.That(actual, Does.Match($"(?i)^{startHour}:\\d\\d\\s?(am|pm)\\s?[–-]\\s?{endHour}:\\d\\d\\s?(am|pm)$"), "appointment time (Asia/Colombo)");
    private void Shot(string step) => Save($"{TestContext.CurrentContext.Test.Name}-{++_shots:00}-{step}");
    private void Save(string file) { Directory.CreateDirectory(ShotDir); ((ITakesScreenshot)_driver).GetScreenshot().SaveAsFile(Path.Combine(ShotDir, file + ".png")); }

    // =============================================================================================================
    // GCN46-S01  Patient sees their own appointments with correct details
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN46-S01"), Description("MOCKED API. A signed-in patient opens My appointments from the sidebar link: every card shows reference, status, doctor, date, time and payment labels from the API; another patient's appointment is absent; the request carried the patient's token. A patient without appointments sees the empty state.")]
    public async Task GCN46_S01_PatientSeesOwnAppointmentsWithCorrectDetails()
    {
        await Start();
        SignIn("Patient");
        Go("/patient/doctors");                                             // any patient page: use the real sidebar to reach the list
        var nav = _wait.Until(d => d.FindElements(By.XPath("//a[@href='/patient/appointments'][normalize-space()='Appointments']")).FirstOrDefault(e => e.Displayed)!);
        Click(nav);
        _wait.Until(d => PathNow() == "/patient/appointments");
        Heading("My appointments");
        _wait.Until(d => d.FindElements(By.CssSelector("article.order-card")).Count == 8);
        Shot("list");

        var cards = _driver.FindElements(By.CssSelector("article.order-card"));
        Assert.That(cards, Has.Count.EqualTo(8), "all eight of the patient's appointments are listed, once each");
        var c101 = Card("CN-APT-AAA101");
        Assert.That(c101.FindElement(By.CssSelector(".appointment-status")).Text, Is.EqualTo("Booked"));
        Assert.That(Field(c101, "Doctor"), Is.EqualTo("Dr Anura Perera"));
        Assert.That(Field(c101, "Appointment date"), Is.EqualTo("March 12, 2031"));
        AssertTime(Field(c101, "Appointment time"), "10", "10");                     // 04:30Z-05:00Z = 10:00-10:30 in Asia/Colombo
        Assert.That(Field(c101, "Payment method"), Is.EqualTo("Not selected"));
        Assert.That(Field(c101, "Payment status"), Is.EqualTo("Not paid"));
        var c103 = Card("CN-APT-AAA103");
        Assert.That(c103.FindElement(By.CssSelector(".appointment-status")).Text, Is.EqualTo("Booked"));
        Assert.That(Field(c103, "Doctor"), Is.EqualTo("Dr Ruwan Wijesekara"));
        Assert.That(Field(c103, "Appointment date"), Is.EqualTo("April 2, 2031"));
        Assert.That(Field(c103, "Payment method"), Is.EqualTo("Bank transfer"));
        Assert.That(Field(c103, "Payment status"), Is.EqualTo("Receipt under verification"));
        var c104 = Card("CN-APT-AAA104");
        Assert.That(c104.FindElement(By.CssSelector(".appointment-status")).Text, Is.EqualTo("Completed"));
        Assert.That(Field(c104, "Appointment date"), Is.EqualTo("November 20, 2025"));
        Assert.That(Field(c104, "Payment method"), Is.EqualTo("Online payment"));
        Assert.That(Field(c104, "Payment status"), Is.EqualTo("Successful"));
        Assert.That(Field(Card("CN-APT-AAA106"), "Payment method"), Is.EqualTo("Cash"));
        Assert.That(Card("CN-APT-AAA106").FindElement(By.CssSelector(".appointment-status")).Text, Is.EqualTo("Cancelled"));
        Assert.That(Field(Card("CN-APT-AAA102"), "Payment status"), Is.EqualTo("Pending"));
        Assert.That(Card("CN-APT-AAA102").FindElement(By.CssSelector(".appointment-status")).Text, Is.EqualTo("Confirmed"));
        Assert.That(Card("CN-APT-AAA108").FindElement(By.CssSelector("a.appointment-reference")).GetAttribute("href"), Does.EndWith("/patient/appointments/108"), "each reference links to its own details page");

        Assert.That(BodyText(), Does.Not.Contain("CN-APT-BBB201").And.Not.Contain("Dr Private Other"), "another patient's appointment must not be visible");
        var call = AppointmentCalls().First(r => r.Path == "/api/appointments");
        Assert.That(call.Authorization, Does.StartWith("Bearer "), "the list request carries the patient's token");
        Assert.That(call.Subject, Is.EqualTo(P1));

        // a patient without appointments: empty state, not an error
        SignIn("Patient", P3);
        OpenList();
        Heading("No appointments yet");
        Assert.That(BodyText(), Does.Contain("Your booked consultations will appear here."));
        Assert.That(_driver.FindElement(By.LinkText("Browse doctors")).GetAttribute("href"), Does.EndWith("/patient/doctors"));
        Assert.That(_driver.FindElements(By.CssSelector("[role=alert]")), Is.Empty, "an empty history is not shown as an error");
        Assert.That(_driver.FindElements(By.CssSelector("article.order-card")), Is.Empty);
        Shot("empty-state");
    }

    // =============================================================================================================
    // GCN46-S02  Upcoming and previous appointments are categorised and sorted correctly
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN46-S02"), Description("MOCKED API. The API returns the appointments shuffled; the page puts each into the right section with the right count, upcoming nearest first, previous newest first, and shows unknown-status appointments in a separate 'needing an update' section with a notice.")]
    public async Task GCN46_S02_UpcomingAndPreviousAreCategorisedAndSorted()
    {
        await Start();
        SignIn("Patient");
        OpenList();
        _wait.Until(d => d.FindElements(By.CssSelector("article.order-card")).Count == 8);
        Shot("sections");

        Assert.That(_driver.FindElements(By.CssSelector("section.orders-history h2")).Select(h => h.Text),
            Is.EqualTo(new[] { "Upcoming appointments", "Previous appointments", "Appointments needing an update" }), "section order");
        Assert.That(References("Upcoming appointments"), Is.EqualTo(new[] { "CN-APT-AAA102", "CN-APT-AAA101", "CN-APT-AAA103", "CN-APT-AAA108" }),
            "upcoming: nearest first (5 Mar, 12 Mar, 2 Apr, 1 Jun 2031)");
        Assert.That(References("Previous appointments"), Is.EqualTo(new[] { "CN-APT-AAA106", "CN-APT-AAA105", "CN-APT-AAA104" }),
            "previous: newest first (3 Mar 2026, 15 Jan 2026, 20 Nov 2025), including the cancelled one");
        Assert.That(References("Appointments needing an update"), Is.EqualTo(new[] { "CN-APT-AAA107" }));
        string Count(string heading) => _driver.FindElement(By.XPath($"//div[contains(@class,'orders-history-heading')][h2[normalize-space()='{heading}']]/span")).Text;
        Assert.That(Count("Upcoming appointments"), Is.EqualTo("4 appointments"));
        Assert.That(Count("Previous appointments"), Is.EqualTo("3 appointments"));
        Assert.That(Count("Appointments needing an update"), Is.EqualTo("1 appointment"), "singular wording for one");

        // an appointment is in exactly one section
        var all = References("Upcoming appointments").Concat(References("Previous appointments")).Concat(References("Appointments needing an update")).ToList();
        Assert.That(all, Has.Count.EqualTo(8)); Assert.That(all.Distinct().Count(), Is.EqualTo(8));
        var unavailable = Card("CN-APT-AAA107");
        Assert.That(unavailable.FindElement(By.CssSelector("[role=note]")).Text, Does.Contain("Some appointment or payment status information is unavailable."));
        Assert.That(unavailable.FindElement(By.CssSelector(".appointment-status")).Text, Is.EqualTo("Unavailable"));
        Assert.That(_driver.FindElements(By.CssSelector("article.order-card [role=note]")), Has.Count.EqualTo(1), "only the unavailable appointment carries the notice");

        // a patient with only upcoming appointments: previous shows its own empty message
        _data[P1] = PatientOne().Where(a => a.Section == "Upcoming").ToList();
        OpenList();
        _wait.Until(d => d.FindElements(By.CssSelector("article.order-card")).Count == 4);
        Assert.That(BodyText(), Does.Contain("No previous appointments."));
        Assert.That(_driver.FindElements(By.XPath("//h2[normalize-space()='Appointments needing an update']")), Is.Empty, "the update section is hidden when empty");
        Shot("only-upcoming");
    }

    // =============================================================================================================
    // GCN46-S03  Patient opens an appointment and sees its details
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN46-S03"), Description("MOCKED API. Clicking a reference on the list opens /patient/appointments/{id} with the full details; the back link returns to the list; the same page opens from a direct link; Refresh status loads the updated payment status.")]
    public async Task GCN46_S03_PatientOpensAppointmentAndSeesDetails()
    {
        await Start();
        SignIn("Patient");
        OpenList();
        Click(_wait.Until(d => d.FindElements(By.CssSelector("a.appointment-reference")).FirstOrDefault(a => a.Text == "CN-APT-AAA102")!));
        _wait.Until(d => PathNow() == "/patient/appointments/102");
        Heading("Appointment CN-APT-AAA102");
        Assert.That(BodyText(), Does.Contain("CONSULTATION DETAILS"));
        Assert.That(_driver.FindElement(By.CssSelector(".appointment-status")).Text, Is.EqualTo("Confirmed"));
        var summary = _driver.FindElement(By.CssSelector("section.order-details-summary"));
        Assert.That(Field(summary, "Doctor"), Is.EqualTo("Dr Nilmini Silva"));
        Assert.That(Field(summary, "Appointment date"), Is.EqualTo("March 5, 2031"));
        AssertTime(Field(summary, "Appointment time"), "2", "3");                    // 09:00Z-09:30Z = 2:30 pm - 3:00 pm in Asia/Colombo
        Assert.That(Field(summary, "Payment method"), Is.EqualTo("Cash"));
        Assert.That(Field(summary, "Payment status"), Is.EqualTo("Pending"));
        Assert.That(AppointmentCalls().Any(r => r.Path == "/api/appointments/102" && r.Authorization.StartsWith("Bearer ") && r.Subject == P1), Is.True, "details request carries the patient's token");
        Shot("details");

        // refresh: the payment was confirmed in the meantime
        var before = AppointmentCalls().Count(r => r.Path == "/api/appointments/102");
        _paid102 = true;
        Click(_wait.Until(d => d.FindElements(By.XPath("//button[normalize-space()='Refresh status']")).FirstOrDefault(e => e.Enabled)!));
        _wait.Until(d => Field(d.FindElement(By.CssSelector("section.order-details-summary")), "Payment status") == "Successful");
        Assert.That(_driver.FindElements(By.LinkText("Continue to Payment")), Is.Empty, "no payment action once the payment is successful");
        Assert.That(_driver.FindElement(By.LinkText("View payment")).GetAttribute("href"), Does.EndWith("/patient/appointments/102/payment"));
        Assert.That(AppointmentCalls().Count(r => r.Path == "/api/appointments/102"), Is.GreaterThan(before), "the refresh sends a new request");
        Shot("refreshed");

        // back to the list
        Click(_driver.FindElement(By.LinkText("My appointments")));
        _wait.Until(d => PathNow() == "/patient/appointments");
        Heading("My appointments");

        // direct link to another of the patient's own appointments
        Go("/patient/appointments/104");
        Heading("Appointment CN-APT-AAA104");
        var past = _driver.FindElement(By.CssSelector("section.order-details-summary"));
        Assert.That(_driver.FindElement(By.CssSelector(".appointment-status")).Text, Is.EqualTo("Completed"));
        Assert.That(Field(past, "Doctor"), Is.EqualTo("Dr Kamal Fernando"));
        Assert.That(Field(past, "Appointment date"), Is.EqualTo("November 20, 2025"));
        Assert.That(Field(past, "Payment method"), Is.EqualTo("Online payment"));
        Assert.That(Field(past, "Payment status"), Is.EqualTo("Successful"));
    }

    // =============================================================================================================
    // GCN46-S04  Payment status and available actions
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN46-S04"), Description("MOCKED API. For each payment situation the details page shows the right method and status label and offers the right action: Continue to Payment (opens the existing payment route), View payment, or none; unknown values show Unavailable with a notice and no payment action.")]
    public async Task GCN46_S04_PaymentStatusAndActionsAreDisplayedCorrectly()
    {
        await Start();
        SignIn("Patient");
        var cases = new (int Id, string Method, string Status, bool Pay, bool View)[]
        {
            (101, "Not selected", "Not paid", true, false),                       // upcoming, no payment yet
            (102, "Cash", "Pending", true, false),                                // upcoming, cash selected
            (103, "Bank transfer", "Receipt under verification", false, true),    // upcoming, receipt uploaded
            (104, "Online payment", "Successful", false, true),                   // completed and paid
            (105, "Cash", "Pending", false, false),                               // closed appointment: no action
            (106, "Cash", "Pending", false, false),                               // cancelled: no action
            (108, "Online payment", "Failed", true, false),                       // failed online payment: may pay again
        };
        foreach (var c in cases)
        {
            Go($"/patient/appointments/{c.Id}");
            _wait.Until(d => d.FindElements(By.CssSelector("section.order-details-summary")).Any());
            var summary = _driver.FindElement(By.CssSelector("section.order-details-summary"));
            Assert.That(Field(summary, "Payment method"), Is.EqualTo(c.Method), $"appointment {c.Id} payment method");
            Assert.That(Field(summary, "Payment status"), Is.EqualTo(c.Status), $"appointment {c.Id} payment status");
            Assert.That(_driver.FindElements(By.LinkText("Continue to Payment")).Count, Is.EqualTo(c.Pay ? 1 : 0), $"appointment {c.Id} Continue to Payment");
            Assert.That(_driver.FindElements(By.LinkText("View payment")).Count, Is.EqualTo(c.View ? 1 : 0), $"appointment {c.Id} View payment");
            if (c.Pay) Assert.That(_driver.FindElement(By.LinkText("Continue to Payment")).GetAttribute("href"), Does.EndWith($"/patient/appointments/{c.Id}/payment"));
            if (c.View) Assert.That(_driver.FindElement(By.LinkText("View payment")).GetAttribute("href"), Does.EndWith($"/patient/appointments/{c.Id}/payment"));
            Assert.That(_driver.FindElements(By.CssSelector("[role=note]")), Is.Empty, $"appointment {c.Id}: all values are known, so no notice");
            Shot($"appointment-{c.Id}");
        }

        // unknown values: shown as Unavailable, with a notice and no payment action
        Go("/patient/appointments/107");
        _wait.Until(d => d.FindElements(By.CssSelector("section.order-details-summary")).Any());
        var unknown = _driver.FindElement(By.CssSelector("section.order-details-summary"));
        Assert.That(Field(unknown, "Payment status"), Is.EqualTo("Unavailable"));
        Assert.That(_driver.FindElement(By.CssSelector(".appointment-status")).Text, Is.EqualTo("Unavailable"));
        Assert.That(unknown.FindElement(By.CssSelector("[role=note]")).Text, Does.Contain("Some appointment or payment status information is unavailable."));
        Assert.That(_driver.FindElements(By.LinkText("Continue to Payment")), Is.Empty);
        Assert.That(_driver.FindElements(By.LinkText("View payment")), Is.Empty);
        Shot("appointment-107-unavailable");

        // the action really leads to the existing payment page (no payment is made)
        Go("/patient/appointments/101");
        Click(_wait.Until(d => d.FindElements(By.LinkText("Continue to Payment")).FirstOrDefault(e => e.Displayed)!));
        _wait.Until(d => PathNow() == "/patient/appointments/101/payment");
        Heading("Pay for your appointment");
        Assert.That(Sent(r => r.Method == "POST"), Is.Empty, "opening the payment page sends no payment request");
        Shot("payment-page");
    }

    // =============================================================================================================
    // GCN46-S05  Unauthorised access is prevented
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN46-S05"), Description("MOCKED API. Visitors go to login and other roles to 403 without any appointment request; a patient opening another patient's appointment id (or a malformed id) sees 'Appointment not found.' and none of the other patient's data; an expired-session 401 and a 403 show their messages with no appointment data.")]
    public async Task GCN46_S05_UnauthorisedAccessIsPrevented()
    {
        await Start();
        // 1. visitor: login page, no appointment request
        SignOut(); lock (_lock) _requests.Clear();
        foreach (var p in new[] { "/patient/appointments", "/patient/appointments/101" })
        {
            Go(p); _wait.Until(d => PathNow() == "/login");
            Assert.That(PathNow(), Is.EqualTo("/login"), $"visitor opening {p}");
        }
        Assert.That(AppointmentCalls(), Is.Empty, "no appointment request is made for a visitor");
        Shot("visitor-login");

        // 2. doctor and pharmacy staff: 403 page, no appointment request
        foreach (var role in new[] { "Doctor", "PharmacyStaff" })
        {
            SignIn(role); lock (_lock) _requests.Clear();
            foreach (var p in new[] { "/patient/appointments", "/patient/appointments/101" })
            {
                Go(p); _wait.Until(d => PathNow() == "/forbidden");
                Assert.That(BodyText(), Does.Contain("403 Forbidden").And.Contain("You do not have permission to access this page."), $"{role} opening {p}");
                Assert.That(BodyText(), Does.Not.Contain("CN-APT-"), "no appointment data on the 403 page");
            }
            Assert.That(AppointmentCalls(), Is.Empty, $"no appointment request is made for the {role} role");
        }
        Shot("role-forbidden");

        // 3. patient P1 opens patient P2's appointment (201): the API answers 404, the page shows no data
        SignIn("Patient"); lock (_lock) _requests.Clear();
        Go("/patient/appointments/101");                                      // control: own appointment works
        Heading("Appointment CN-APT-AAA101");
        Go("/patient/appointments/201");
        WaitText("Appointment not found.");
        Assert.That(PathNow(), Is.EqualTo("/patient/appointments/201"));
        Assert.That(BodyText(), Does.Not.Contain("CN-APT-BBB201").And.Not.Contain("Dr Private Other").And.Not.Contain("March 20, 2031"), "no data of the other patient");
        Assert.That(_driver.FindElements(By.LinkText("Continue to Payment")), Is.Empty);
        Assert.That(_driver.FindElements(By.LinkText("View payment")), Is.Empty);
        Assert.That(_driver.FindElements(By.XPath("//button[normalize-space()='Retry']")), Is.Empty, "retrying cannot help a missing appointment");
        var attempt = AppointmentCalls().Last(r => r.Path == "/api/appointments/201");
        Assert.That(attempt.Subject, Is.EqualTo(P1), "the request was made as patient 1 and the server (mock of the real contract) refused it");
        Shot("other-patient-appointment");
        // the other patient's data is also absent from the list and from a malformed id
        OpenList(); _wait.Until(d => d.FindElements(By.CssSelector("article.order-card")).Count == 8);
        Assert.That(BodyText(), Does.Not.Contain("CN-APT-BBB201"));
        Go("/patient/appointments/abc"); WaitText("Appointment not found.");

        // 4. session expired (401) and forbidden (403) answers: message, no data
        _forcedStatus = 401; OpenList();
        WaitText("Please sign in to view your appointments.");
        Assert.That(_driver.FindElements(By.CssSelector("article.order-card")), Is.Empty);
        Assert.That(BodyText(), Does.Not.Contain("CN-APT-AAA"));
        Shot("session-expired");
        _forcedStatus = 403; Go("/patient/appointments/101");
        WaitText("You do not have access to these appointments.");
        Assert.That(BodyText(), Does.Not.Contain("Dr Anura Perera"));
    }
}
