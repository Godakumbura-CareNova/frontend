using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;
using System;
using System.Linq;

namespace SeleniumTests
{
    [TestFixture]
    [NonParallelizable]
    public class GCN36DoctorProfileTests
    {
        private IWebDriver driver = null!;
        private WebDriverWait wait = null!;

        private const string BaseUrl = "http://localhost:3000";

        // Local QA account only
        private const string DoctorEmail = "doctor@gmail.com";
        private const string DoctorPassword =
            "AmmoEka@2026#";

        [SetUp]
        public void Setup()
        {
            var options = new ChromeOptions();
            options.AddArgument("--headless");
            options.AddArgument("--window-size=1920,1080");

            driver = new ChromeDriver(options);
            wait = new WebDriverWait(
                driver,
                TimeSpan.FromSeconds(15));

            LoginAsDoctor();
        }

        [TearDown]
        public void TearDown()
        {
            driver?.Quit();
            driver?.Dispose();
        }

        // =========================================================
        // Helpers
        // =========================================================

        private void LoginAsDoctor()
        {
            driver.Navigate().GoToUrl($"{BaseUrl}/login");

            wait.Until(d =>
                d.FindElement(By.Name("email")))
                .SendKeys(DoctorEmail);

            driver.FindElement(By.Name("password"))
                .SendKeys(DoctorPassword);

            driver.FindElement(
                By.CssSelector("button[type='submit']"))
                .Click();

            wait.Until(d =>
                d.Url.Contains("dashboard"));
        }

        private void OpenDoctorProfile()
        {
            driver.Navigate().GoToUrl($"{BaseUrl}/profile");

            wait.Until(d =>
                d.FindElements(
                    By.CssSelector(".dp-hero-title"))
                 .Any(e =>
                    e.Text.Contains("Doctor Profile")));
        }

        private IWebElement FindButton(string text)
        {
            return wait.Until(d =>
                d.FindElements(By.TagName("button"))
                 .FirstOrDefault(b =>
                    b.Displayed &&
                    b.Enabled &&
                    b.Text.Contains(text)))!;
        }

        private void StartEditing()
        {
            FindButton("Edit Specialization").Click();

            FindButton("Yes, Edit").Click();

            wait.Until(d =>
                d.FindElement(
                    By.Id("specialization"))
                 .Displayed);
        }

        private void SubmitAndConfirmSave()
        {
            FindButton("Save Changes").Click();

            FindButton("Yes, Save").Click();

            wait.Until(d =>
                d.PageSource.Contains(
                    "Your profile has been saved."));
        }

        private void ReplaceText(
            By locator,
            string value)
        {
            var element = wait.Until(d =>
                d.FindElement(locator));

            element.Clear();
            element.SendKeys(value);
        }

        // =========================================================
        // TEST 1
        // View existing professional profile
        // =========================================================

        [Test]
        public void Doctor_CanViewExistingProfessionalProfile()
        {
            OpenDoctorProfile();

            Assert.Multiple(() =>
            {
                Assert.That(
                    driver.FindElement(
                        By.CssSelector(".dp-hero-title"))
                        .Text,
                    Is.EqualTo("Doctor Profile"));

                Assert.That(
                    driver.PageSource,
                    Does.Contain("Cardiology"));

                Assert.That(
                    driver.PageSource,
                    Does.Contain("SLMC-99999"));
            });
        }

        // =========================================================
        // TEST 2
        // Valid professional profile update
        // =========================================================

        [Test]
        public void Doctor_CanUpdateProfessionalProfile()
        {
            OpenDoctorProfile();
            StartEditing();

            ReplaceText(
                By.Id("biography"),
                "GCN-36 Selenium profile test.");

            SubmitAndConfirmSave();

            Assert.That(
                driver.PageSource,
                Does.Contain(
                    "GCN-36 Selenium profile test."));
        }

        // =========================================================
        // TEST 3
        // Saved information persists after refresh
        // =========================================================

        [Test]
        public void Doctor_ProfileUpdate_PersistsAfterRefresh()
        {
            OpenDoctorProfile();
            StartEditing();

            ReplaceText(
                By.Id("biography"),
                "GCN-36 Selenium persistence test.");

            SubmitAndConfirmSave();

            driver.Navigate().Refresh();

            wait.Until(d =>
                d.PageSource.Contains(
                    "GCN-36 Selenium persistence test."));

            Assert.That(
                driver.PageSource,
                Does.Contain(
                    "GCN-36 Selenium persistence test."));
        }

        // =========================================================
        // TEST 4
        // Empty specialization validation
        // =========================================================

        [Test]
public void Doctor_EmptySpecialization_ShowsValidationError()
{
    OpenDoctorProfile();
    StartEditing();

    var specialization =
        wait.Until(d => d.FindElement(By.Id("specialization")));

    // Clear it like a real user so React receives the input events.
    specialization.Click();
    specialization.SendKeys(Keys.Control + "a");
    specialization.SendKeys(Keys.Backspace);

    wait.Until(d =>
        string.IsNullOrEmpty(
            d.FindElement(By.Id("specialization"))
             .GetAttribute("value")));

    FindButton("Save Changes").Click();

    var error = wait.Until(d =>
        d.FindElements(By.CssSelector(".field-error"))
         .FirstOrDefault(e =>
             e.Displayed &&
             e.Text.Contains("Specialization is required.")));

    Assert.That(error, Is.Not.Null);

    Assert.That(
        error!.Text,
        Is.EqualTo("Specialization is required."));

    // Invalid profile must not reach save confirmation.
    Assert.That(
        driver.FindElements(
            By.XPath("//button[contains(., 'Yes, Save')]")).Count,
        Is.EqualTo(0));
}

        // =========================================================
        // TEST 5
        // Add qualification + persistence
        // =========================================================

        [Test]
        public void Doctor_CanAddQualification()
        {
            OpenDoctorProfile();
            StartEditing();

            FindButton("Add Qualification").Click();

            var degreeInputs = wait.Until(d =>
            {
                var elements =
                    d.FindElements(
                        By.CssSelector(
                            "input[id^='qualifications'][id$='.degree']"));

                return elements.Count > 0
                    ? elements
                    : null;
            });

            var index =
                degreeInputs!.Count - 1;

            driver.FindElement(
                By.Id(
                    $"qualifications[{index}].degree"))
                .SendKeys("Selenium MBBS");

            driver.FindElement(
                By.Id(
                    $"qualifications[{index}].institution"))
                .SendKeys(
                    "Selenium Test University");

            new SelectElement(
                driver.FindElement(
                    By.Id(
                        $"qualifications[{index}].startYear")))
                .SelectByText("2020");

            SubmitAndConfirmSave();

            Assert.Multiple(() =>
            {
                Assert.That(
                    driver.PageSource,
                    Does.Contain(
                        "Selenium MBBS"));

                Assert.That(
                    driver.PageSource,
                    Does.Contain(
                        "Selenium Test University"));
            });

            driver.Navigate().Refresh();

            wait.Until(d =>
                d.PageSource.Contains(
                    "Selenium MBBS"));

            Assert.That(
                driver.PageSource,
                Does.Contain(
                    "Selenium Test University"));
        }

        // =========================================================
        // TEST 6
        // Add experience + persistence
        // =========================================================

        [Test]
        public void Doctor_CanAddExperience()
        {
            OpenDoctorProfile();
            StartEditing();

            FindButton("Add Experience").Click();

            var positionInputs = wait.Until(d =>
            {
                var elements =
                    d.FindElements(
                        By.CssSelector(
                            "input[id^='experiences'][id$='.position']"));

                return elements.Count > 0
                    ? elements
                    : null;
            });

            var index =
                positionInputs!.Count - 1;

            driver.FindElement(
                By.Id(
                    $"experiences[{index}].position"))
                .SendKeys(
                    "Selenium Medical Officer");

            driver.FindElement(
                By.Id(
                    $"experiences[{index}].organization"))
                .SendKeys(
                    "Selenium Test Hospital");

            new SelectElement(
                driver.FindElement(
                    By.Id(
                        $"experiences[{index}].startYear")))
                .SelectByText("2021");

            SubmitAndConfirmSave();

            Assert.Multiple(() =>
            {
                Assert.That(
                    driver.PageSource,
                    Does.Contain(
                        "Selenium Medical Officer"));

                Assert.That(
                    driver.PageSource,
                    Does.Contain(
                        "Selenium Test Hospital"));
            });

            driver.Navigate().Refresh();

            wait.Until(d =>
                d.PageSource.Contains(
                    "Selenium Medical Officer"));

            Assert.That(
                driver.PageSource,
                Does.Contain(
                    "Selenium Test Hospital"));
        }

        // =========================================================
        // TEST 7
        // Add other professional detail + persistence
        // =========================================================

        [Test]
        public void Doctor_CanAddOtherProfessionalDetail()
        {
            OpenDoctorProfile();
            StartEditing();

            FindButton("Add Other").Click();

            var titleInputs = wait.Until(d =>
            {
                var elements =
                    d.FindElements(
                        By.CssSelector(
                            "input[id^='otherDetails'][id$='.title']"));

                return elements.Count > 0
                    ? elements
                    : null;
            });

            var index =
                titleInputs!.Count - 1;

            driver.FindElement(
                By.Id(
                    $"otherDetails[{index}].title"))
                .SendKeys(
                    "Selenium Medical Association");

            driver.FindElement(
                By.Id(
                    $"otherDetails[{index}].details"))
                .SendKeys(
                    "Selenium automated professional detail.");

            new SelectElement(
                driver.FindElement(
                    By.Id(
                        $"otherDetails[{index}].startYear")))
                .SelectByText("2022");

            SubmitAndConfirmSave();

            Assert.Multiple(() =>
            {
                Assert.That(
                    driver.PageSource,
                    Does.Contain(
                        "Selenium Medical Association"));

                Assert.That(
                    driver.PageSource,
                    Does.Contain(
                        "Selenium automated professional detail."));
            });

            driver.Navigate().Refresh();

            wait.Until(d =>
                d.PageSource.Contains(
                    "Selenium Medical Association"));

            Assert.That(
                driver.PageSource,
                Does.Contain(
                    "Selenium automated professional detail."));
        }
    }
}