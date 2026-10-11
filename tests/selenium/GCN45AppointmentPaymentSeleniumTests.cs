using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.SeleniumTests;

/// <summary>
/// GCN-45 Appointment Payment: exactly five Selenium tests in headless Chrome against the local Vite frontend (http://localhost:3000).
/// Every call to the CareNova API ports (5133-5199) is answered by an in-test, stateful MOCK (Selenium network interception), so no backend,
/// database, doctor service, Azure storage or PayHere server is contacted. PayHere is replaced by a FAKE SDK injected before the app loads.
/// Sessions are test-made (unsigned token in localStorage); no real credentials exist anywhere.
///
///   S1 Booking success, Continue to Payment navigation, patient-only route protection
///   S2 Cash selection, confirmation, missing-method validation
///   S3 Bank transfer receipt selection, upload, under-verification status
///   S4 Online payment with the fake PayHere SDK: validation, cancellation, retry, success
///   S5 Staff receipt rejection (reason required) and approval, plus access restrictions
/// </summary>
[TestFixture]
[NonParallelizable]
[Category("GCN45Final")]
public class GCN45AppointmentPaymentSeleniumTests
{
    private static readonly string BaseUrl = Environment.GetEnvironmentVariable("CARENOVA_BASE_URL") ?? "http://localhost:3000";
    private static readonly string Root = Environment.GetEnvironmentVariable("GCN45_REPORT_DIR")
        ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "carenova", "qa-reports", "GCN-45", "selenium");
    private static readonly string ShotDir = Path.Combine(Root, "screenshots");

    private const string FakePayHere =
        "window.__payhereCalls = []; window.payhere = { startPayment: function (p) { window.__payhereCalls.push(p); }, onCompleted: null, onDismissed: null, onError: null };";

    private IWebDriver _driver = null!;
    private WebDriverWait _wait = null!;
    private INetwork? _network;
    private readonly object _lock = new();
    private readonly List<Req> _requests = new();
    private readonly List<string> _external = new();
    private string? _method, _status; private int _attempts, _cancelled; private string _onlineOutcome = "Succeeded";
    private List<object> _receipts = new();
    private int _shots;

    private sealed record Req(string Method, int Port, string Path, string Body, string Authorization);

    // ------------------------------------------------------------------------------------------------ lifecycle
    private async Task Start(bool fakeSdk = false)
    {
        _shots = 0; _method = null; _status = null; _attempts = 0; _cancelled = 0; _onlineOutcome = "Succeeded";
        _receipts = new() { Receipt(1, 11), Receipt(2, 12) };
        lock (_lock) { _requests.Clear(); _external.Clear(); }
        var options = new ChromeOptions();
        options.AddArgument("--headless");
        options.AddArgument("--window-size=1400,1000");
        _driver = new ChromeDriver(options);
        _wait = new WebDriverWait(_driver, TimeSpan.FromSeconds(15));
        _wait.IgnoreExceptionTypes(typeof(StaleElementReferenceException), typeof(NoSuchElementException));
        if (fakeSdk) ((ChromeDriver)_driver).ExecuteCdpCommand("Page.addScriptToEvaluateOnNewDocument", new Dictionary<string, object> { ["source"] = FakePayHere });
        _network = _driver.Manage().Network;
        _network.NetworkRequestSent += (_, e) => { if (Uri.TryCreate(e.RequestUrl, UriKind.Absolute, out var u) && u.Host != "localhost" && u.Host != "127.0.0.1" && u.Scheme.StartsWith("http")) lock (_lock) _external.Add(e.RequestUrl); };
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
    private static object Receipt(int id, int appointmentId) => new
    {
        id, appointmentId, appointmentReference = $"CN-APT-{appointmentId}", patientId = "11111111-1111-1111-1111-111111111111",
        amount = 2700, status = "PendingVerification", fileName = $"receipt-{id}.pdf", uploadedAtUtc = "2026-10-11T08:00:00Z",
    };

    private object PaymentJson() => new { id = 11, appointmentId = 42, appointmentReference = "CN-APT-42", amount = 2700, method = _method, status = _status, updatedAtUtc = "2026-10-11T08:00:00Z" };

    private static HttpResponseData Respond(int status, string body)
    {
        var r = new HttpResponseData { StatusCode = status, Body = body };
        r.Headers["Access-Control-Allow-Origin"] = BaseUrl;
        r.Headers["Access-Control-Allow-Headers"] = "authorization, content-type";
        r.Headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
        r.Headers["Content-Type"] = "application/json";
        return r;
    }
    private static HttpResponseData Json(object value, int status = 200) => Respond(status, JsonSerializer.Serialize(value));

    private HttpResponseData Supply(HttpRequestData request)
    {
        var uri = new Uri(request.Url!);
        var path = uri.AbsolutePath.TrimEnd('/');
        var method = (request.Method ?? "GET").ToUpperInvariant();
        if (method == "OPTIONS") return Respond(204, "");
        var auth = request.Headers.FirstOrDefault(h => h.Key.Equals("Authorization", StringComparison.OrdinalIgnoreCase)).Value ?? "";
        lock (_lock) _requests.Add(new(method, uri.Port, path, request.PostData ?? "", auth));
        var body = request.PostData ?? "";

        if (uri.Port == 5135 && Regex.IsMatch(path, "^/api/doctors/5$", RegexOptions.IgnoreCase))
        {
            var start = DateTime.UtcNow.Date.AddDays(10).AddHours(4);
            return Json(new { doctorId = "5", fullName = "QA Dr Silva", specialization = "Cardiologist", consultationFee = 2700,
                upcomingSlots = new[] { new { id = 31, startUtc = start.ToString("o"), endUtc = start.AddMinutes(30).ToString("o") } } });
        }
        if (uri.Port == 5136 && method == "POST" && path.Equals("/api/appointments", StringComparison.OrdinalIgnoreCase))
            return Json(new { id = 42, appointmentReference = "CN-APT-42", doctorName = "QA Dr Silva", appointmentStartUtc = DateTime.UtcNow.Date.AddDays(10).AddHours(4).ToString("o"), status = "Scheduled" }, 201);

        if (uri.Port == 5136 && path.StartsWith("/api/appointments/42/payment", StringComparison.OrdinalIgnoreCase))
        {
            if (!auth.StartsWith("Bearer ")) return Json(new { message = "Unauthorized" }, 401);
            var tail = path["/api/appointments/42/payment".Length..];
            lock (_lock)
            {
                if (tail == "" && method == "GET") return _method is null ? Json(new { message = "Payment not found" }, 404) : Json(PaymentJson());
                if (tail == "/method" && method == "POST")
                {
                    _method = JsonDocument.Parse(body).RootElement.GetProperty("method").GetString();
                    _status = _method switch { "Cash" => "Pending", "BankTransfer" => "AwaitingBankTransferReceipt", _ => "AwaitingGatewayPayment" };
                    return Json(PaymentJson());
                }
                if (tail == "/receipt" && method == "POST") { _status = "ReceiptUnderVerification"; return Json(PaymentJson()); }
                if (tail == "/online/start" && method == "POST")
                {
                    _attempts++;
                    return Json(new { attemptId = _attempts, attemptNumber = _attempts, sandbox = true, merchantId = "TEST123", gatewayOrderId = $"CN-APT-42-{_attempts}", items = "Appointment CN-APT-42",
                        amount = "2700.00", currency = "LKR", hash = "TEST-HASH", notifyUrl = "https://example.test/notify", returnUrl = $"{BaseUrl}/patient/appointments/42/payment",
                        cancelUrl = $"{BaseUrl}/patient/appointments/42/payment", firstName = "Test", lastName = "Patient", email = "patient@example.test", phone = "0771234567",
                        address = "Test address", city = "Colombo", country = "Sri Lanka", custom1 = "11", appointmentReference = "CN-APT-42" });
                }
                var online = Regex.Match(tail, "^/online/(\\d+)(/cancel)?$");
                if (online.Success && method == "GET")
                {
                    if (_onlineOutcome == "Succeeded") _status = "Successful";
                    return Json(new { outcome = _onlineOutcome, message = "Payment completed in the PayHere sandbox.", transactionReference = "TEST-TXN-1", canRetry = false });
                }
                if (online.Success && online.Groups[2].Success && method == "POST") { _cancelled++; return Json(new { outcome = "Cancelled", message = "The payment was cancelled. No money was taken.", canRetry = true }); }
            }
        }

        if (uri.Port == 5136 && path.StartsWith("/api/staff/appointment-payments", StringComparison.OrdinalIgnoreCase))
        {
            if (!auth.StartsWith("Bearer ")) return Json(new { message = "Unauthorized" }, 401);
            lock (_lock)
            {
                if (method == "GET" && path.EndsWith("/receipts", StringComparison.OrdinalIgnoreCase)) return Json(_receipts);
                var verify = Regex.Match(path, "/appointments/(\\d+)/receipt/verify$");
                if (verify.Success && method == "POST")
                {
                    var appointmentId = int.Parse(verify.Groups[1].Value); var doc = JsonDocument.Parse(body).RootElement;
                    if (!doc.GetProperty("approved").GetBoolean() && string.IsNullOrWhiteSpace(doc.GetProperty("rejectionReason").GetString()))
                        return Json(new { message = "A rejection reason is required when rejecting a receipt." }, 400);
                    _receipts = _receipts.Where(r => (int)r.GetType().GetProperty("appointmentId")!.GetValue(r)! != appointmentId).ToList();
                    return Json(new { id = 11, appointmentId, status = doc.GetProperty("approved").GetBoolean() ? "Successful" : "AwaitingBankTransferReceipt" });
                }
            }
        }
        return Respond(200, "[]"); // layout extras (notifications etc.)
    }

    private List<Req> Sent(Func<Req, bool> filter) { lock (_lock) return _requests.Where(filter).ToList(); }
    private List<Req> Payment(string method, string tail) => Sent(r => r.Method == method && r.Port == 5136 && r.Path.Equals("/api/appointments/42/payment" + tail, StringComparison.OrdinalIgnoreCase));

    // ------------------------------------------------------------------------------------------------ browser helpers
    private static string B64(string s) => Convert.ToBase64String(Encoding.UTF8.GetBytes(s)).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private void Go(string path) => _driver.Navigate().GoToUrl(BaseUrl + path);
    private T Js<T>(string script, params object[] args) => (T)((IJavaScriptExecutor)_driver).ExecuteScript(script, args)!;
    private string BodyText() => _driver.FindElement(By.TagName("body")).Text;
    private string PathNow() => new Uri(_driver.Url).AbsolutePath;
    private void WaitText(string text) => _wait.Until(d => d.FindElement(By.TagName("body")).Text.Contains(text));
    private IWebElement Heading(string text) => _wait.Until(d => d.FindElements(By.XPath($"//h1[normalize-space()='{text}'] | //h2[normalize-space()='{text}']")).FirstOrDefault(e => e.Displayed));
    private IWebElement Button(string text) => _wait.Until(d => d.FindElements(By.XPath($"//button[normalize-space()='{text}']")).FirstOrDefault(e => e.Displayed && e.Enabled));
    private void Click(IWebElement e) { Js<object?>("arguments[0].scrollIntoView({block:'center'});", e); e.Click(); }

    /// <summary>Signs in with a test-made session (no login call, no password).</summary>
    private void SignIn(string role)
    {
        Go("/login");
        _wait.Until(d => d.FindElements(By.TagName("form")).Any());
        var payload = JsonSerializer.Serialize(new { sub = "11111111-1111-1111-1111-111111111111", role, exp = DateTimeOffset.UtcNow.AddHours(2).ToUnixTimeSeconds() });
        var token = $"{B64("{\"alg\":\"none\",\"typ\":\"JWT\"}")}.{B64(payload)}.test";
        var user = JsonSerializer.Serialize(new { userId = "11111111-1111-1111-1111-111111111111", email = "qa@example.test", role, fullName = "QA User" });
        Js<object?>("localStorage.setItem('carenova_token', arguments[0]); localStorage.setItem('carenova_user', arguments[1]);", token, user);
    }
    private void SignOut() { Go("/login"); Js<object?>("localStorage.clear();"); }

    private void Pick(string label) =>
        Click(_wait.Until(d => d.FindElements(By.XPath($"//label[contains(@class,'appointment-payment-method')][.//strong[normalize-space()='{label}']]")).FirstOrDefault(e => e.Displayed)!));
    private IWebElement Field(string label) => _wait.Until(d => d.FindElements(By.XPath($"//label[span[normalize-space()='{label}']]/input")).FirstOrDefault(e => e.Displayed)!);
    private string Summary(string term) => _driver.FindElement(By.XPath($"//dl[contains(@class,'appointment-payment-summary')]//dt[normalize-space()='{term}']/following-sibling::dd")).Text;
    private void OpenPaymentPage() { Go("/patient/appointments/42/payment"); Heading("Pay for your appointment"); }
    private void Shot(string step) => Save($"{TestContext.CurrentContext.Test.Name}-{++_shots:00}-{step}");
    private void Save(string file) { Directory.CreateDirectory(ShotDir); ((ITakesScreenshot)_driver).GetScreenshot().SaveAsFile(Path.Combine(ShotDir, file + ".png")); }

    // =============================================================================================================
    // S1  Booking success, Continue to Payment navigation, patient-only route protection
    // =============================================================================================================
    [Test, Description("MOCKED API. A patient books a slot, sees the success screen, and Continue to Payment opens /patient/appointments/42/payment. Visitors go to login; a pharmacy staff user gets 403 Forbidden; neither triggers a payment API call.")]
    public async Task S1_BookingSuccessContinueToPaymentAndPatientOnlyRoutes()
    {
        await Start();
        SignIn("Patient");
        Go("/patient/doctors/5/book");
        Heading("Book Appointment");
        Assert.That(_driver.FindElements(By.XPath("//button[normalize-space()='Continue to Payment']")), Is.Empty, "no payment button before a booking exists");
        Click(_wait.Until(d => d.FindElements(By.CssSelector(".pd-slot")).FirstOrDefault()!));
        _wait.Until(d => d.FindElements(By.CssSelector(".pd-slot")).Count == 2);
        Click(_driver.FindElements(By.CssSelector(".pd-slot"))[1]);
        Click(Button("Confirm Appointment"));
        Heading("Appointment booked successfully");
        Assert.That(BodyText(), Does.Contain("CN-APT-42"));
        var booking = Sent(r => r.Method == "POST" && r.Path == "/api/appointments").Single();
        Assert.That(JsonDocument.Parse(booking.Body).RootElement.GetProperty("slotId").GetInt32(), Is.EqualTo(31));
        Assert.That(booking.Authorization, Does.StartWith("Bearer "), "the booking carries the patient's token");
        Shot("booking-success");

        Click(Button("Continue to Payment"));
        _wait.Until(d => PathNow() == "/patient/appointments/42/payment");
        Heading("Pay for your appointment");
        Shot("payment-page");

        // visitor: login page, no payment or booking API call
        SignOut(); lock (_lock) _requests.Clear();
        foreach (var protectedPath in new[] { "/patient/appointments/42/payment", "/patient/doctors/5/book" })
        {
            Go(protectedPath);
            _wait.Until(d => PathNow() == "/login");
            Assert.That(PathNow(), Is.EqualTo("/login"), $"visitor opening {protectedPath}");
        }
        // pharmacy staff: 403, still no patient API call
        SignIn("PharmacyStaff");
        foreach (var protectedPath in new[] { "/patient/appointments/42/payment", "/patient/doctors/5/book" })
        {
            Go(protectedPath);
            _wait.Until(d => PathNow() == "/forbidden");
            Assert.That(BodyText(), Does.Contain("403 Forbidden").And.Contain("You do not have permission to access this page."), $"staff opening {protectedPath}");
        }
        Shot("staff-forbidden");
        Assert.That(Sent(r => r.Path.Contains("/payment") || r.Path == "/api/appointments" || r.Path.StartsWith("/api/doctors")), Is.Empty,
            "no patient payment, booking or doctor API call is made for a visitor or staff user");
    }

    // =============================================================================================================
    // S2  Cash payment selection, confirmation, missing-method validation
    // =============================================================================================================
    [Test, Description("MOCKED API. Continue without a method shows the validation message and saves nothing; choosing Cash saves it, shows Cash selected with the unpaid status, and the choice survives a reload.")]
    public async Task S2_CashSelectionConfirmationAndMissingMethodValidation()
    {
        await Start();
        SignIn("Patient");
        OpenPaymentPage();
        Assert.That(Sent(r => r.Method == "GET" && r.Path == "/api/appointments/42/payment"), Is.Not.Empty, "the page asks the API for the saved payment");

        Click(Button("Continue"));
        WaitText("Choose a payment method.");
        Assert.That(Payment("POST", "/method"), Is.Empty, "nothing is saved without a method");
        Assert.That(_driver.FindElements(By.XPath("//h2[normalize-space()='Cash selected']")), Is.Empty);
        Shot("validation-message");

        Pick("Cash");
        Click(Button("Continue"));
        Heading("Cash selected");
        Assert.That(BodyText(), Does.Contain("Cash has been selected for this appointment."));
        Assert.That(Summary("Appointment"), Is.EqualTo("CN-APT-42"));
        Assert.That(Summary("Amount"), Is.EqualTo("LKR 2700.00"));
        Assert.That(Summary("Status"), Is.EqualTo("Pending"));
        Assert.That(BodyText(), Does.Not.Contain("Payment successful"), "cash is not paid by choosing it");
        var save = Payment("POST", "/method").Single();
        Assert.That(JsonDocument.Parse(save.Body).RootElement.GetProperty("method").GetString(), Is.EqualTo("Cash"));
        Assert.That(save.Authorization, Does.StartWith("Bearer "));
        Shot("cash-selected");

        Go("/patient/appointments/42/payment");
        Heading("Cash selected");
        Assert.That(_driver.FindElement(By.CssSelector("input[type=radio][value=Cash]")).Selected, Is.True, "the saved method is pre-selected after a reload");
        Assert.That(Payment("POST", "/method"), Has.Count.EqualTo(1), "reloading does not save again");
    }

    // =============================================================================================================
    // S3  Bank transfer receipt selection, upload, under-verification status
    // =============================================================================================================
    [Test, Description("MOCKED API. Upload without a file is refused locally; a chosen PDF is shown by name and uploaded as multipart; the page then shows Receipt under verification and keeps it after a reload.")]
    public async Task S3_BankTransferReceiptUploadAndUnderVerificationStatus()
    {
        await Start();
        var file = Path.Combine(Path.GetTempPath(), $"gcn45-receipt-{Guid.NewGuid():N}.pdf");
        File.WriteAllText(file, "%PDF-1.4\nGCN45 selenium test receipt\n%%EOF");
        try
        {
            SignIn("Patient");
            OpenPaymentPage();
            Pick("Bank transfer");
            Click(Button("Continue"));
            Heading("Bank transfer");
            Assert.That(Summary("Status"), Is.EqualTo("AwaitingBankTransferReceipt"));

            Click(Button("Upload receipt"));
            WaitText("Choose a receipt first.");
            Assert.That(Payment("POST", "/receipt"), Is.Empty, "no upload without a file");
            Shot("no-file-message");

            var input = _driver.FindElement(By.CssSelector("input[type=file]"));
            Js<object?>("arguments[0].style.display='block'; arguments[0].style.opacity=1;", input);
            input.SendKeys(file);
            _wait.Until(d => d.FindElement(By.CssSelector(".appointment-receipt-upload span")).Text == Path.GetFileName(file));
            Assert.That(Js<long>("return document.querySelector('input[type=file]').files[0].size;"), Is.EqualTo(new FileInfo(file).Length), "the browser holds the whole chosen file");
            Shot("file-chosen");

            Click(Button("Upload receipt"));
            Heading("Receipt under verification");
            Assert.That(BodyText(), Does.Contain("Staff must verify it before the payment becomes successful."));
            Assert.That(Summary("Status"), Is.EqualTo("ReceiptUnderVerification"));
            Assert.That(BodyText(), Does.Not.Contain("Payment successful"), "an uploaded receipt is not a confirmed payment");
            var upload = Payment("POST", "/receipt").Single();
            Assert.That(upload.Authorization, Does.StartWith("Bearer "));
            // Chrome's request interception reports a multipart file part's headers but never its bytes; the bytes are covered by the xUnit and Vitest suites.
            Assert.That(upload.Body, Does.Contain("name=\"receipt\"").And.Contain($"filename=\"{Path.GetFileName(file)}\"").And.Contain("Content-Type: application/pdf"), "multipart body carries the chosen file in a 'receipt' field");
            Shot("under-verification");

            Go("/patient/appointments/42/payment");
            Heading("Receipt under verification");
            Assert.That(Payment("POST", "/receipt"), Has.Count.EqualTo(1));
        }
        finally { File.Delete(file); }
    }

    // =============================================================================================================
    // S4  Online payment with the fake PayHere SDK: validation, cancellation, retry, success
    // =============================================================================================================
    [Test, Description("MOCKED API + FAKE PayHere SDK injected into the page. Incomplete billing is blocked; the SDK is opened with the sandbox session; dismissing it cancels the attempt and offers Try again; a second attempt completes and the payment becomes successful. The real payhere.lk is never contacted.")]
    public async Task S4_OnlinePaymentWithFakePayHereCancelRetryAndSuccess()
    {
        await Start(fakeSdk: true);
        SignIn("Patient");
        OpenPaymentPage();
        Pick("Online payment");
        Click(Button("Continue"));
        Heading("Pay securely with PayHere");
        Assert.That(Js<long>("return window.__payhereCalls.length;"), Is.Zero, "the fake SDK is in place and untouched");

        // incomplete billing is stopped before any payment session exists
        Click(Button("Pay LKR 2700.00"));
        WaitText("Enter your first name.");
        Assert.That(BodyText(), Does.Contain("Enter your email address.").And.Contain("Enter your phone number."));
        Assert.That(Payment("POST", "/online/start"), Is.Empty);
        Assert.That(Js<long>("return window.__payhereCalls.length;"), Is.Zero);
        Shot("billing-validation");

        void FillBilling()
        {
            foreach (var (label, value) in new[] { ("First name", "Test"), ("Last name", "Patient"), ("Email", "patient@example.test"), ("Phone", "0771234567"), ("Address", "Test address"), ("City", "Colombo") })
            { var f = Field(label); f.Clear(); f.SendKeys(value); }
        }

        // attempt 1: the patient closes the PayHere window
        FillBilling();
        Click(Button("Pay LKR 2700.00"));
        _wait.Until(d => Js<long>("return window.__payhereCalls.length;") == 1);
        var call = Js<Dictionary<string, object>>("return window.__payhereCalls[0];");
        Assert.That(call["merchant_id"], Is.EqualTo("TEST123")); Assert.That(call["sandbox"], Is.EqualTo(true));
        Assert.That(call["amount"], Is.EqualTo("2700.00")); Assert.That(call["currency"], Is.EqualTo("LKR")); Assert.That(call["order_id"], Is.EqualTo("CN-APT-42-1"));
        Assert.That(Payment("POST", "/online/start").Single().Body, Does.Contain("patient@example.test"));
        Shot("sdk-opened");
        Js<object?>("window.payhere.onDismissed();");
        Heading("Cancelled");
        Assert.That(BodyText(), Does.Contain("The payment was cancelled. No money was taken."));
        Assert.That(Payment("POST", "/online/1/cancel"), Has.Count.EqualTo(1));
        Assert.That(BodyText(), Does.Not.Contain("Payment successful"));
        Shot("cancelled");

        // attempt 2: retry and complete
        Click(Button("Try again"));
        Heading("Pay securely with PayHere");
        if (Field("First name").GetAttribute("value") == "") FillBilling();
        Click(Button("Pay LKR 2700.00"));
        _wait.Until(d => Js<long>("return window.__payhereCalls.length;") == 2);
        Assert.That(Js<string>("return window.__payhereCalls[1].order_id;"), Is.EqualTo("CN-APT-42-2"), "a retry uses a new gateway reference");
        Js<object?>("window.payhere.onCompleted('CN-APT-42-2');");
        Heading("Payment successful");
        Assert.That(BodyText(), Does.Contain("Your appointment payment has been confirmed.").And.Contain("CN-APT-42"));
        Assert.That(Payment("GET", "/online/2"), Is.Not.Empty, "the page asked the server for the recorded result");
        Shot("payment-successful");

        Assert.That(Js<long>("return document.querySelectorAll('script[src*=\"payhere\"]').length;"), Is.Zero, "the real PayHere script was never injected");
        lock (_lock) Assert.That(_external.Where(u => u.Contains("payhere")), Is.Empty, "no request to PayHere left the browser");
    }

    // =============================================================================================================
    // S5  Staff receipt rejection / approval, required rejection reason, access restrictions
    // =============================================================================================================
    [Test, Description("MOCKED API. Pharmacy staff see two pending receipts; rejecting without a reason is blocked locally; rejecting with a reason and approving the other update the list and send the right payloads; visitors and patients cannot open the page.")]
    public async Task S5_StaffReceiptRejectionApprovalAndAccessRestrictions()
    {
        await Start();
        SignIn("PharmacyStaff");
        Go("/pharmacy/appointment-payments");
        Heading("Appointment Payment Verification");
        _wait.Until(d => d.FindElements(By.CssSelector(".appointment-receipt-card")).Count == 2);
        Assert.That(BodyText(), Does.Contain("CN-APT-11").And.Contain("CN-APT-12").And.Contain("LKR 2,700.00"));
        Shot("pending-receipts");

        var first = _driver.FindElements(By.CssSelector(".appointment-receipt-card"))[0];
        Click(first.FindElement(By.CssSelector(".reject-receipt-button")));
        WaitText("Please enter a rejection reason before rejecting the receipt.");
        Assert.That(Sent(r => r.Method == "POST" && r.Path.EndsWith("/receipt/verify")), Is.Empty, "no decision is sent without a reason");
        Assert.That(_driver.FindElements(By.CssSelector(".appointment-receipt-card")), Has.Count.EqualTo(2));
        Shot("reason-required");

        _driver.FindElement(By.Id("rejection-1")).SendKeys("Amount on receipt does not match the fee.");
        Click(_driver.FindElement(By.CssSelector(".appointment-receipt-card .reject-receipt-button")));
        WaitText("Receipt for appointment CN-APT-11 was rejected.");
        _wait.Until(d => d.FindElements(By.CssSelector(".appointment-receipt-card")).Count == 1);
        var rejected = Sent(r => r.Method == "POST" && r.Path == "/api/staff/appointment-payments/appointments/11/receipt/verify").Single();
        Assert.That(rejected.Authorization, Does.StartWith("Bearer "));
        var rejectedBody = JsonDocument.Parse(rejected.Body).RootElement;
        Assert.That(rejectedBody.GetProperty("approved").GetBoolean(), Is.False);
        Assert.That(rejectedBody.GetProperty("rejectionReason").GetString(), Is.EqualTo("Amount on receipt does not match the fee."));
        var remaining = _driver.FindElements(By.CssSelector(".appointment-receipt-card h2")).Select(e => e.Text).ToList();
        Assert.That(remaining, Is.EqualTo(new[] { "CN-APT-12" }), "only the receipt that was not rejected stays in the list");
        Shot("rejected");

        Click(_driver.FindElement(By.CssSelector(".appointment-receipt-card .approve-receipt-button")));
        WaitText("Receipt for appointment CN-APT-12 was approved.");
        WaitText("No appointment receipts are waiting for verification.");
        var approved = JsonDocument.Parse(Sent(r => r.Method == "POST" && r.Path == "/api/staff/appointment-payments/appointments/12/receipt/verify").Single().Body).RootElement;
        Assert.That(approved.GetProperty("approved").GetBoolean(), Is.True);
        Assert.That(approved.GetProperty("rejectionReason").ValueKind, Is.EqualTo(JsonValueKind.Null));
        Shot("approved");

        // access restrictions: patient and visitor never reach the staff page or its API
        lock (_lock) _requests.Clear();
        SignIn("Patient");
        Go("/pharmacy/appointment-payments");
        _wait.Until(d => PathNow() == "/forbidden");
        Assert.That(BodyText(), Does.Contain("403 Forbidden"));
        Shot("patient-forbidden");
        SignOut();
        Go("/pharmacy/appointment-payments");
        _wait.Until(d => PathNow() == "/login");
        Assert.That(Sent(r => r.Path.StartsWith("/api/staff/")), Is.Empty, "no staff API call is made for a patient or a visitor");
    }
}
