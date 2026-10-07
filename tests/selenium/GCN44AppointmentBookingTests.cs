using System.Text;
using System.Text.Json;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.DevTools;
using OpenQA.Selenium.Support.UI;

namespace CareNova.SeleniumTests;

/// <summary>
/// GCN-44 browser/UI tests for the patient appointment booking page.
///
/// SCOPE: these tests verify the FRONTEND booking page only. Every backend call the page makes
/// (doctor profile with slots, and POST /api/appointments) is answered by Selenium's network
/// interception, so they do NOT validate the real doctor-payment service, the appointment-integration
/// API, the database, or cross-service integration.
///
/// Requires only the Vite dev server on http://localhost:3000 (CARENOVA_BASE_URL can override it).
/// No real login or password is used: a locally generated, unsigned placeholder token is placed in
/// localStorage, which is all the frontend's AuthContext reads when restoring a session.
/// </summary>
[TestFixture]
[NonParallelizable]
public class GCN44AppointmentBookingTests
{
    private static readonly string BaseUrl =
        Environment.GetEnvironmentVariable("CARENOVA_BASE_URL") ?? "http://localhost:3000";

    private const string DoctorId = "22222222-2222-2222-2222-222222222222";
    private const string DoctorName = "Nimal Perera";
    private const string AppointmentReference = "CN-APT-QA0044TEST";
    private const string AlreadyBookedMessage = "This appointment slot has already been booked.";

    // Mid-day UTC slots, so the calendar date is the same in any timezone from UTC-11 to UTC+11.
    private static readonly DateTime Day1 = DateTime.UtcNow.Date.AddDays(14);
    private static readonly DateTime Day2 = DateTime.UtcNow.Date.AddDays(16);

    private readonly (int Id, DateTime Start, DateTime End)[] _slots =
    {
        (101, Day1.AddHours(9), Day1.AddHours(9).AddMinutes(20)),
        (102, Day1.AddHours(10), Day1.AddHours(10).AddMinutes(20)),
        (201, Day2.AddHours(11), Day2.AddHours(11).AddMinutes(20)),
    };

    private IWebDriver _driver = null!;
    private WebDriverWait _wait = null!;
    private INetwork _network = null!;

    // Controlled responses for the intercepted backend calls.
    private int _bookingStatusCode;
    private string _bookingBody = "{}";
    private int _bookingPostCount;
    private int _doctorGetCount;
    private int _doctorGetsAfterBooking;

    [SetUp]
    public async Task SetUp()
    {
        _bookingPostCount = 0;
        _doctorGetCount = 0;
        _doctorGetsAfterBooking = 0;
        _bookingStatusCode = 201;
        _bookingBody = BookedAppointmentJson();

        var options = new ChromeOptions();
        options.AddArgument("--headless");
        options.AddArgument("--window-size=1400,900");

        _driver = new ChromeDriver(options);
        _wait = new WebDriverWait(_driver, TimeSpan.FromSeconds(15));
        _wait.IgnoreExceptionTypes(typeof(StaleElementReferenceException));

        _network = _driver.Manage().Network;
        _network.AddRequestHandler(new NetworkRequestHandler
        {
            // Only the CareNova API ports are intercepted; the Vite app on :3000 is served normally.
            RequestMatcher = request => IsApiRequest(request.Url!),
            ResponseSupplier = SupplyResponse,
        });
        await _network.StartMonitoring();

        SignInAsPatientWithoutRealLogin();
    }

    [TearDown]
    public async Task TearDown()
    {
        try
        {
            if (_network != null)
            {
                await _network.StopMonitoring();
            }
        }
        catch
        {
            // best effort
        }

        _driver?.Quit();
        _driver?.Dispose();
    }

    // ---------------------------------------------------------------------------------------
    // GCN44-SEL-01  Available dates and time slots are displayed
    // ---------------------------------------------------------------------------------------
    [Test]
    public void GCN44_SEL_01_AvailableDatesAndTimeSlotsAreDisplayed()
    {
        OpenBookingPage();

        Assert.That(_driver.FindElement(By.CssSelector(".dp-hero-name")).Text, Does.Contain(DoctorName));
        Assert.That(_driver.PageSource, Does.Contain("Select appointment date"));

        // Two distinct dates are available; no time slots are shown until a date is chosen.
        Assert.That(DateButtons().Count, Is.EqualTo(2), "one button per distinct available date");
        Assert.That(_driver.PageSource, Does.Not.Contain("Select appointment time"));

        DateButtons()[0].Click();

        _wait.Until(d => d.PageSource.Contains("Select appointment time"));
        Assert.That(TimeButtons().Count, Is.EqualTo(2), "the first date has two time slots");
        Assert.That(TimeButtons()[0].Text, Does.Contain("–"), "slot shows a start – end range");
    }

    // ---------------------------------------------------------------------------------------
    // GCN44-SEL-02  Patient can select a date and an available time slot
    // ---------------------------------------------------------------------------------------
    [Test]
    public void GCN44_SEL_02_PatientCanSelectDateAndTimeSlot()
    {
        OpenBookingPage();

        var dateButton = DateButtons()[0];
        dateButton.Click();
        _wait.Until(d => HasClass(DateButtons()[0], "selected"));

        var slotButtons = TimeButtons();
        slotButtons[1].Click();

        _wait.Until(d => HasClass(TimeButtons()[1], "selected"));
        Assert.That(HasClass(TimeButtons()[0], "selected"), Is.False, "only the chosen slot is marked selected");

        // Choosing another date resets the slot selection.
        DateButtons()[1].Click();
        _wait.Until(d => HasClass(DateButtons()[1], "selected"));
        Assert.That(TimeButtons().Any(b => HasClass(b, "selected")), Is.False);
    }

    // ---------------------------------------------------------------------------------------
    // GCN44-SEL-03  Confirming without the required selection shows validation, no booking
    // ---------------------------------------------------------------------------------------
    [Test]
    public void GCN44_SEL_03_ConfirmWithoutSelectionShowsValidationAndDoesNotBook()
    {
        OpenBookingPage();

        ConfirmButton().Click();

        var alert = _wait.Until(d => d.FindElements(By.CssSelector(".alert.alert-error")).FirstOrDefault());
        Assert.That(alert!.Text, Does.Contain("Please select a doctor, appointment date, and time slot."));

        // A date alone is still not enough.
        DateButtons()[0].Click();
        ConfirmButton().Click();
        Assert.That(
            _driver.FindElement(By.CssSelector(".alert.alert-error")).Text,
            Does.Contain("Please select a doctor, appointment date, and time slot."));

        Assert.That(_driver.PageSource, Does.Not.Contain("Appointment booked successfully"));
        Assert.That(_bookingPostCount, Is.EqualTo(0), "no booking request may be sent");
    }

    // ---------------------------------------------------------------------------------------
    // GCN44-SEL-04  Successful booking shows reference, doctor, date, time and status
    // ---------------------------------------------------------------------------------------
    [Test]
    public void GCN44_SEL_04_SuccessfulBookingDisplaysAppointmentDetails()
    {
        OpenBookingPage();

        DateButtons()[0].Click();
        _wait.Until(d => TimeButtons().Count == 2);
        TimeButtons()[0].Click();
        ConfirmButton().Click();

        _wait.Until(d => d.PageSource.Contains("Appointment booked successfully"));

        Assert.That(DetailLine("Appointment reference"), Does.Contain(AppointmentReference));
        Assert.That(DetailLine("Doctor"), Does.Contain(DoctorName));
        Assert.That(DetailLine("Status"), Does.Contain("Booked"));

        // Expected date/time are formatted by the browser itself, so they match the user's timezone.
        var start = _slots[0].Start.ToString("yyyy-MM-ddTHH:mm:ss'Z'");
        var expectedDate = (string)((IJavaScriptExecutor)_driver).ExecuteScript(
            "return new Date(arguments[0]).toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' });", start)!;
        var expectedTime = (string)((IJavaScriptExecutor)_driver).ExecuteScript(
            "return new Date(arguments[0]).toLocaleTimeString('en-LK', { hour: 'numeric', minute: '2-digit' });", start)!;

        Assert.That(DetailLine("Date"), Does.Contain(expectedDate));
        Assert.That(DetailLine("Time"), Does.Contain(expectedTime));

        Assert.That(_bookingPostCount, Is.EqualTo(1), "exactly one booking request was sent");
        Assert.That(_driver.FindElements(By.XPath("//button[normalize-space()='Confirm Appointment']")), Is.Empty);
    }

    // ---------------------------------------------------------------------------------------
    // GCN44-SEL-05  Unavailable / already-booked slot is rejected with a message
    // ---------------------------------------------------------------------------------------
    [Test]
    public void GCN44_SEL_05_AlreadyBookedSlotShowsUnavailableMessageAndNoSuccess()
    {
        _bookingStatusCode = 409;
        _bookingBody = JsonSerializer.Serialize(new { message = AlreadyBookedMessage });

        OpenBookingPage();

        DateButtons()[0].Click();
        _wait.Until(d => TimeButtons().Count == 2);
        TimeButtons()[0].Click();
        ConfirmButton().Click();

        _wait.Until(d => d.PageSource.Contains(AlreadyBookedMessage));

        Assert.That(_driver.PageSource, Does.Not.Contain("Appointment booked successfully"));
        Assert.That(_driver.PageSource, Does.Not.Contain("Appointment reference"));
        Assert.That(_bookingPostCount, Is.EqualTo(1));
        Assert.That(_doctorGetsAfterBooking, Is.GreaterThanOrEqualTo(1), "the page refreshes the slot list after a conflict");
    }

    // ---------------------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------------------

    private static bool IsApiRequest(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            return false;
        }

        return uri.Host == "localhost" && uri.Port is >= 5133 and <= 5136;
    }

    private HttpResponseData SupplyResponse(HttpRequestData request)
    {
        var uri = new Uri(request.Url!);
        var path = uri.AbsolutePath.TrimEnd('/');

        // CORS pre-flight for calls that carry the Authorization header.
        if (string.Equals(request.Method, "OPTIONS", StringComparison.OrdinalIgnoreCase))
        {
            return Respond(204, string.Empty);
        }

        if (string.Equals(request.Method, "POST", StringComparison.OrdinalIgnoreCase) &&
            uri.Port == 5136 && path.Equals("/api/appointments", StringComparison.OrdinalIgnoreCase))
        {
            Interlocked.Increment(ref _bookingPostCount);
            return Respond(_bookingStatusCode, _bookingBody);
        }

        if (string.Equals(request.Method, "GET", StringComparison.OrdinalIgnoreCase) &&
            path.Equals($"/api/doctors/{DoctorId}", StringComparison.OrdinalIgnoreCase))
        {
            Interlocked.Increment(ref _doctorGetCount);

            // After a conflict the page re-reads the profile; the contested slot is no longer offered.
            // (Counted from the booking attempt, because React StrictMode loads the profile twice on first render.)
            var afterConflict = _bookingPostCount > 0 && _bookingStatusCode == 409;
            if (afterConflict)
            {
                Interlocked.Increment(ref _doctorGetsAfterBooking);
            }

            var slots = afterConflict ? _slots.Skip(1).ToArray() : _slots;

            return Respond(200, DoctorJson(slots));
        }

        // Anything else the layout may request (notifications etc.) gets an empty, harmless list.
        return Respond(200, "[]");
    }

    private static HttpResponseData Respond(int status, string body)
    {
        var response = new HttpResponseData
        {
            StatusCode = status,
            Body = body,
        };
        response.Headers["Access-Control-Allow-Origin"] = BaseUrl;
        response.Headers["Access-Control-Allow-Headers"] = "authorization, content-type";
        response.Headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
        response.Headers["Content-Type"] = "application/json";
        return response;
    }

    private string DoctorJson((int Id, DateTime Start, DateTime End)[] slots) =>
        JsonSerializer.Serialize(new
        {
            doctorId = DoctorId,
            fullName = DoctorName,
            availability = new
            {
                hasAvailableSlots = slots.Length > 0,
                availableSlotCount = slots.Length,
                nextAvailableSlotUtc = slots.Length > 0 ? Iso(slots[0].Start) : null,
            },
            upcomingSlots = slots.Select(s => new { id = s.Id, startUtc = Iso(s.Start), endUtc = Iso(s.End) }),
        });

    private string BookedAppointmentJson() =>
        JsonSerializer.Serialize(new
        {
            id = 7,
            appointmentReference = AppointmentReference,
            patientId = "11111111-1111-1111-1111-111111111111",
            doctorId = DoctorId,
            doctorName = DoctorName,
            slotId = _slots[0].Id,
            appointmentStartUtc = Iso(_slots[0].Start),
            appointmentEndUtc = Iso(_slots[0].End),
            status = "Booked",
            createdAtUtc = Iso(DateTime.UtcNow),
        });

    private static string Iso(DateTime utc) => utc.ToString("yyyy-MM-ddTHH:mm:ss'Z'");

    /// <summary>
    /// Puts a placeholder session in localStorage (no real login, no password). The token is built
    /// here with a far-future expiry and no signature; it is only decoded by the browser app.
    /// </summary>
    private void SignInAsPatientWithoutRealLogin()
    {
        _driver.Navigate().GoToUrl($"{BaseUrl}/login");

        var exp = DateTimeOffset.UtcNow.AddHours(2).ToUnixTimeSeconds();
        var token = $"{Base64Url("{\"alg\":\"none\",\"typ\":\"JWT\"}")}." +
                    $"{Base64Url($"{{\"sub\":\"11111111-1111-1111-1111-111111111111\",\"exp\":{exp}}}")}.qa";
        var user = "{\"userId\":\"11111111-1111-1111-1111-111111111111\",\"email\":\"qa.patient@example.com\",\"role\":\"Patient\",\"fullName\":\"QA Patient\"}";

        ((IJavaScriptExecutor)_driver).ExecuteScript(
            "localStorage.setItem('carenova_token', arguments[0]); localStorage.setItem('carenova_user', arguments[1]);",
            token,
            user);
    }

    private static string Base64Url(string value) =>
        Convert.ToBase64String(Encoding.UTF8.GetBytes(value)).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private void OpenBookingPage()
    {
        _driver.Navigate().GoToUrl($"{BaseUrl}/patient/doctors/{DoctorId}/book");
        _wait.Until(d => d.FindElements(By.CssSelector(".pd-slot-list button.pd-slot")).Count > 0);
    }

    // The first .pd-slot-list holds the dates; the second (after a date is picked) holds the times.
    private IReadOnlyList<IWebElement> DateButtons() =>
        _driver.FindElements(By.CssSelector(".pd-slot-list"))[0].FindElements(By.CssSelector("button.pd-slot"));

    private IReadOnlyList<IWebElement> TimeButtons()
    {
        var lists = _driver.FindElements(By.CssSelector(".pd-slot-list"));
        return lists.Count < 2
            ? new List<IWebElement>()
            : lists[1].FindElements(By.CssSelector("button.pd-slot"));
    }

    private IWebElement ConfirmButton() =>
        _wait.Until(d => d.FindElement(By.XPath("//button[normalize-space()='Confirm Appointment']")));

    private static bool HasClass(IWebElement element, string cssClass) =>
        (element.GetAttribute("class") ?? string.Empty).Split(' ').Contains(cssClass);

    private string DetailLine(string label) =>
        _driver.FindElement(By.XPath($"//p[starts-with(normalize-space(),'{label}:')]")).Text;
}
