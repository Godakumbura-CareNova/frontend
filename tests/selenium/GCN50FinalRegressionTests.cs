using System.Collections.Concurrent;
using System.Text.Json;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Interactions;
using OpenQA.Selenium.Support.UI;

namespace CareNova.SeleniumTests;

/// <summary>
/// GCN-50 FINAL Selenium regression suite: exactly five test cases (selected from the 51-test discovery run).
///
///   TC-01  About Us page loading and navigation
///   TC-02  Contact Us form required-field and invalid-input validation
///   TC-03  Duplicate contact form submission prevention
///   TC-04  Contact form handling of unexpected HTTP 2xx responses  (BUG-01)
///   TC-05  Contact API failure (HTTP 503) and retry (HTTP 201)
///
/// MOCKED API: a real Chrome drives the real React application served by Vite, but every call to the CareNova API
/// ports (5133-5136) is answered by Selenium's network interception with controlled responses. These tests verify
/// browser behaviour and the exact requests the browser sends. They do NOT exercise the real API or database.
/// All five tests are labelled MOCKED API in their [Description].
///
/// Requires only the Vite dev server (http://localhost:3000, override with CARENOVA_BASE_URL).
/// Set GCN50_HEADED=1 to watch Chrome instead of running it headless. No login, password or token is used.
/// </summary>
[TestFixture]
[NonParallelizable]
[Category("GCN50Final")]
public class GCN50FinalRegressionTests
{
    private static readonly string BaseUrl = Environment.GetEnvironmentVariable("CARENOVA_BASE_URL") ?? "http://localhost:3000";
    private static readonly string ReportRoot = Environment.GetEnvironmentVariable("GCN50_REPORT_DIR")
        ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "carenova", "qa-reports", "GCN-50");
    private static readonly string ShotDir = Path.Combine(ReportRoot, "screenshots", "selenium", "final");
    private static readonly string LogDir = Path.Combine(ReportRoot, "selenium", "final");

    private const string Received = "Your inquiry has been received. Thank you for contacting CareNova.";

    private static readonly object Information = new
    {
        introduction = "QA introduction: CareNova is your neighbourhood pharmacy.", background = "QA background: serving the community since 1998.",
        mission = "QA mission: accessible care for everyone.", vision = "QA vision: a healthier community.",
        services = new[] { new { title = "QA Pharmacy advice", description = "Expert medicine guidance." } },
        openingHours = new[] { new { day = "Monday", hours = "9am-5pm" }, new { day = "Sunday", hours = "Closed" } },
        address = "12 Galle Road, Colombo", phone = "+94 11 234 5678", email = "contact@example.test", locationDescription = "Near the clock tower",
        mapEmbedUrl = "", images = Array.Empty<object>(), revision = Guid.Empty
    };

    private IWebDriver _driver = null!;
    private WebDriverWait _wait = null!;
    private INetwork _network = null!;
    private readonly ConcurrentQueue<(int Status, string Body, string ContentType)> _postResponses = new();
    private readonly List<string> _postBodies = new();
    private readonly object _lock = new();
    private ManualResetEventSlim? _gate;
    private int _shots;

    [OneTimeSetUp]
    public void Folders() { Directory.CreateDirectory(ShotDir); Directory.CreateDirectory(LogDir); }

    [SetUp]
    public async Task SetUp()
    {
        // NUnit reuses one fixture instance for every test, so all per-test state is reset here.
        _shots = 0;
        lock (_lock) _postBodies.Clear();
        while (_postResponses.TryDequeue(out _)) { }
        _gate = null;

        var options = new ChromeOptions();
        if (Environment.GetEnvironmentVariable("GCN50_HEADED") != "1") options.AddArgument("--headless");
        options.AddArgument("--window-size=1400,1000");
        _driver = new ChromeDriver(options);
        _driver.Manage().Window.Size = new System.Drawing.Size(1400, 1000);
        _wait = new WebDriverWait(_driver, TimeSpan.FromSeconds(15));
        _wait.IgnoreExceptionTypes(typeof(StaleElementReferenceException), typeof(NoSuchElementException));

        _network = _driver.Manage().Network;
        _network.AddRequestHandler(new NetworkRequestHandler
        {
            RequestMatcher = request => Uri.TryCreate(request.Url, UriKind.Absolute, out var u) && u.Host == "localhost" && u.Port is >= 5133 and <= 5136,
            ResponseSupplier = Supply,
        });
        await _network.StartMonitoring();
    }

    [TearDown]
    public async Task TearDown()
    {
        var name = TestContext.CurrentContext.Test.Name;
        var failed = TestContext.CurrentContext.Result.Outcome.Status == NUnit.Framework.Interfaces.TestStatus.Failed;
        try
        {
            _gate?.Set();
            Shot("final-state");
            if (failed) Save($"{name}-FAILURE");
        }
        catch { /* browser may already be gone */ }
        try { await _network.StopMonitoring(); } catch { /* best effort */ }
        try { _driver.Quit(); _driver.Dispose(); } catch { /* best effort */ }
        _gate?.Dispose();
        _gate = null;
    }

    // =============================================================================================================
    // TC-01  About Us page loading and navigation
    // =============================================================================================================
    [Test, Description("MOCKED API (pharmacy information). About Us loads with its headings and content; Home, About Us and Contact Us navigation, Back, Forward and Refresh all keep the right page.")]
    public void TC01_AboutUsPageLoadingAndNavigation()
    {
        Go("/about");
        _wait.Until(d => d.PageSource.Contains("QA mission: accessible care for everyone."));
        Assert.That(H1("About CareNova").Displayed);
        foreach (var heading in new[] { "Our pharmacy", "Our services", "Our mission", "Our vision", "Opening hours", "Our pharmacy & team" })
            Assert.That(_driver.FindElements(By.XPath($"//h2[normalize-space()='{heading}']")), Is.Not.Empty, $"About Us heading '{heading}'");
        foreach (var text in new[] { "QA introduction: CareNova is your neighbourhood pharmacy.", "QA background: serving the community since 1998.", "QA Pharmacy advice", "QA vision: a healthier community.", "Monday", "9am-5pm", "Closed" })
            Assert.That(_driver.PageSource, Does.Contain(text), $"About Us content '{text}'");
        Shot("about-us-loaded");

        Sidebar("Dashboard").Click();
        _wait.Until(d => new Uri(d.Url).AbsolutePath == "/"); H1("Welcome to CareNova");
        Sidebar("About Us").Click();
        _wait.Until(d => d.Url.EndsWith("/about")); H1("About CareNova");
        Assert.That(Sidebar("About Us").GetAttribute("class"), Does.Contain("active"), "About Us is highlighted in the menu");
        Sidebar("Contact Us").Click();
        _wait.Until(d => d.Url.EndsWith("/contact")); H1("Contact CareNova");
        Assert.That(_driver.FindElement(By.Id("inquiry-name")).Displayed, "the inquiry form is on the Contact Us page");
        Shot("contact-us-reached");

        _driver.Navigate().Back();
        _wait.Until(d => d.Url.EndsWith("/about")); H1("About CareNova");
        _driver.Navigate().Forward();
        _wait.Until(d => d.Url.EndsWith("/contact")); H1("Contact CareNova");
        _driver.Navigate().Refresh();
        _wait.Until(d => d.FindElements(By.Id("inquiry-name")).Any());
        Assert.That(_driver.Url, Does.EndWith("/contact"), "a refresh keeps the Contact Us page");
        Sidebar("About Us").Click();
        _wait.Until(d => d.PageSource.Contains("QA mission: accessible care for everyone."));
        _driver.Navigate().Refresh();
        _wait.Until(d => d.PageSource.Contains("QA mission: accessible care for everyone."));
        Assert.That(_driver.Url, Does.EndWith("/about"), "a refresh keeps the About Us page");
        Shot("after-refresh");
    }

    // =============================================================================================================
    // TC-02  Contact Us form required-field and invalid-input validation
    // =============================================================================================================
    [Test, Description("MOCKED API (pharmacy information only; the inquiry endpoint must never be called). Required-field, whitespace, invalid email and invalid phone input are blocked with visible, accessible messages.")]
    public void TC02_ContactFormRequiredFieldAndInvalidInputValidation()
    {
        OpenContact();
        foreach (var (id, type, required, label) in new (string, string?, bool, string)[]
                 { ("inquiry-name", "text", true, "Name"), ("inquiry-email", "email", true, "Email"), ("inquiry-phone", "tel", false, "Phone (optional)"), ("inquiry-subject", "text", true, "Subject"), ("inquiry-message", null, true, "Message") })
        {
            var element = _driver.FindElement(By.Id(id));
            Assert.That(element.Displayed && element.Enabled, id);
            if (type != null) Assert.That(element.GetAttribute("type"), Is.EqualTo(type), id);
            Assert.That(element.GetAttribute("required") != null, Is.EqualTo(required), $"{id} required flag");
            Assert.That(_driver.FindElement(By.CssSelector($"label[for='{id}']")).Text, Does.StartWith(label));
        }
        Shot("form-fields");

        Submit().Click();
        _wait.Until(d => FieldErrors().Count == 4);
        Assert.That(FieldErrors().Select(e => e.Text), Is.EquivalentTo(new[] { "Name is required.", "Email is required.", "Subject is required.", "Message is required." }));
        foreach (var name in new[] { "name", "email", "subject", "message" })
        {
            Assert.That(Field(name).GetAttribute("aria-invalid"), Is.EqualTo("true"), name);
            Assert.That(Field(name).GetAttribute("aria-describedby"), Is.EqualTo($"error-{name}"), name);
            Assert.That(_driver.FindElement(By.Id($"error-{name}")).GetAttribute("role"), Is.EqualTo("alert"), name);
        }
        Shot("required-field-errors");

        foreach (var name in new[] { "name", "email", "subject", "message" }) Type(name, "   ");
        Submit().Click();
        _wait.Until(d => FieldErrors().Count == 4);
        Shot("whitespace-only-errors");

        Type("name", "QA Visitor"); Type("subject", "Opening hours"); Type("message", "Please confirm your opening hours.");
        var badEmails = new[] { "plainaddress", "missing-domain@", "@no-local.test", "no-dot@domain", "two@@example.test", "white space@example.test" };
        var notBlocked = new List<string>();
        foreach (var email in badEmails)
        {
            Type("email", email);
            Submit().Click();
            _wait.Until(d => FieldErrors().Any());
            if (!FieldErrors().Any(e => e.Text == "Enter a valid email address.")) notBlocked.Add(email);
        }
        Assert.That(notBlocked, Is.Empty, "addresses that did not produce the invalid-email message");
        Shot("invalid-email-error");

        Type("email", "qa.visitor@example.test");
        var phoneNotBlocked = new List<string>();
        foreach (var phone in new[] { "call me", "12-ab-3456", "+", "123456", "1234567890123456" })
        {
            Type("phone", phone);
            Submit().Click();
            _wait.Until(d => FieldErrors().Any());
            if (!FieldErrors().Any(e => e.Text == "Enter a valid phone number.")) phoneNotBlocked.Add(phone);
        }
        Assert.That(phoneNotBlocked, Is.Empty, "phone numbers that did not produce the invalid-phone message");
        Shot("invalid-phone-error");

        Assert.That(PostCount(), Is.EqualTo(0), "invalid input must never reach the API");
    }

    // =============================================================================================================
    // TC-03  Duplicate contact form submission prevention
    // =============================================================================================================
    [Test, Description("MOCKED API (the response is held open so the request stays pending). A rapid double-click and repeated Enter presses each send exactly one inquiry request.")]
    public void TC03_DuplicateContactFormSubmissionPrevention()
    {
        // Part A: rapid double-click while the request is pending
        _gate = new ManualResetEventSlim(false);
        QueuePost(201, Created(), "application/json");
        OpenContact();
        FillValid();
        new Actions(_driver).DoubleClick(Submit()).Perform();
        _wait.Until(d => PostCount() >= 1);
        Assert.That(Submit().Text, Is.EqualTo("Sending…"), "pending state is shown");
        Assert.That(Submit().Enabled, Is.False, "the button is disabled while pending");
        Assert.That(Field("name").Enabled, Is.False, "the fields are locked while pending");
        Shot("double-click-pending");
        _gate.Set();
        Success();
        Assert.That(PostCount(), Is.EqualTo(1), "a double-click must send exactly one request");
        Shot("double-click-completed");

        // Part B: repeated Enter key presses (and scripted resubmits) while the request is pending
        var before = PostCount();
        _gate = new ManualResetEventSlim(false);
        QueuePost(201, Created(), "application/json");
        OpenContact();
        FillValid();
        Field("subject").SendKeys(Keys.Enter + Keys.Enter + Keys.Enter);
        _wait.Until(d => PostCount() >= before + 1);
        ((IJavaScriptExecutor)_driver).ExecuteScript("var f=document.querySelector('form.pharmacy-form'); f.requestSubmit(); f.requestSubmit();");
        Assert.That(Submit().Text, Is.EqualTo("Sending…"));
        Shot("enter-key-pending");
        _gate.Set();
        Success();
        Assert.That(PostCount() - before, Is.EqualTo(1), "repeated Enter presses must send exactly one request");
        Shot("enter-key-completed");
    }

    // =============================================================================================================
    // TC-04  Contact form handling of unexpected HTTP 2xx responses (BUG-01)
    // =============================================================================================================
    [Test, Description("MOCKED API (controlled 2xx answers that are NOT the API's confirmation: a Wi-Fi sign-in HTML page with HTTP 200, an empty HTTP 204, and HTTP 200 '{}'). EXPECTED: no 'inquiry received' message, form not cleared, a failure message is shown so the visitor can retry. BUG-01.")]
    public void TC04_UnexpectedHttp2xxResponsesAreNotShownAsSuccess_BUG01()
    {
        var variants = new (string Label, int Status, string Body, string ContentType)[]
        {
            ("HTTP 200 text/html (captive portal page)", 200, "<html><body>Please sign in to the guest Wi-Fi</body></html>", "text/html"),
            ("HTTP 204 no content", 204, "", "application/json"),
            ("HTTP 200 application/json {}", 200, "{}", "application/json"),
        };
        var violations = new List<string>();
        var report = new List<string>();
        foreach (var (label, status, body, contentType) in variants)
        {
            QueuePost(status, body, contentType);
            OpenContact();
            FillValid();
            Submit().Click();
            _wait.Until(d => Present(SuccessCss) || Present(ErrorCss));
            var success = Present(SuccessCss);
            var cleared = new[] { "name", "email", "subject", "message" }.All(n => Value(n) == "");
            var errorShown = Present(ErrorCss);
            Shot($"{status}-{contentType.Replace('/', '-')}");
            report.Add($"{label}: success message shown={success}; form cleared={cleared}; error message shown={errorShown}");
            if (success) violations.Add($"{label}: showed \"{Success().Text}\"");
            if (cleared) violations.Add($"{label}: cleared the visitor's text");
            if (!errorShown) violations.Add($"{label}: showed no error message");
        }
        File.WriteAllLines(Path.Combine(LogDir, "TC04-observed-behaviour.txt"), report);
        Assert.That(violations, Is.Empty,
            "The Contact form accepted a response that did not confirm the inquiry was saved (BUG-01):" + Environment.NewLine + string.Join(Environment.NewLine, violations));
    }

    // =============================================================================================================
    // TC-05  Contact API failure and retry
    // =============================================================================================================
    [Test, Description("MOCKED API (HTTP 503 answered by Selenium interception, then HTTP 201 on retry; NOT a real submission). A 503 shows an error and keeps the entered data and offers 'Retry inquiry'; the retry succeeds, shows the confirmation and resets the form.")]
    public void TC05_ContactApiFailureAndRetry()
    {
        const string unavailable = "This service is temporarily unavailable. Please try again.";
        QueuePost(503, JsonSerializer.Serialize(new { message = unavailable }), "application/json");
        QueuePost(201, Created(), "application/json");
        OpenContact();
        FillValid();
        Shot("form-filled");

        Submit().Click();

        // the 503 shows an error, never a success
        var error = _wait.Until(d => d.FindElements(By.CssSelector(ErrorCss)).FirstOrDefault());
        Assert.That(error!.Text, Is.EqualTo(unavailable), "the server's message is shown to the visitor");
        Assert.That(Present(SuccessCss), Is.False, "a failure must never be shown as success");
        // the entered data is preserved
        Assert.That(Value("name"), Is.EqualTo("QA Visitor"));
        Assert.That(Value("email"), Is.EqualTo("qa.visitor@example.test"));
        Assert.That(Value("phone"), Is.EqualTo("+94 11 234 5678"));
        Assert.That(Value("subject"), Is.EqualTo("Opening hours"));
        Assert.That(Value("message"), Is.EqualTo("Please confirm your opening hours."));
        // the retry button appears and is usable
        Assert.That(Submit().Text, Is.EqualTo("Retry inquiry"));
        Assert.That(Submit().Enabled, Is.True);
        Assert.That(PostCount(), Is.EqualTo(1), "one attempt so far");
        Shot("http-503-error-data-preserved-retry-button");

        Submit().Click();

        // the retry succeeds: confirmation, old error gone, form reset
        _wait.Until(d => Present(SuccessCss));
        Assert.That(Success().Text, Is.EqualTo(Received));
        Assert.That(Present(ErrorCss), Is.False, "the old error disappears after recovery");
        foreach (var name in new[] { "name", "email", "phone", "subject", "message" }) Assert.That(Value(name), Is.Empty, $"{name} is reset after success");
        Assert.That(Submit().Text, Is.EqualTo("Send inquiry"));
        Assert.That(PostCount(), Is.EqualTo(2), "one failed attempt plus one retry");
        List<string> bodies; lock (_lock) bodies = _postBodies.ToList();
        Assert.That(bodies[1], Is.EqualTo(bodies[0]), "the retry resends exactly what the visitor typed");
        Shot("retry-201-success-form-reset");
    }

    // ------------------------------------------------------------------------------------------------ interception
    private HttpResponseData Supply(HttpRequestData request)
    {
        var uri = new Uri(request.Url!);
        var path = uri.AbsolutePath.TrimEnd('/');
        var method = request.Method ?? "GET";
        if (method.Equals("OPTIONS", StringComparison.OrdinalIgnoreCase)) return Respond(204, "", "application/json");

        if (method == "POST" && path.Equals("/api/public/contact-inquiries", StringComparison.OrdinalIgnoreCase))
        {
            lock (_lock) _postBodies.Add(request.PostData ?? "");
            _gate?.Wait(TimeSpan.FromSeconds(25));
            return _postResponses.TryDequeue(out var next) ? Respond(next.Status, next.Body, next.ContentType) : Respond(500, "{\"message\":\"No controlled response queued.\"}", "application/json");
        }
        if (method == "GET" && path.Equals("/api/public/pharmacy-information", StringComparison.OrdinalIgnoreCase)) return Respond(200, JsonSerializer.Serialize(Information), "application/json");
        if (method == "GET" && path.Equals("/api/public/home", StringComparison.OrdinalIgnoreCase))
            return Respond(200, JsonSerializer.Serialize(new { introduction = "QA home introduction.", services = Array.Empty<object>(), featuredMedicines = Array.Empty<object>(), featuredDoctors = Array.Empty<object>(), notices = Array.Empty<object>() }), "application/json");
        return Respond(200, "[]", "application/json");
    }

    private static HttpResponseData Respond(int status, string body, string contentType)
    {
        var r = new HttpResponseData { StatusCode = status, Body = body };
        r.Headers["Access-Control-Allow-Origin"] = BaseUrl;
        r.Headers["Access-Control-Allow-Headers"] = "authorization, content-type";
        r.Headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
        r.Headers["Content-Type"] = contentType;
        return r;
    }

    private void QueuePost(int status, string body, string contentType) => _postResponses.Enqueue((status, body, contentType));
    private static string Created() => JsonSerializer.Serialize(new { id = Guid.NewGuid(), submittedAtUtc = DateTime.UtcNow, message = Received });
    private int PostCount() { lock (_lock) return _postBodies.Count; }

    // ------------------------------------------------------------------------------------------------ page helpers
    private void Go(string path) => _driver.Navigate().GoToUrl($"{BaseUrl}{path}");
    private IWebElement H1(string text) => _wait.Until(d => d.FindElements(By.CssSelector("h1")).FirstOrDefault(h => h.Text.Contains(text)));
    private IWebElement Sidebar(string label) => _wait.Until(d => d.FindElement(By.XPath($"//nav[contains(@class,'sidebar-nav')]//a[normalize-space()='{label}']")));
    private IWebElement Field(string name) => _driver.FindElement(By.Id($"inquiry-{name}"));
    private IWebElement Submit() => _driver.FindElement(By.CssSelector("form.pharmacy-form button.primary-action"));
    private IReadOnlyCollection<IWebElement> FieldErrors() => _driver.FindElements(By.CssSelector(".field-error"));
    private string Value(string name) => Field(name).GetAttribute("value") ?? "";
    private static string ErrorCss => "section:has(form.pharmacy-form) .management-alert.error";
    private static string SuccessCss => "section:has(form.pharmacy-form) .management-alert.success";
    private bool Present(string css) => _driver.FindElements(By.CssSelector(css)).Any();
    private IWebElement Success() => _wait.Until(d => d.FindElements(By.CssSelector(SuccessCss)).FirstOrDefault());

    private void OpenContact()
    {
        Go("/contact");
        _wait.Until(d => d.FindElements(By.Id("inquiry-name")).Any());
        _wait.Until(d => d.PageSource.Contains("12 Galle Road, Colombo")); // pharmacy information finished loading
    }

    private void Type(string name, string value) { var e = Field(name); e.Clear(); e.SendKeys(value); }
    private void FillValid() { Type("name", "QA Visitor"); Type("email", "qa.visitor@example.test"); Type("phone", "+94 11 234 5678"); Type("subject", "Opening hours"); Type("message", "Please confirm your opening hours."); }

    private void Shot(string step) => Save($"{TestContext.CurrentContext.Test.Name}-{++_shots:00}-{step}");
    private void Save(string file) { Directory.CreateDirectory(ShotDir); ((ITakesScreenshot)_driver).GetScreenshot().SaveAsFile(Path.Combine(ShotDir, file + ".png")); }
}
