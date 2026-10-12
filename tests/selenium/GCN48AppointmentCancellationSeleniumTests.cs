using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.SeleniumTests;

/// <summary>
/// GCN-48 Appointment Cancellation: exactly five Selenium tests in headless Chrome against the local Vite frontend (http://localhost:3000).
/// Every call to the CareNova API ports (5133-5199) is answered by a deterministic, stateful in-test MOCK (Selenium network interception) that mirrors the contract
/// and the decision rules of the GCN-48 backend (AppointmentCancellationsController / AppointmentCancellationPolicy / AppointmentCancellationService):
/// GET api/patient/appointments/{id}/cancellation (eligibility + version), POST (expectedVersion, acknowledgeNoRefund, reason) -> 200 result / 400 rule or
/// acknowledgement / 409 stale version / 404 not the caller's appointment. No backend, database or user-auth service is contacted.
///
/// WHAT THESE TESTS PROVE: what the browser shows and sends: the eligibility message, the confirmation dialog, the refund and no-refund wording, the acknowledgement
/// gate, the request body (version, reason, acknowledgeNoRefund), the persisted result after a reload, the restricted-state wording and the conflict / duplicate-submit behaviour.
/// WHAT THEY CANNOT PROVE: that the REAL server applies the payment rules, the 6-hour refund boundary, ownership and locking, or that a row is written. That is covered by the
/// backend tests AppointmentCancellationPolicyTests, AppointmentCancellationIntegrationTests, AppointmentCancellationPersistenceTests and AppointmentCancellationConcurrencyTests.
/// Sessions are test-made (unsigned token in localStorage); no real credential exists.
///
///   GCN48-S01 Patient cancels an unpaid appointment and sees the persisted Cancelled status
///   GCN48-S02 Eligible bank-transfer cancellation shows the refund amount and the manual-processing outcome
///   GCN48-S03 No-refund cancellation requires acknowledgement and submits acknowledgeNoRefund: true
///   GCN48-S04 Restricted appointments cannot be cancelled and show the reason
///   GCN48-S05 A 409 conflict requires a fresh confirmation, and duplicate submissions are prevented
/// </summary>
[TestFixture]
[NonParallelizable]
[Category("GCN48")]
public class GCN48AppointmentCancellationSeleniumTests
{
    private static readonly string BaseUrl = Environment.GetEnvironmentVariable("CARENOVA_BASE_URL") ?? "http://localhost:3000";
    private static readonly string Root = Environment.GetEnvironmentVariable("GCN48_REPORT_DIR")
        ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "carenova", "qa-reports", "GCN-48", "selenium");
    private static readonly string ShotDir = Path.Combine(Root, "screenshots");

    private const string P1 = "7a7a0000-0000-4000-8000-000000000001";   // the signed-in patient
    private const string P2 = "7a7a0000-0000-4000-8000-000000000002";   // another patient

    private IWebDriver _driver = null!;
    private WebDriverWait _wait = null!;
    private INetwork? _network;
    private readonly object _lock = new();
    private readonly List<Req> _requests = new();
    private List<Appt> _all = new();
    private int _postDelayMs;           // slows the cancellation POST so that a second submit has a real window
    private int _shots;

    private sealed record Req(string Method, string Path, string Authorization, string Subject, string Role, string Body, int Status);
    private sealed class Appt
    {
        public int Id; public string Ref = ""; public string Owner = P1; public string Doctor = "Dr Synthetic Cancel";
        public string Start = "", End = "", Status = "Booked"; public string? Method, PayStatus; public decimal Amount;
        public double HoursLeft = 48; public bool PendingCheckout; public int Rev;
        public object? Cancellation; public string? CancelledReason;
    }
    private sealed record Decision(bool Allowed, string Code, string Message, string Outcome = "NotRequired", decimal Refund = 0, bool Ack = false);

    private static Appt A(int id, string? method, string? pay, decimal amount, double hours, string status = "Booked", bool pending = false) =>
        new() { Id = id, Ref = $"CN-APT-CXL-{id}", Start = "2031-03-12T04:00:00Z", End = "2031-03-12T04:30:00Z", Status = status, Method = method, PayStatus = pay, Amount = amount, HoursLeft = hours, PendingCheckout = pending };

    /// <summary>Synthetic data. The mock decides eligibility from HoursLeft (hours until start) instead of the clock, so every test is deterministic.</summary>
    private static List<Appt> Data() => new()
    {
        A(101, "Cash", "Pending", 1500, 48),                          // S01  unpaid cash: cancellable, no refund needed
        A(102, "BankTransfer", "Successful", 1500, 48),               // S02  verified bank transfer, 48 h left: refund eligible
        A(103, "BankTransfer", "Successful", 1500, 2),                // S03  verified bank transfer, 2 h left: cancellable but NO refund
        A(201, "Cash", "Successful", 1500, 48),                       // S04  restricted cases
        A(202, "BankTransfer", "ReceiptUnderVerification", 1500, 48),
        A(203, "PaymentGateway", "Successful", 1500, 48),
        A(204, "Cash", "Pending", 1500, 48, pending: true),
        A(205, "Cash", "Pending", 1500, -1),
        A(206, "Cash", "Successful", 1500, -30, status: "Completed"),
        A(207, "Cash", "Pending", 1500, 48),                          // S04  control: a cancellable appointment must show the button
        A(301, "Cash", "Pending", 1500, 48),                          // S05  conflict then fresh confirmation
        new Appt { Id = 901, Ref = "CN-APT-CXL-901", Owner = P2, Start = "2031-03-13T04:00:00Z", End = "2031-03-13T04:30:00Z", Method = "Cash", PayStatus = "Pending", Amount = 1500 },
    };

    // ------------------------------------------------------------------------------------------------ the backend rules (AppointmentCancellationPolicy)
    private static Decision Evaluate(Appt a)
    {
        if (a.Status is not ("Booked" or "Confirmed")) return new(false, "AppointmentNotEligible", "This appointment cannot be cancelled in its current status.");
        if (a.HoursLeft <= 0) return new(false, "AppointmentStarted", "Appointments cannot be cancelled once their scheduled start time has been reached.");
        if (a.PendingCheckout) return new(false, "CheckoutInProgress", "An online checkout is still in progress. Wait for its outcome before cancelling.");
        if (a.Method is null && a.PayStatus is null) return new(true, "Unpaid", "No refund is required because payment has not been made.");
        switch (a.Method)
        {
            case "Cash" when a.PayStatus == "Successful": return new(false, "CashAlreadyPaid", "A cash appointment that has already been paid cannot be cancelled here.");
            case "Cash" when a.PayStatus == "Pending": return new(true, "Unpaid", "No refund is required because cash payment has not been made.");
            case "BankTransfer" when a.PayStatus == "ReceiptUnderVerification": return new(false, "ReceiptUnderVerification", "Your bank transfer receipt is being verified. Cancellation is available after verification is resolved.");
            case "BankTransfer" when a.PayStatus is "AwaitingBankTransferReceipt" or "Pending" or "Failed": return new(true, "Unpaid", "No verified payment has been recorded, so no refund is required.");
            case "BankTransfer" when a.PayStatus == "Successful":
                return a.HoursLeft >= 6
                    ? new(true, "RefundEligible", "Eligible for a refund, awaiting manual processing by pharmacy staff.", "Eligible", a.Amount)
                    : new(true, "RefundNotEligible", "Less than 6 hours remain. You may cancel, but no refund is available.", "NotEligible", 0, true);
            case "PaymentGateway" when a.PayStatus == "Successful": return new(false, "GatewayAlreadyPaid", "Patient cancellation and refunds are not available after successful online payment.");
            case "PaymentGateway" when a.PayStatus is "AwaitingGatewayPayment" or "Failed": return new(true, "Unpaid", "No successful online payment is recorded. No refund is required.");
            default: return new(false, "InformationUnavailable", "Payment information is unavailable or inconsistent. Refresh or contact the pharmacy.");
        }
    }
    // the confirmation version changes whenever anything the decision depends on changes (Rev simulates any concurrent change)
    private static string Version(Appt a)
    {
        var d = Evaluate(a);
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{a.Id}|{a.Status}|{a.Method}|{a.PayStatus}|{a.PendingCheckout}|{a.Rev}|{d.Code}|{d.Outcome}")));
    }
    private static object Result(Appt a, Decision d) => new
    {
        appointmentId = a.Id, appointmentReference = a.Ref, status = "Cancelled", cancelledAtUtc = "2026-10-12T04:30:00.1234567Z",
        refundOutcome = d.Outcome, refundAmount = d.Refund, refundStatus = d.Outcome == "Eligible" ? "PendingManualProcessing" : null, reason = a.CancelledReason, message = d.Message,
    };

    // ------------------------------------------------------------------------------------------------ lifecycle
    private async Task Start()
    {
        _shots = 0; _postDelayMs = 0; _all = Data();
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

    // ------------------------------------------------------------------------------------------------ mock API (mirrors the GCN-48 backend contract)
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
    {   // GET api/appointments/{id}: the patient appointment the details page loads
        id = a.Id, appointmentReference = a.Ref, doctorName = a.Doctor, appointmentStartUtc = a.Start, appointmentEndUtc = a.End, status = a.Status,
        section = a.Status is "Booked" or "Confirmed" ? "Upcoming" : "Previous", paymentMethod = a.Method, paymentStatus = a.PayStatus, canPay = false,
    };

    private HttpResponseData Supply(HttpRequestData request)
    {
        var uri = new Uri(request.Url!); var path = uri.AbsolutePath.TrimEnd('/'); var method = (request.Method ?? "GET").ToUpperInvariant();
        if (method == "OPTIONS") return Respond(204, "");
        var auth = request.Headers.FirstOrDefault(h => h.Key.Equals("Authorization", StringComparison.OrdinalIgnoreCase)).Value ?? "";
        var (sub, role) = Identity(auth); var body = request.PostData ?? "";
        HttpResponseData Done(int status, string content) { lock (_lock) _requests.Add(new(method, path, auth, sub, role, body, status)); return Respond(status, content); }

        var cancel = Regex.Match(path, "^/api/patient/appointments/(\\d+)/cancellation$", RegexOptions.IgnoreCase);
        var detail = Regex.Match(path, "^/api/appointments/(\\d+)$", RegexOptions.IgnoreCase);
        if (cancel.Success || detail.Success)
        {
            if (!auth.StartsWith("Bearer ") || !Guid.TryParse(sub, out var guid) || guid == Guid.Empty) return Done(401, "{}");     // missing token / invalid identity
            if (cancel.Success && role is not ("Patient" or "User")) return Done(403, "{}");                                         // [Authorize(Roles = "Patient,User")]
            var id = int.Parse((cancel.Success ? cancel : detail).Groups[1].Value);
            if (cancel.Success && method == "POST") { var delay = _postDelayMs; if (delay > 0) Thread.Sleep(delay); }
            lock (_lock)
            {
                var a = _all.FirstOrDefault(x => x.Id == id && x.Owner == sub);
                if (a is null) return Done(404, "{\"message\":\"Appointment not found.\"}");                                          // another patient's or unknown id
                if (detail.Success) return Done(200, JsonSerializer.Serialize(Dto(a)));
                var d = Evaluate(a);
                if (method == "GET")
                    return Done(200, JsonSerializer.Serialize(new
                    {
                        appointmentId = a.Id, allowed = d.Allowed, reasonCode = d.Code, message = d.Message, refundOutcome = d.Outcome, refundAmount = d.Refund,
                        requiresNoRefundAcknowledgement = d.Ack, version = Version(a), cancellation = a.Cancellation,
                    }));
                if (method == "POST")
                {
                    var req = JsonDocument.Parse(body).RootElement;
                    var version = req.TryGetProperty("expectedVersion", out var v) ? v.GetString() ?? "" : "";
                    var ack = req.TryGetProperty("acknowledgeNoRefund", out var k) && k.ValueKind == JsonValueKind.True;
                    var reason = req.TryGetProperty("reason", out var r) && r.ValueKind == JsonValueKind.String ? r.GetString() : null;
                    if (a.Cancellation is not null) return Done(200, JsonSerializer.Serialize(a.Cancellation));                     // idempotent repeat
                    if (version.Length != 64) return Done(400, "{\"message\":\"Refresh the cancellation information and check your reason.\"}");
                    if (!d.Allowed) return Done(400, JsonSerializer.Serialize(new { message = d.Message }));
                    if (version != Version(a)) return Done(409, "{\"message\":\"Appointment or payment information changed. Refresh and confirm again.\"}");
                    if (d.Ack && !ack) return Done(400, "{\"message\":\"Confirm that you understand no refund is available.\"}");
                    a.CancelledReason = string.IsNullOrWhiteSpace(reason) ? null : reason!.Trim();
                    a.Cancellation = Result(a, d); a.Status = "Cancelled";
                    return Done(200, JsonSerializer.Serialize(a.Cancellation));
                }
            }
        }
        return Done(200, "[]");   // layout extras (notifications etc.)
    }

    private List<Req> Sent(Func<Req, bool> filter) { lock (_lock) return _requests.Where(filter).ToList(); }
    private List<Req> CancellationGets() => Sent(r => r.Method == "GET" && r.Path.EndsWith("/cancellation"));
    private List<Req> CancellationPosts() => Sent(r => r.Method == "POST" && r.Path.EndsWith("/cancellation"));
    private Appt Find(int id) { lock (_lock) return _all.First(a => a.Id == id); }
    private string VersionOf(int id) { lock (_lock) return Version(_all.First(a => a.Id == id)); }
    private static JsonElement Json(string body) => JsonDocument.Parse(body).RootElement;

    // ------------------------------------------------------------------------------------------------ browser helpers
    private static string B64(string s) => Convert.ToBase64String(Encoding.UTF8.GetBytes(s)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    private void Go(string path) => _driver.Navigate().GoToUrl(BaseUrl + path);
    private T Js<T>(string script, params object[] args) => (T)((IJavaScriptExecutor)_driver).ExecuteScript(script, args)!;
    private string BodyText() => _driver.FindElement(By.TagName("body")).Text;
    private void Click(IWebElement e) { Js<object?>("arguments[0].scrollIntoView({block:'center'});", e); e.Click(); }
    private void Shot(string step) => Save($"{TestContext.CurrentContext.Test.Name}-{++_shots:00}-{step}");
    private void Save(string file) { Directory.CreateDirectory(ShotDir); ((ITakesScreenshot)_driver).GetScreenshot().SaveAsFile(Path.Combine(ShotDir, file + ".png")); }

    /// <summary>Signs in with a test-made session (no login call, no password).</summary>
    private void SignIn(string role, string sub = P1, string name = "Synthetic Patient")
    {
        Go("/login");
        _wait.Until(d => d.FindElements(By.TagName("form")).Any());
        var payload = JsonSerializer.Serialize(new { sub, role, exp = DateTimeOffset.UtcNow.AddHours(2).ToUnixTimeSeconds() });
        var token = $"{B64("{\"alg\":\"none\",\"typ\":\"JWT\"}")}.{B64(payload)}.test";
        var user = JsonSerializer.Serialize(new { userId = sub, email = "qa@example.test", role, fullName = name });
        Js<object?>("localStorage.setItem('carenova_token', arguments[0]); localStorage.setItem('carenova_user', arguments[1]);", token, user);
    }

    private IWebElement Panel() => _wait.Until(d => d.FindElements(By.CssSelector("section.appointment-cancellation")).FirstOrDefault(e => e.Displayed)!);
    private string PanelText() => _driver.FindElements(By.CssSelector("section.appointment-cancellation")).FirstOrDefault()?.Text ?? "";
    /// <summary>Opens the appointment details and waits until the cancellation information has loaded (the loading text is gone and a message is shown).</summary>
    private void OpenDetails(int id, string expectedMessage)
    {
        Go($"/patient/appointments/{id}");
        Panel();
        _wait.Until(d => PanelText().Contains(expectedMessage) && !PanelText().Contains("Checking cancellation information"));
    }
    private IReadOnlyCollection<IWebElement> Buttons(string text) => _driver.FindElements(By.XPath($"//section[@aria-label='Appointment cancellation']//button[normalize-space()='{text}']"));
    private IWebElement Button(string text) => _wait.Until(d => Buttons(text).FirstOrDefault(e => e.Displayed)!);
    private IWebElement Dialog() => _wait.Until(d => d.FindElements(By.CssSelector("div.appointment-cancellation-confirmation")).FirstOrDefault(e => e.Displayed)!);
    private IWebElement? Checkbox() => _driver.FindElements(By.CssSelector("div.appointment-cancellation-confirmation input[type=checkbox]")).FirstOrDefault();
    private IWebElement Reason() => Dialog().FindElement(By.TagName("textarea"));
    private string StatusChip() => _driver.FindElement(By.CssSelector("section.order-details-summary .appointment-status")).Text;
    private void WaitCancelled() => _wait.Until(d => d.FindElements(By.CssSelector("section.appointment-cancellation p[role=status]")).Any(e => e.Text == "Appointment cancelled"));
    private static void AssertCancellationBody(Req post, string version, bool ack, string? reason)
    {
        var b = Json(post.Body);
        Assert.That(b.GetProperty("expectedVersion").GetString(), Is.EqualTo(version), "the POST carries the version of the eligibility the patient confirmed");
        Assert.That(b.GetProperty("expectedVersion").GetString(), Does.Match("^[0-9A-F]{64}$"));
        Assert.That(b.GetProperty("acknowledgeNoRefund").GetBoolean(), Is.EqualTo(ack), "acknowledgeNoRefund");
        if (reason is null) Assert.That(b.GetProperty("reason").ValueKind, Is.EqualTo(JsonValueKind.Null));
        else Assert.That(b.GetProperty("reason").GetString(), Is.EqualTo(reason));
        Assert.That(post.Authorization, Does.StartWith("Bearer ")); Assert.That(post.Subject, Is.EqualTo(P1)); Assert.That(post.Role, Is.EqualTo("Patient"));
        Assert.That(post.Status, Is.EqualTo(200));
    }

    // =============================================================================================================
    // GCN48-S01  Patient cancels an unpaid appointment and sees the persisted Cancelled status
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN48-S01"), Description("MOCKED API. A signed-in Patient opens an unpaid (cash, pending) appointment, sees that no refund is required, confirms the cancellation with a reason, sees the cancelled result, and after a full reload still sees the Cancelled status and no Cancel button.")]
    public async Task GCN48_S01_PatientCancelsUnpaidAppointmentAndSeesPersistedCancelledStatus()
    {
        await Start();
        SignIn("Patient");
        OpenDetails(101, "No refund is required because cash payment has not been made.");
        Assert.That(BodyText(), Does.Contain("Appointment CN-APT-CXL-101").And.Contain("Dr Synthetic Cancel").And.Contain("March 12, 2031"));
        Assert.That(StatusChip(), Is.EqualTo("Booked"));
        Assert.That(CancellationPosts(), Is.Empty, "viewing the eligibility sends nothing");
        var version = VersionOf(101);
        Shot("eligible");

        Click(Button("Cancel appointment"));
        var dialog = Dialog();
        Assert.That(dialog.Text, Does.Contain("Cancel this appointment?").And.Contain("CN-APT-CXL-101").And.Contain("No refund is required because cash payment has not been made."));
        Assert.That(Checkbox(), Is.Null, "no acknowledgement is needed when no payment was made");
        Reason().SendKeys("  Synthetic QA reason: schedule clash  ");
        Shot("confirm-dialog");
        Click(Button("Confirm cancellation"));
        WaitCancelled();
        Assert.That(PanelText(), Does.Contain("No refund is required because cash payment has not been made.").And.Not.Contain("Refund amount"));
        _wait.Until(d => StatusChip() == "Cancelled");
        Assert.That(Buttons("Cancel appointment"), Is.Empty, "a cancelled appointment offers no second cancellation");
        Shot("cancelled");

        var posts = CancellationPosts();
        Assert.That(posts, Has.Count.EqualTo(1));
        AssertCancellationBody(posts[0], version, ack: false, reason: "Synthetic QA reason: schedule clash");   // typed with surrounding spaces: trimmed before it is sent
        Assert.That(Find(101).Status, Is.EqualTo("Cancelled"), "the (mock) server state is Cancelled");

        // persisted: a full reload loads everything from the server again
        var getsBefore = CancellationGets().Count;
        Go("/patient/appointments/101");
        _wait.Until(d => PanelText().Contains("Appointment cancelled") && !PanelText().Contains("Checking cancellation information"));
        _wait.Until(d => StatusChip() == "Cancelled");
        Assert.That(CancellationGets().Count, Is.GreaterThan(getsBefore), "the reload asked the server again");
        Assert.That(Buttons("Cancel appointment"), Is.Empty);
        Assert.That(CancellationPosts(), Has.Count.EqualTo(1), "reloading never re-submits the cancellation");
        Shot("persisted");
    }

    // =============================================================================================================
    // GCN48-S02  Eligible bank-transfer cancellation shows the refund amount and the manual-processing outcome
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN48-S02"), Description("MOCKED API. A verified bank-transfer appointment with more than 6 hours left shows the refund eligibility, the refund amount in the confirmation and in the result, the manual-processing wording, no acknowledgement box, and the stored refund information after a reload. The API result is checked to carry refundStatus PendingManualProcessing, and a response with any other refund status is rejected by the UI.")]
    public async Task GCN48_S02_EligibleBankTransferCancellationShowsRefundAndManualProcessing()
    {
        await Start();
        SignIn("Patient");
        OpenDetails(102, "Eligible for a refund, awaiting manual processing by pharmacy staff.");
        Assert.That(StatusChip(), Is.EqualTo("Booked"));
        var version = VersionOf(102);
        Click(Button("Cancel appointment"));
        var dialog = Dialog();
        Assert.That(dialog.Text, Does.Contain("Refund amount: LKR 1,500.00. Pharmacy staff will process it manually."));
        Assert.That(Checkbox(), Is.Null, "a refund-eligible cancellation needs no no-refund acknowledgement");
        Assert.That(Button("Confirm cancellation").Enabled, Is.True);
        Shot("refund-confirmation");
        Click(Button("Confirm cancellation"));
        WaitCancelled();
        Assert.That(PanelText(), Does.Contain("Eligible for a refund, awaiting manual processing by pharmacy staff.")
            .And.Contain("Refund amount: LKR 1,500.00. Awaiting manual processing by pharmacy staff."));
        _wait.Until(d => StatusChip() == "Cancelled");
        Shot("refund-result");

        var posts = CancellationPosts();
        Assert.That(posts, Has.Count.EqualTo(1));
        AssertCancellationBody(posts[0], version, ack: false, reason: null);
        var stored = Find(102).Cancellation!;   // the contract the UI accepted: the service rejects anything but PendingManualProcessing for an eligible refund
        var json = Json(JsonSerializer.Serialize(stored));
        Assert.That(json.GetProperty("refundOutcome").GetString(), Is.EqualTo("Eligible"));
        Assert.That(json.GetProperty("refundAmount").GetDecimal(), Is.EqualTo(1500m));
        Assert.That(json.GetProperty("refundStatus").GetString(), Is.EqualTo("PendingManualProcessing"));

        Go("/patient/appointments/102");
        _wait.Until(d => PanelText().Contains("Appointment cancelled") && !PanelText().Contains("Checking cancellation information"));
        Assert.That(PanelText(), Does.Contain("Refund amount: LKR 1,500.00. Awaiting manual processing by pharmacy staff."), "the stored refund information is shown after a reload");
        Assert.That(StatusChip(), Is.EqualTo("Cancelled")); Assert.That(CancellationPosts(), Has.Count.EqualTo(1));

        // negative control: if the API did not report the manual-processing status the UI must not claim a confirmed refund
        var control = Find(102); control.Cancellation = new { appointmentId = 102, appointmentReference = control.Ref, status = "Cancelled", cancelledAtUtc = "2026-10-12T04:30:00.1234567Z", refundOutcome = "Eligible", refundAmount = 1500m, refundStatus = "Refunded", reason = (string?)null, message = "x" };
        Go("/patient/appointments/102");
        _wait.Until(d => PanelText().Contains("Could not load cancellation information. Please retry."));
        Assert.That(PanelText(), Does.Not.Contain("Appointment cancelled"), "an unconfirmed refund status is rejected, not displayed");
    }

    // =============================================================================================================
    // GCN48-S03  No-refund cancellation requires acknowledgement and submits acknowledgeNoRefund: true
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN48-S03"), Description("MOCKED API. A verified bank-transfer appointment with under 6 hours left shows the no-refund wording; Confirm is disabled until the patient ticks the acknowledgement (and again if they untick it); no request is sent while it is disabled; the POST then carries acknowledgeNoRefund true; the result shows no refund.")]
    public async Task GCN48_S03_NoRefundCancellationRequiresAcknowledgementAndSubmitsIt()
    {
        await Start();
        SignIn("Patient");
        OpenDetails(103, "Less than 6 hours remain. You may cancel, but no refund is available.");
        var version = VersionOf(103);
        Click(Button("Cancel appointment"));
        var dialog = Dialog();
        Assert.That(dialog.Text, Does.Contain("Less than 6 hours remain").And.Not.Contain("Refund amount"));
        var box = Checkbox(); Assert.That(box, Is.Not.Null, "the acknowledgement is shown");
        Assert.That(dialog.Text, Does.Contain("I understand that no refund is available for this cancellation."));
        Assert.That(box!.Selected, Is.False);
        var confirm = Button("Confirm cancellation");
        Assert.That(confirm.Enabled, Is.False, "Confirm is blocked until the patient acknowledges");
        Js<object?>("arguments[0].click();", confirm);                       // even a forced click on the disabled button must send nothing
        Assert.That(CancellationPosts(), Is.Empty);
        Shot("blocked");

        Click(box); Assert.That(box.Selected, Is.True); _wait.Until(d => Button("Confirm cancellation").Enabled);
        Click(box); Assert.That(box.Selected, Is.False); _wait.Until(d => !Button("Confirm cancellation").Enabled);   // unticking blocks it again
        Assert.That(CancellationPosts(), Is.Empty);
        Click(box); _wait.Until(d => Button("Confirm cancellation").Enabled);
        Shot("acknowledged");
        Click(Button("Confirm cancellation"));
        WaitCancelled();
        Assert.That(PanelText(), Does.Contain("Less than 6 hours remain. You may cancel, but no refund is available.").And.Not.Contain("Refund amount"));
        _wait.Until(d => StatusChip() == "Cancelled");
        Shot("cancelled-no-refund");

        var posts = CancellationPosts();
        Assert.That(posts, Has.Count.EqualTo(1), "exactly one request, sent only after the acknowledgement");
        AssertCancellationBody(posts[0], version, ack: true, reason: null);
        var stored = Json(JsonSerializer.Serialize(Find(103).Cancellation!));
        Assert.That(stored.GetProperty("refundOutcome").GetString(), Is.EqualTo("NotEligible")); Assert.That(stored.GetProperty("refundAmount").GetDecimal(), Is.EqualTo(0m));
    }

    // =============================================================================================================
    // GCN48-S04  Restricted appointments cannot be cancelled and show the reason
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN48-S04"), Description("MOCKED API. Six restricted appointments (cash already paid, receipt under verification, online payment successful, checkout in progress, already started, completed) each show their specific reason and offer no Cancel button, acknowledgement or reason box, and no cancellation request is ever sent. A control appointment that is cancellable does show the button, so the check could fail.")]
    public async Task GCN48_S04_RestrictedAppointmentsCannotBeCancelledAndShowReason()
    {
        await Start();
        SignIn("Patient");
        var cases = new (int Id, string Status, string Message)[]
        {
            (201, "Booked", "A cash appointment that has already been paid cannot be cancelled here."),
            (202, "Booked", "Your bank transfer receipt is being verified. Cancellation is available after verification is resolved."),
            (203, "Booked", "Patient cancellation and refunds are not available after successful online payment."),
            (204, "Booked", "An online checkout is still in progress. Wait for its outcome before cancelling."),
            (205, "Booked", "Appointments cannot be cancelled once their scheduled start time has been reached."),
            (206, "Completed", "This appointment cannot be cancelled in its current status."),
        };
        foreach (var c in cases)
        {
            OpenDetails(c.Id, c.Message);
            Assert.That(StatusChip(), Is.EqualTo(c.Status), $"appointment {c.Id}");
            Assert.That(Buttons("Cancel appointment"), Is.Empty, $"appointment {c.Id} offers no Cancel button");
            Assert.That(_driver.FindElements(By.CssSelector("div.appointment-cancellation-confirmation")), Is.Empty, $"appointment {c.Id} opens no confirmation");
            Assert.That(_driver.FindElements(By.CssSelector("section.appointment-cancellation textarea, section.appointment-cancellation input[type=checkbox]")), Is.Empty);
            Assert.That(PanelText(), Does.Not.Contain("Appointment cancelled"));
            Shot($"restricted-{c.Id}");
        }
        Assert.That(CancellationPosts(), Is.Empty, "no cancellation request is sent for any restricted appointment");
        Assert.That(CancellationGets().Select(g => g.Path).Distinct(), Is.EquivalentTo(cases.Select(c => $"/api/patient/appointments/{c.Id}/cancellation")), "one eligibility read per appointment");
        Assert.That(_all.Where(a => a.Id is >= 201 and <= 206).All(a => a.Cancellation is null));

        // control: a cancellable appointment does offer the action (so the empty checks above are meaningful)
        OpenDetails(207, "No refund is required because cash payment has not been made.");
        Assert.That(Buttons("Cancel appointment"), Has.Count.EqualTo(1), "control: the Cancel button exists when cancellation is allowed");
        Shot("control-cancellable");
    }

    // =============================================================================================================
    // GCN48-S05  A 409 conflict requires a fresh confirmation, and duplicate submissions are prevented
    // =============================================================================================================
    [Test, Property("TestCaseId", "GCN48-S05"), Description("MOCKED API. The appointment changes on the server after the patient opened the confirmation: the first POST (old version) gets 409, the UI shows the conflict, keeps Confirm blocked, does not retry by itself, and only after 'Refresh cancellation information' and a fresh confirmation (new version) does a second POST succeed. That second confirmation is double-clicked in the same instant with a slow server: exactly one POST is sent and the button shows Cancelling.")]
    public async Task GCN48_S05_ConflictRequiresFreshConfirmationAndDuplicateSubmitIsPrevented()
    {
        await Start();
        SignIn("Patient");
        OpenDetails(301, "No refund is required because cash payment has not been made.");
        var version1 = VersionOf(301);
        Click(Button("Cancel appointment"));
        Dialog(); Reason().SendKeys("Synthetic conflict reason");

        Find(301).Rev++;                                    // the server-side information changes while the dialog is open
        var version2 = VersionOf(301);
        Assert.That(version2, Is.Not.EqualTo(version1));
        Click(Button("Confirm cancellation"));
        _wait.Until(d => d.FindElements(By.CssSelector("section.appointment-cancellation [role=alert]")).Any(e => e.Text.Contains("Appointment or payment information changed. Refresh cancellation information and confirm again.")));
        Shot("conflict");
        var posts = CancellationPosts();
        Assert.That(posts, Has.Count.EqualTo(1)); Assert.That(posts[0].Status, Is.EqualTo(409));
        Assert.That(Json(posts[0].Body).GetProperty("expectedVersion").GetString(), Is.EqualTo(version1), "the stale request carried the old version");
        Assert.That(PanelText(), Does.Not.Contain("Appointment cancelled"));
        Assert.That(Find(301).Status, Is.EqualTo("Booked"), "nothing was cancelled");
        Assert.That(Button("Confirm cancellation").Enabled, Is.False, "the old confirmation cannot be submitted again");
        Js<object?>("arguments[0].click();", Button("Confirm cancellation"));
        Assert.That(CancellationPosts(), Has.Count.EqualTo(1), "no resubmission with the stale confirmation, from the UI or by itself");

        // fresh information is required
        var getsBefore = CancellationGets().Count;
        Click(Button("Refresh cancellation information"));
        _wait.Until(d => CancellationGets().Count > getsBefore && Buttons("Cancel appointment").Any(b => b.Displayed && b.Enabled) && !PanelText().Contains("changed. Refresh cancellation information"));
        Assert.That(_driver.FindElements(By.CssSelector("div.appointment-cancellation-confirmation")), Is.Empty, "the stale confirmation was closed; a new one must be opened");
        Assert.That(CancellationPosts(), Has.Count.EqualTo(1), "refreshing does not submit anything");
        Shot("refreshed");

        // fresh confirmation, double-clicked against a slow server
        Click(Button("Cancel appointment"));
        Assert.That(Reason().GetAttribute("value"), Is.EqualTo("Synthetic conflict reason"), "the text the patient typed is kept across the refresh");
        _postDelayMs = 800;
        var confirm = Button("Confirm cancellation");
        var clicks = Js<long>("const b = arguments[0]; let n = 0; b.addEventListener('click', () => n++); b.click(); b.click(); return n;", confirm);
        Assert.That(clicks, Is.EqualTo(2), "both clicks were delivered to the button");
        _wait.Until(d => Buttons("Cancelling...").Any());
        Assert.That(Buttons("Cancelling...").First().Enabled, Is.False, "while the request is in flight the button is disabled");
        WaitCancelled();
        _wait.Until(d => StatusChip() == "Cancelled");
        Shot("cancelled");

        posts = CancellationPosts();
        Assert.That(posts, Has.Count.EqualTo(2), "one 409 plus exactly ONE accepted request: the double click did not duplicate the submission");
        Assert.That(posts[1].Status, Is.EqualTo(200));
        Assert.That(Json(posts[1].Body).GetProperty("expectedVersion").GetString(), Is.EqualTo(version2), "the fresh confirmation carries the refreshed version");
        Assert.That(Find(301).Status, Is.EqualTo("Cancelled"));
        Assert.That(Json(posts[1].Body).GetProperty("reason").GetString(), Is.EqualTo("Synthetic conflict reason"));
        Assert.That(Json(JsonSerializer.Serialize(Find(301).Cancellation!)).GetProperty("reason").GetString(), Is.EqualTo("Synthetic conflict reason"));
    }
}
