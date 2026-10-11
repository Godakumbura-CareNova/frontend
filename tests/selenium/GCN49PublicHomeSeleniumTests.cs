using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.RegularExpressions;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.SeleniumTests;

/// <summary>
/// GCN-49 Public Home Page final regression suite: exactly six Selenium test cases in real Chrome against the locally running frontend (http://localhost:3000).
///
/// API MODES (each test says which one it uses in its [Description]):
///   REAL   - NO interception. Chrome talks to the REAL GCN-49 backend on http://localhost:5136. The real pharmacy and doctor
///            services are out of scope, so the backend's upstream calls go to a STUB UPSTREAM on :5199 (qa-reports/GCN-49/selenium/upstream-stub.py)
///            that the tests switch between healthy / down / slow / malformed. If the real backend or the stub is not running the test is BLOCKED.
///   MOCKED - Selenium network interception answers every call to the CareNova API ports (5133-5136) with a controlled response.
///
///   TC-01 Public Home Page accessible without login            REAL backend (+ stub upstream)
///   TC-02 Home Page content, services, notices, featured       MOCKED
///   TC-03 Public navigation: medicines, doctors, unknown route MOCKED
///   TC-04 Loading, API failure and Retry                       REAL backend (+ stub upstream)
///   TC-05 Partial upstream failure and recovery                REAL backend (+ stub upstream)
///   TC-06 Responsive layout: desktop, tablet, mobile           REAL backend (+ stub upstream)
///   (the original TC-06 "Guest access and HTTP 401 handling" that reproduces GCN49-FE-01 now lives in GCN49KnownDefectFE01Tests, outside this suite)
/// </summary>
[TestFixture]
[NonParallelizable]
[Category("GCN49Final")]
public class GCN49PublicHomeSeleniumTests
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
    // TC-01  Public Home Page accessible without login (REAL backend + stub upstream)
    // =============================================================================================================
    [Test, Description("REAL backend (:5136) + stub upstream (:5199). A visitor with no session opens '/' and gets the Public Home Page with live content, not the login page.")]
    public async Task TC01_PublicHomePageIsAccessibleWithoutLogin()
    {
        await RequireRealEnvironment();
        await Start(mocked: false);

        Go("/");
        _wait.Until(d => d.FindElements(By.XPath("//h2[normalize-space()='Our services']")).Any());
        Shot("home-page-guest");

        Assert.That(new Uri(_driver.Url).AbsolutePath, Is.EqualTo("/"), "the visitor must stay on the home page, not be redirected to login");
        Assert.That(_driver.FindElement(By.CssSelector("h1")).Text, Does.Contain("Welcome to CareNova"));
        Assert.That(Js<string?>("return localStorage.getItem('carenova_token');"), Is.Null, "no session exists");
        Assert.That(_driver.FindElement(By.LinkText("Login")).GetAttribute("href"), Does.EndWith("/login"));
        Assert.That(_driver.FindElement(By.LinkText("Register")).GetAttribute("href"), Does.EndWith("/register"));
        Assert.That(_driver.FindElements(By.XPath("//button[contains(normalize-space(),'Logout')]")), Is.Empty, "no logout for a visitor");
        Assert.That(_driver.FindElements(By.CssSelector("button[aria-label='Notifications']")), Is.Empty, "no notification bell for a visitor");

        // content served by the REAL backend (configured in publiccontent.json) plus featured items it fetched from the stub upstream
        foreach (var heading in new[] { "Welcome to CareNova pharmacy", "Our services", "Featured medicines", "Featured doctors", "Notices & announcements" })
            Assert.That(_driver.FindElements(By.XPath($"//h2[normalize-space()='{heading}']")), Is.Not.Empty, heading);
        foreach (var service in new[] { "Pharmacy services", "Healthcare professionals", "Patient services" })
            Assert.That(_driver.FindElements(By.XPath($"//h3[normalize-space()='{service}']")), Is.Not.Empty, service);
        Assert.That(_driver.FindElements(By.XPath("//h3[normalize-space()='Prescription medicines']")), Is.Not.Empty, "configured notice");
        foreach (var featured in new[] { "Vitamin C", "Amoxicillin", "Dr Silva" })
            Assert.That(_driver.FindElements(By.XPath($"//a[contains(@class,'quicklink-card')]//h3[normalize-space()='{featured}']")), Is.Not.Empty, featured);
        Assert.That(_driver.FindElements(By.CssSelector("section[role='alert']")), Is.Empty, "no error while everything is healthy");

        // no authentication service was contacted: only the public home API of the backend
        var contacted = Js<string>("return performance.getEntriesByType('resource').map(e => e.name).filter(n => /:51\\d\\d\\//.test(n)).join('\\n');");
        File.WriteAllText(Path.Combine(LogDir, "TC01-api-calls-made-by-the-browser.txt"), contacted);
        Assert.That(contacted, Does.Not.Contain(":5133"), "a visitor must not trigger any call to the authentication service");
        Assert.That(contacted, Does.Contain(":5136/api/public/home"));
    }

    // =============================================================================================================
    // TC-02  Home Page content, services, notices and featured sections (MOCKED)
    // =============================================================================================================
    [Test, Description("MOCKED API (controlled /api/public/home response). Services, notices and featured medicines and doctors render with the right details, links and plain-text safety.")]
    public async Task TC02_HomePageContentServicesNoticesAndFeaturedSections()
    {
        await Start(mocked: true);
        Go("/");
        _wait.Until(d => d.FindElements(By.XPath("//h2[normalize-space()='Our services']")).Any());
        Shot("full-content");

        Assert.That(BodyText(), Does.Contain("QA introduction: CareNova connects you with pharmacy services."));
        foreach (var service in new[] { "QA Pharmacy services", "QA Healthcare professionals", "QA Patient services" }) Assert.That(_driver.FindElements(By.XPath($"//h3[normalize-space()='{service}']")), Is.Not.Empty, service);
        Assert.That(_driver.FindElements(By.XPath("//h2[normalize-space()='Notices & announcements']/..//article")), Has.Count.EqualTo(2));
        Assert.That(BodyText(), Does.Contain("Closed on public holidays."));

        var vitamin = Card("QA Vitamin C");
        Assert.That(vitamin.GetAttribute("href"), Does.EndWith("/patient/medicines/1"));
        Assert.That(vitamin.Text, Does.Contain("Vitamins").And.Contain("LKR 200.00").And.Contain("In stock"));
        Assert.That(vitamin.Text, Does.Not.Contain("Prescription required"));
        var amoxicillin = Card("QA Amoxicillin");
        Assert.That(amoxicillin.Text, Does.Contain("LKR 450.50").And.Contain("Prescription required").And.Contain("Low stock"));
        var doctor = _driver.FindElement(By.XPath("//a[contains(@class,'quicklink-card')][.//h3[contains(.,'QA Dr Silva')]]"));
        Assert.That(doctor.GetAttribute("href"), Does.EndWith("/patient/doctors/a%2Fb%20c"), "ids are URL-encoded");
        Assert.That(doctor.Text, Does.Contain("<b>MBBS</b>"), "markup in names is shown as text, not interpreted");
        Assert.That(doctor.Text, Does.Contain("Cardiologist").And.Contain("Consultation: LKR 4500.00").And.Contain("3 open slots"));
        Assert.That(_driver.FindElement(By.LinkText("Browse all medicines →")).GetAttribute("href"), Does.EndWith("/patient/medicines"));
        Assert.That(_driver.FindElement(By.LinkText("Browse all doctors →")).GetAttribute("href"), Does.EndWith("/patient/doctors"));
        Assert.That(_driver.FindElements(By.CssSelector("b")).Any(b => b.Text == "MBBS"), Is.False, "no injected <b> element");
        Assert.That(_driver.FindElements(By.CssSelector("section[role='alert']")), Is.Empty);

        // empty featured sections and no notices: honest placeholders
        _home = new { introduction = "QA introduction", services = Array.Empty<object>(), notices = Array.Empty<object>(), featuredMedicines = Array.Empty<object>(), featuredDoctors = Array.Empty<object>(), sectionErrors = Array.Empty<string>() };
        _driver.Navigate().Refresh();
        _wait.Until(d => d.PageSource.Contains("No announcements at the moment."));
        Assert.That(BodyText(), Does.Contain("No medicines are available to display yet.").And.Contain("No doctors are available to display yet."));
        Shot("empty-sections");
    }

    // =============================================================================================================
    // TC-03  Public navigation to medicines, doctors and unknown routes (MOCKED)
    // =============================================================================================================
    [Test, Description("MOCKED API (home content and empty catalogue/doctor lists). A guest navigates from the home page to the public medicines and doctors pages, their short aliases, and an unknown route's not-found page.")]
    public async Task TC03_PublicNavigationToMedicinesDoctorsAndUnknownRoutes()
    {
        await Start(mocked: true);
        Go("/");
        H1("Welcome to CareNova");

        Sidebar("Medicines").Click();
        _wait.Until(d => d.Url.EndsWith("/patient/medicines"));
        H1("Medicine Catalogue");
        Assert.That(_driver.FindElement(By.LinkText("Login")).Displayed, "the guest header stays");
        Shot("medicines-page");

        Sidebar("Doctors").Click();
        _wait.Until(d => d.Url.EndsWith("/patient/doctors"));
        H1("Find a Doctor");
        Shot("doctors-page");

        Sidebar("Dashboard").Click();
        _wait.Until(d => new Uri(d.Url).AbsolutePath == "/");
        H1("Welcome to CareNova");
        _wait.Until(d => d.FindElements(By.XPath("//h2[normalize-space()='Our services']")).Any());
        _driver.FindElement(By.LinkText("Browse all medicines →")).Click();
        _wait.Until(d => d.Url.EndsWith("/patient/medicines"));
        _driver.Navigate().Back();
        H1("Welcome to CareNova");

        Go("/medicines"); H1("Medicine Catalogue");          // public aliases
        Go("/doctors"); H1("Find a Doctor");

        Go("/this-page-does-not-exist");
        _wait.Until(d => d.PageSource.Contains("Page not found"));
        Assert.That(BodyText(), Does.Contain("This link is unavailable."));
        Shot("unknown-route");
        Go("/patient/not-a-real-page");
        _wait.Until(d => d.PageSource.Contains("Page not found"));
        _driver.FindElement(By.LinkText("Back to home")).Click();
        H1("Welcome to CareNova");
        Assert.That(new Uri(_driver.Url).AbsolutePath, Is.EqualTo("/"));
    }

    // =============================================================================================================
    // TC-04  Loading, API failure and Retry (REAL backend + stub upstream)
    // =============================================================================================================
    [Test, Description("REAL backend (:5136) + stub upstream (:5199). Shows the loading status while the real backend waits for a slow upstream; then the real backend answers HTTP 503 (the upstream returns a bare JSON array, which is the GCN49-BUG-01 trigger) and the page shows its error panel; Retry recovers once the upstream is healthy.")]
    public async Task TC04_LoadingApiFailureAndRetry()
    {
        await RequireRealEnvironment();
        await Start(mocked: false);

        // loading: the real backend is waiting for a slow upstream
        await StubMode("slow", "ok", delay: 3000);
        Go("/");
        var status = _wait.Until(d => d.FindElements(By.CssSelector("p[role='status']")).FirstOrDefault());
        Assert.That(status!.Text, Is.EqualTo("Loading pharmacy information…"));
        Assert.That(_driver.FindElement(By.CssSelector("h1")).Text, Does.Contain("Welcome to CareNova"), "the page frame is already usable");
        Assert.That(_driver.FindElements(By.CssSelector("section[role='alert']")), Is.Empty);
        Assert.That(_driver.FindElements(By.XPath("//h2[normalize-space()='Our services']")), Is.Empty, "no content before the data arrives");
        Shot("loading");
        _wait.Until(d => d.FindElements(By.XPath("//h2[normalize-space()='Our services']")).Any());
        Assert.That(_driver.FindElements(By.CssSelector("p[role='status']")), Is.Empty, "the loading status disappears");

        // failure: the REAL backend answers 503 for the whole page
        await StubMode("array", "ok");
        Go("/");
        var panel = _wait.Until(d => d.FindElements(By.CssSelector("section[role='alert']")).FirstOrDefault());
        Shot("api-failure-503");
        File.WriteAllText(Path.Combine(LogDir, "TC04-notes.txt"),
            "Step 2 used the REAL backend: with the stub upstream returning a bare JSON array for medicines the backend answered HTTP 503 for the whole page (GCN49-BUG-01, documented separately).\n" +
            "This test checks the FRONTEND behaviour for that failure: error panel, Retry, no misleading content, recovery.\n");
        Assert.That(panel!.Text, Does.Contain("We couldn’t load the home page information."));
        Assert.That(panel.FindElement(By.TagName("button")).Text, Is.EqualTo("Retry"));
        Assert.That(_driver.FindElements(By.XPath("//h2[normalize-space()='Featured medicines' or normalize-space()='Our services']")), Is.Empty, "no content or empty-state text is shown for a failed request");
        Assert.That(BodyText(), Does.Not.Contain("No medicines are available to display yet."));
        Assert.That(_driver.FindElement(By.LinkText("Login")).Displayed, "the visitor can still log in");

        // recovery: the upstream is healthy again, Retry reloads the page content
        await StubMode("ok", "ok");
        panel.FindElement(By.TagName("button")).Click();
        _wait.Until(d => d.FindElements(By.XPath("//h2[normalize-space()='Our services']")).Any());
        Assert.That(_driver.FindElements(By.CssSelector("section[role='alert']")), Is.Empty);
        Assert.That(_driver.FindElements(By.XPath("//a[contains(@class,'quicklink-card')]//h3[normalize-space()='Vitamin C']")), Is.Not.Empty);
        Shot("recovered");
    }

    // =============================================================================================================
    // TC-05  Partial upstream failure and recovery (REAL backend + stub upstream)
    // =============================================================================================================
    [Test, Description("REAL backend (:5136) + stub upstream (:5199). Doctors upstream down: the real backend answers 200 with a section error and the page keeps medicines; Retry after the upstream heals shows doctors. Then both down, then both healthy.")]
    public async Task TC05_PartialUpstreamFailureAndRecovery()
    {
        await RequireRealEnvironment();
        await Start(mocked: false);

        // doctors upstream down, medicines healthy
        await StubMode("ok", "down");
        Go("/");
        _wait.Until(d => d.FindElements(By.XPath("//h2[normalize-space()='Featured medicines']")).Any());
        Shot("partial-doctors-down");
        Assert.That(BodyText(), Does.Contain("Featured doctors are temporarily unavailable."));
        Assert.That(BodyText(), Does.Not.Contain("Featured medicines are temporarily unavailable."));
        Assert.That(_driver.FindElements(By.XPath("//a[contains(@class,'quicklink-card')]//h3[normalize-space()='Vitamin C']")), Is.Not.Empty, "healthy medicines are kept");
        Assert.That(_driver.FindElements(By.XPath("//a[contains(@class,'quicklink-card')]//h3[normalize-space()='Dr Silva']")), Is.Empty);
        Assert.That(_driver.FindElements(By.XPath("//h3[normalize-space()='Pharmacy services']")), Is.Not.Empty, "configured content is kept");
        Assert.That(_driver.FindElements(By.XPath("//section[@role='alert']//button[normalize-space()='Retry']")), Has.Count.EqualTo(1));

        // upstream heals; Retry brings the doctors in and clears the message
        await StubMode("ok", "ok");
        _driver.FindElement(By.XPath("//section[@role='alert']//button[normalize-space()='Retry']")).Click();
        _wait.Until(d => d.FindElements(By.XPath("//a[contains(@class,'quicklink-card')]//h3[normalize-space()='Dr Silva']")).Any());
        Assert.That(BodyText(), Does.Not.Contain("temporarily unavailable"));
        Assert.That(_driver.FindElements(By.CssSelector("section[role='alert']")), Is.Empty);
        Shot("recovered-doctors");

        // both upstreams down: two messages, one Retry, configured content still shown
        await StubMode("down", "down");
        _driver.Navigate().Refresh();
        _wait.Until(d => d.FindElements(By.CssSelector("section[role='alert']")).Any());
        Assert.That(BodyText(), Does.Contain("Featured medicines are temporarily unavailable.").And.Contain("Featured doctors are temporarily unavailable."));
        Assert.That(_driver.FindElements(By.XPath("//h3[normalize-space()='Healthcare professionals']")), Is.Not.Empty);
        Shot("both-down");
        await StubMode("ok", "ok");
        _driver.FindElement(By.XPath("//section[@role='alert']//button[normalize-space()='Retry']")).Click();
        _wait.Until(d => d.FindElements(By.XPath("//a[contains(@class,'quicklink-card')]//h3[normalize-space()='Amoxicillin']")).Any());
        Assert.That(_driver.FindElements(By.XPath("//a[contains(@class,'quicklink-card')]//h3[normalize-space()='Dr Silva']")), Is.Not.Empty);
        Assert.That(_driver.FindElements(By.CssSelector("section[role='alert']")), Is.Empty);
        Shot("fully-recovered");
    }

    // =============================================================================================================
    // TC-06  Responsive layout at desktop, tablet and mobile (REAL backend + stub upstream)
    // =============================================================================================================
    [Test, Description("REAL backend (:5136) + stub upstream (:5199). The Public Home Page at desktop (1440), tablet (768) and mobile (375) widths: no horizontal overflow, content and controls inside the screen, nothing overlapping or covered, menu and header navigation usable.")]
    public async Task TC06_ResponsiveLayoutAtDesktopTabletAndMobile()
    {
        await RequireRealEnvironment();
        await Start(mocked: false);
        var chrome = (ChromeDriver)_driver;
        var problems = new List<string>();
        var measurements = new List<string>();

        foreach (var (name, width, height, mobile) in new[] { ("desktop", 1440, 900, false), ("tablet", 768, 1024, false), ("mobile", 375, 812, true) })
        {
            // real device-metrics emulation (headless Chrome cannot shrink its window below ~500 px)
            chrome.ExecuteCdpCommand("Emulation.setDeviceMetricsOverride", new Dictionary<string, object> { ["width"] = width, ["height"] = height, ["deviceScaleFactor"] = 1, ["mobile"] = mobile });
            Go("/"); // a fresh load, because the layout decides its initial menu state from the width
            _wait.Until(d => d.FindElements(By.XPath("//h2[normalize-space()='Featured doctors']")).Any());
            Assert.That(Js<long>("return window.innerWidth;"), Is.EqualTo(width), $"{name}: the emulated viewport really is {width}px wide");
            Shot($"{name}-home");

            // 1. no horizontal overflow
            var scrollWidth = Js<long>("return Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);");
            var examined = Js<long>("return document.querySelectorAll('header a, header button, main a, main button, main h1, main h2, main h3').length;");
            var cards = Js<long>("return document.querySelectorAll('main .stat-card, main .quicklink-card').length;");
            measurements.Add($"{name} {width}x{height}: scrollWidth={scrollWidth}; controls/headings examined={examined}; cards checked for overlap={cards}");
            Assert.That(examined, Is.GreaterThan(10), $"{name}: the layout checks must examine real content");
            if (scrollWidth > width + 1) problems.Add($"{name}: the page scrolls horizontally ({scrollWidth}px content in a {width}px screen)");

            // 2. every visible control and heading of the header and main area lies inside the screen
            var clipped = JsList(@"var out=[]; document.querySelectorAll('header a, header button, main a, main button, main h1, main h2, main h3').forEach(function(e){
                var cs=getComputedStyle(e), r=e.getBoundingClientRect(); if(cs.display==='none'||cs.visibility==='hidden'||(r.width===0&&r.height===0)) return;
                if(r.right>window.innerWidth+1||r.left<-1) out.push(((e.innerText||e.getAttribute('aria-label')||e.tagName)+'').trim().replace(/\s+/g,' ').slice(0,40)+' ['+Math.round(r.left)+'..'+Math.round(r.right)+']'); }); return out;");
            if (clipped.Count > 0) problems.Add($"{name}: content or controls outside the screen: {string.Join("; ", clipped)}");

            // 3. nothing overlaps: cards among themselves and the header controls among themselves
            var overlaps = JsList(@"function ov(sel){var els=[].slice.call(document.querySelectorAll(sel)).filter(function(e){var r=e.getBoundingClientRect();return r.width>0&&r.height>0;}),out=[];
                for(var i=0;i<els.length;i++)for(var j=i+1;j<els.length;j++){var a=els[i].getBoundingClientRect(),b=els[j].getBoundingClientRect();
                  var w=Math.min(a.right,b.right)-Math.max(a.left,b.left),h=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
                  if(w>2&&h>2&&!els[i].contains(els[j])&&!els[j].contains(els[i])) out.push(((els[i].innerText||'').trim().slice(0,25)+' / '+(els[j].innerText||'').trim().slice(0,25)).replace(/\s+/g,' '));} return out;}
                return ov('main .stat-card, main .quicklink-card').concat(ov('header a, header button'));");
            if (overlaps.Count > 0) problems.Add($"{name}: overlapping elements: {string.Join("; ", overlaps)}");

            // 4. headings are not covered by anything (checked at the heading's centre once scrolled into view)
            var covered = JsList(@"var out=[]; document.querySelectorAll('main h1, main h2').forEach(function(h){h.scrollIntoView({block:'center'}); var r=h.getBoundingClientRect(),t=document.elementFromPoint(r.left+Math.min(r.width/2,40),r.top+r.height/2);
                if(!(t===h||h.contains(t))) out.push(h.innerText.trim().slice(0,40)+' covered by '+(t?t.tagName+'.'+t.className:'nothing')); }); window.scrollTo(0,0); return out;");
            if (covered.Count > 0) problems.Add($"{name}: headings covered by other elements: {string.Join("; ", covered)}");

            // 5. header navigation: Login and Register are visible, inside the screen and really clickable
            foreach (var label in new[] { "Login", "Register" })
            {
                var link = _driver.FindElement(By.LinkText(label));
                var hit = (bool)((IJavaScriptExecutor)_driver).ExecuteScript("var r=arguments[0].getBoundingClientRect(),t=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return r.width>0&&r.right<=window.innerWidth+1&&r.left>=-1&&(t===arguments[0]||arguments[0].contains(t));", link)!;
                if (!hit) problems.Add($"{name}: the {label} link is hidden, clipped or covered");
            }

            // 6. menu navigation: permanent sidebar on desktop, a menu button on tablet and mobile; the menu reaches the Medicines page
            if (width > 900)
            {
                if (!SidebarLinkHittable("Medicines")) problems.Add($"{name}: the sidebar Medicines link is not clickable");
            }
            else
            {
                var openers = _driver.FindElements(By.CssSelector("button[aria-label='Open menu']"));
                if (openers.Count == 0) { problems.Add($"{name}: no menu button is offered although the sidebar is hidden"); continue; }
                if (SidebarLinkHittable("Medicines")) problems.Add($"{name}: the menu should start closed on a narrow screen");
                openers[0].Click();
                _wait.Until(d => SidebarLinkHittable("Medicines"));
                Shot($"{name}-menu-open");
            }
            Sidebar("Medicines").Click();
            if (!TryWait(d => d.Url.EndsWith("/patient/medicines"))) { problems.Add($"{name}: the Medicines menu link did not navigate"); continue; }
            if (!TryWait(d => d.FindElements(By.CssSelector("h1")).Any(h => h.Text.Contains("Medicine Catalogue")))) problems.Add($"{name}: the Medicine Catalogue page did not open");
            Shot($"{name}-medicines-page");
            var scrollAfter = Js<long>("return Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);");
            if (scrollAfter > width + 1) problems.Add($"{name}: the Medicine Catalogue page scrolls horizontally ({scrollAfter}px in {width}px)");
        }

        File.WriteAllLines(Path.Combine(LogDir, "TC06-responsive-measurements.txt"), measurements.Concat(new[] { problems.Count == 0 ? "no layout problems found" : "PROBLEMS:" }).Concat(problems));
        Assert.That(problems, Is.Empty, "Responsive layout problems:" + Environment.NewLine + string.Join(Environment.NewLine, problems));
    }

    // ------------------------------------------------------------------------------------------------ page helpers
    private void Go(string path) => _driver.Navigate().GoToUrl($"{BaseUrl}{path}");
    private string BodyText() => _driver.FindElement(By.TagName("body")).Text;
    private string MainText() => _driver.FindElement(By.CssSelector("main")).Text;
    private static string Squash(string text) => Regex.Replace(text, @"\s+", " ").Trim();
    private static string FirstMatchingLine(string text, string needle) => text.Split('\n').FirstOrDefault(l => l.Contains(needle))?.Trim() ?? needle;
    private T Js<T>(string script) => (T)((IJavaScriptExecutor)_driver).ExecuteScript(script)!;
    private List<string> JsList(string script) => ((System.Collections.IEnumerable)((IJavaScriptExecutor)_driver).ExecuteScript(script)!).Cast<object>().Select(o => o.ToString()!).ToList();
    private bool TryWait(Func<IWebDriver, bool> condition) { try { return _wait.Until(condition); } catch (WebDriverTimeoutException) { return false; } }
    // true only when the sidebar link is on screen and really receives the click (the drawer animates and clips its content while opening)
    private bool SidebarLinkHittable(string label)
    {
        var links = _driver.FindElements(By.XPath($"//nav[contains(@class,'sidebar-nav')]//a[normalize-space()='{label}']"));
        return links.Count > 0 && (bool)((IJavaScriptExecutor)_driver).ExecuteScript("var a=arguments[0],r=a.getBoundingClientRect(),t=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return r.width>0&&r.left>=0&&r.right<=window.innerWidth&&(t===a||a.contains(t));", links[0])!;
    }
    private IWebElement H1(string text) => _wait.Until(d => d.FindElements(By.CssSelector("h1")).FirstOrDefault(h => h.Text.Contains(text)));
    private IWebElement Sidebar(string label) => _wait.Until(d => d.FindElement(By.XPath($"//nav[contains(@class,'sidebar-nav')]//a[normalize-space()='{label}']")));
    private IWebElement Card(string name) => _driver.FindElement(By.XPath($"//a[contains(@class,'quicklink-card')][.//h3[normalize-space()='{name}']]"));
    private void Shot(string step) => Save($"{TestContext.CurrentContext.Test.Name}-{++_shots:00}-{step}");
    private void Save(string file) { Directory.CreateDirectory(ShotDir); ((ITakesScreenshot)_driver).GetScreenshot().SaveAsFile(Path.Combine(ShotDir, file + ".png")); }
}
