using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.SeleniumTests;

[TestFixture]
[NonParallelizable]
public class GCN37AvailabilityTests
{
    private IWebDriver _driver = null!;
    private WebDriverWait _wait = null!;

    private const string BaseUrl = "http://localhost:3000";
    private const string DoctorEmail = "doctor@gmail.com";

    private readonly string _qaDate =
        DateTime.Today.AddDays(30).ToString("yyyy-MM-dd");

    [SetUp]
    public void SetUp()
    {
        var password =
            Environment.GetEnvironmentVariable("CARENOVA_DOCTOR_PASSWORD");

        if (string.IsNullOrWhiteSpace(password))
        {
            Assert.Fail(
                "CARENOVA_DOCTOR_PASSWORD environment variable is not set.");
        }

        var options = new ChromeOptions();

        // Keep Chrome visible while the Selenium tests run.
        options.AddArgument("--start-maximized");

        _driver = new ChromeDriver(options);
        _wait = new WebDriverWait(
            _driver,
            TimeSpan.FromSeconds(15));

        Login(DoctorEmail, password!);

        _driver.Navigate().GoToUrl($"{BaseUrl}/profile");

        WaitForAvailabilitySection();
    }

    [TearDown]
    public void TearDown()
    {
        _driver?.Quit();
        _driver?.Dispose();
    }

    // ------------------------------------------------------------
    // TEST 1 - View current schedule
    // ------------------------------------------------------------

    [Test]
    public void GCN37_01_DoctorCanViewCurrentConsultationSchedule()
    {
        Assert.That(
            _driver.PageSource,
            Does.Contain("Add Availability"));

        Assert.That(
            _driver.FindElements(
                By.CssSelector(".dp-availability-summary")).Count,
            Is.GreaterThan(0));
    }

    // ------------------------------------------------------------
    // TEST 2 - Invalid time
    // ------------------------------------------------------------

    [Test]
    public void GCN37_02_InvalidEndTimeIsRejected()
    {
        OpenAddForm();

        FillAddForm(
            _qaDate,
            startHour: "10",
            startMinute: "00",
            startPeriod: "AM",
            endHour: "9",
            endMinute: "00",
            endPeriod: "AM");

        ClickButton("Publish Slots");

        Assert.That(
            WaitForPageText(
                "End time must be after the start time."),
            Is.True);
    }

    // ------------------------------------------------------------
    // TEST 3 - Add availability
    // ------------------------------------------------------------

    [Test]
    public void GCN37_03_DoctorCanPublishAvailability()
    {
        CreateQaSlot(
            startHour: "4",
            startMinute: "00",
            endHour: "4",
            endMinute: "20");

        Assert.That(
            WaitForPageText("published"),
            Is.True);
    }

    // ------------------------------------------------------------
    // TEST 4 - Conflict validation
    // ------------------------------------------------------------

[Test]
public void GCN37_04_ConflictingAvailabilityIsPrevented()
{
    // Separate date so this test does not collide with
    // availability created by other Selenium tests.
    var conflictTestDate =
        DateTime.Today.AddDays(45).ToString("yyyy-MM-dd");

    OpenAddForm();

    // First create a clean base slot: 7:00 PM - 7:20 PM
    FillAddForm(
        conflictTestDate,
        startHour: "7",
        startMinute: "00",
        startPeriod: "PM",
        endHour: "7",
        endMinute: "20",
        endPeriod: "PM");

    ClickButton("Publish Slots");

    var confirm =
        _wait.Until(d =>
            d.FindElements(
                    By.XPath(
                        "//button[contains(.,'Yes, Publish')]"))
                .FirstOrDefault(e =>
                    e.Displayed &&
                    e.Enabled));

    ScrollAndClick(confirm);

    Assert.That(
        WaitForPageText("published"),
        Is.True);

    // Now attempt an overlapping slot on THE SAME DATE.
    OpenAddForm();

    FillAddForm(
        conflictTestDate,
        startHour: "7",
        startMinute: "10",
        startPeriod: "PM",
        endHour: "7",
        endMinute: "30",
        endPeriod: "PM");

    ClickButton("Publish Slots");

    Assert.That(
        WaitForPageText("overlaps your existing slot"),
        Is.True);

    Assert.That(
        _driver.PageSource,
        Does.Contain("Choose another time"));
}
    // ------------------------------------------------------------
    // TEST 5 - Update availability
    // ------------------------------------------------------------

    [Test]
    public void GCN37_05_DoctorCanUpdateAvailability()
    {
        // Different time from the other tests so an old QA slot
        // cannot accidentally be selected.
        CreateQaSlot(
            startHour: "5",
            startMinute: "00",
            endHour: "5",
            endMinute: "20");

        var editButton =
            FindSlotButtonForTime(
                "Edit slot",
                "5:00 PM");

        ScrollAndClick(editButton);

        var editForm = _wait.Until(d =>
            d.FindElement(
                By.CssSelector(
                    "form[aria-label='Edit consultation slot']")));

        SetTextInput(
            editForm.FindElement(By.Name("startHour")),
            "5");

        SetTextInput(
            editForm.FindElement(By.Name("startMinute")),
            "30");

        new SelectElement(
            editForm.FindElement(By.Name("startMeridiem")))
            .SelectByText("PM");

        SetTextInput(
            editForm.FindElement(By.Name("endHour")),
            "5");

        SetTextInput(
            editForm.FindElement(By.Name("endMinute")),
            "50");

        new SelectElement(
            editForm.FindElement(By.Name("endMeridiem")))
            .SelectByText("PM");

        var saveButton =
            editForm.FindElement(
                By.XPath(
                    ".//button[contains(.,'Save Changes')]"));

        ScrollAndClick(saveButton);

        Assert.That(
            WaitForPageText(
                "Consultation slot updated."),
            Is.True);

        // Verify the updated slot is now displayed.
        Assert.That(
            WaitForPageText("5:30 PM"),
            Is.True);
    }

    // ------------------------------------------------------------
    // TEST 6 - Remove availability
    // ------------------------------------------------------------

    [Test]
    public void GCN37_06_DoctorCanRemoveAvailability()
    {
        CreateQaSlot(
            startHour: "6",
            startMinute: "00",
            endHour: "6",
            endMinute: "20");

        var removeButton =
            FindSlotButtonForTime(
                "Remove slot",
                "6:00 PM");

        ScrollAndClick(removeButton);

        var confirm =
            _wait.Until(d =>
                d.FindElements(
                    By.XPath(
                        "//button[contains(.,'Yes, Remove')]"))
                 .FirstOrDefault(e =>
                     e.Displayed &&
                     e.Enabled));

        ScrollAndClick(confirm);

        Assert.That(
            WaitForPageText("Slot removed."),
            Is.True);
    }

    // ============================================================
    // LOGIN
    // ============================================================

    private void Login(
        string email,
        string password)
    {
        _driver.Navigate()
            .GoToUrl($"{BaseUrl}/login");

        var emailInput =
            _wait.Until(d =>
                d.FindElement(
                    By.Id("login-email")));

        emailInput.SendKeys(email);

        _driver.FindElement(
                By.Id("login-password"))
            .SendKeys(password);

        var signInButton =
            _driver.FindElements(
                    By.XPath(
                        "//button[contains(.,'Sign In')]"))
                .FirstOrDefault(e =>
                    e.Displayed &&
                    e.Enabled);

        Assert.That(
            signInButton,
            Is.Not.Null,
            "Sign In button was not found.");

        signInButton!.Click();

        _wait.Until(d =>
            !d.Url.Contains("/login"));
    }

    // ============================================================
    // AVAILABILITY HELPERS
    // ============================================================

    private void WaitForAvailabilitySection()
    {
        _wait.Until(d =>
            d.FindElements(
                    By.XPath(
                        "//button[contains(.,'Add Availability')]"))
                .Any(e => e.Displayed));
    }

    private void OpenAddForm()
    {
        var existing =
            _driver.FindElements(
                By.CssSelector(
                    "form[aria-label='Add availability']"));

        if (existing.Any(e => e.Displayed))
            return;

        var button =
            _wait.Until(d =>
                d.FindElements(
                        By.XPath(
                            "//button[contains(.,'Add Availability')]"))
                    .FirstOrDefault(e =>
                        e.Displayed &&
                        e.Enabled));

        ScrollAndClick(button);

        _wait.Until(d =>
            d.FindElement(
                By.CssSelector(
                    "form[aria-label='Add availability']")));
    }

    private void FillAddForm(
        string date,
        string startHour,
        string startMinute,
        string startPeriod,
        string endHour,
        string endMinute,
        string endPeriod)
    {
        var form =
            _driver.FindElement(
                By.CssSelector(
                    "form[aria-label='Add availability']"));

        // IMPORTANT:
        // Do not use SendKeys() for input[type=date].
        // Chrome can interpret it using the machine's local
        // date format. Set the yyyy-MM-dd value directly.
        var dateInput =
            form.FindElement(
                By.Id("availability-date"));

        SetDateInput(
            dateInput,
            date);

        SetTextInput(
            form.FindElement(
                By.Name("startHour")),
            startHour);

        SetTextInput(
            form.FindElement(
                By.Name("startMinute")),
            startMinute);

        new SelectElement(
            form.FindElement(
                By.Name("startMeridiem")))
            .SelectByText(startPeriod);

        SetTextInput(
            form.FindElement(
                By.Name("endHour")),
            endHour);

        SetTextInput(
            form.FindElement(
                By.Name("endMinute")),
            endMinute);

        new SelectElement(
            form.FindElement(
                By.Name("endMeridiem")))
            .SelectByText(endPeriod);

        new SelectElement(
            form.FindElement(
                By.Id("availability-duration")))
            .SelectByValue("20");
    }

    private void CreateQaSlot(
        string startHour,
        string startMinute,
        string endHour,
        string endMinute)
    {
        OpenAddForm();

        FillAddForm(
            _qaDate,
            startHour,
            startMinute,
            "PM",
            endHour,
            endMinute,
            "PM");

        ClickButton("Publish Slots");

        var confirm =
            _wait.Until(d =>
                d.FindElements(
                        By.XPath(
                            "//button[contains(.,'Yes, Publish')]"))
                    .FirstOrDefault(e =>
                        e.Displayed &&
                        e.Enabled));

        ScrollAndClick(confirm);

        Assert.That(
            WaitForPageText("published"),
            Is.True);
    }

    // ============================================================
    // ELEMENT HELPERS
    // ============================================================

    private IWebElement FindSlotButtonForTime(
        string ariaPrefix,
        string time)
    {
        return _wait.Until(d =>
        {
            var buttons =
                d.FindElements(
                    By.CssSelector(
                        $"button[aria-label^='{ariaPrefix}']"));

            return buttons.FirstOrDefault(e =>
                e.Displayed &&
                e.Enabled &&
                (e.GetAttribute("aria-label") ?? "")
                    .Contains(time));
        });
    }

    private void ClickButton(string text)
    {
        var button =
            _wait.Until(d =>
                d.FindElements(
                        By.XPath(
                            $"//button[contains(.,'{text}')]"))
                    .FirstOrDefault(e =>
                        e.Displayed &&
                        e.Enabled));

        ScrollAndClick(button);
    }

    private void ScrollAndClick(
        IWebElement element)
    {
        ((IJavaScriptExecutor)_driver)
            .ExecuteScript(
                "arguments[0].scrollIntoView({block:'center'});",
                element);

        _wait.Until(_ =>
            element.Displayed &&
            element.Enabled);

        element.Click();
    }

    private static void SetTextInput(
        IWebElement element,
        string value)
    {
        element.Clear();
        element.SendKeys(value);
    }

    // Correct way for this React/Chrome date input.
    private void SetDateInput(
        IWebElement element,
        string value)
    {
        ((IJavaScriptExecutor)_driver)
            .ExecuteScript(
                """
                const input = arguments[0];
                const value = arguments[1];

                const setter =
                    Object.getOwnPropertyDescriptor(
                        HTMLInputElement.prototype,
                        'value'
                    ).set;

                setter.call(input, value);

                input.dispatchEvent(
                    new Event('input', { bubbles: true })
                );

                input.dispatchEvent(
                    new Event('change', { bubbles: true })
                );
                """,
                element,
                value);
    }

    private bool WaitForPageText(
        string text)
    {
        try
        {
            return _wait.Until(d =>
                d.PageSource.Contains(text));
        }
        catch (WebDriverTimeoutException)
        {
            return false;
        }
    }
}