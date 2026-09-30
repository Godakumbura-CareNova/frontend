using System;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.Frontend.Tests.Selenium
{
    [TestFixture]
    public class GCN34DoctorSearchTests
    {
        private IWebDriver _driver;
        private WebDriverWait _wait;

        private readonly string _baseUrl = "http://localhost:3000";

        // Local QA account
        private readonly string _patientEmail = "patient@gmail.com";
        private readonly string _patientPassword = "AmmoEka@2026#";

        [SetUp]
        public void Setup()
        {
            var options = new ChromeOptions();
            options.AddArgument("--headless");
            options.AddArgument("--window-size=1920,1080");

            _driver = new ChromeDriver(options);
            _wait = new WebDriverWait(_driver, TimeSpan.FromSeconds(15));
        }

        private void LoginAsPatient()
        {
            _driver.Navigate().GoToUrl($"{_baseUrl}/login");

            var email = _wait.Until(
                d => d.FindElement(By.Name("email"))
            );

            var password = _driver.FindElement(By.Name("password"));

            var loginButton = _driver.FindElement(
                By.CssSelector("button[type='submit']")
            );

            email.SendKeys(_patientEmail);
            password.SendKeys(_patientPassword);

            loginButton.Click();

            _wait.Until(
                d => d.Url.Contains("dashboard")
            );
        }

        private void OpenDoctorSearchPage()
        {
            _driver.Navigate().GoToUrl(
                $"{_baseUrl}/patient/doctors"
            );

            _wait.Until(
                d => d.FindElement(By.Id("doctor-search"))
            );
        }

        [Test]
        public void Patient_CanViewDoctorSearchResults()
        {
            LoginAsPatient();
            OpenDoctorSearchPage();

            var cards = _wait.Until(d =>
            {
                var elements =
                    d.FindElements(By.CssSelector(".pd-card"));

                return elements.Count > 0
                    ? elements
                    : null;
            });

            Assert.That(
                cards.Count,
                Is.GreaterThan(0),
                "Patient should see at least one doctor."
            );
        }

        [Test]
        public void Patient_CanSearchDoctorsBySpecialization()
        {
            LoginAsPatient();
            OpenDoctorSearchPage();

            var searchInput = _wait.Until(
                d => d.FindElement(By.Id("doctor-search"))
            );

            searchInput.Clear();
            searchInput.SendKeys("Cardiology");

            _driver.FindElement(
                By.CssSelector("button[type='submit']")
            ).Click();

            var card = _wait.Until(d =>
            {
                var cards =
                    d.FindElements(By.CssSelector(".pd-card"));

                foreach (var result in cards)
                {
                    if (result.Text.Contains(
                        "Cardiology",
                        StringComparison.OrdinalIgnoreCase))
                    {
                        return result;
                    }
                }

                return null;
            });

            Assert.That(
                card.Text,
                Does.Contain("Cardiology").IgnoreCase,
                "Search results should include a Cardiology doctor."
            );
        }

        [Test]
        public void Patient_SearchWithNoMatches_ShowsNoDoctorsFound()
        {
            LoginAsPatient();
            OpenDoctorSearchPage();

            var searchInput = _wait.Until(
                d => d.FindElement(By.Id("doctor-search"))
            );

            searchInput.Clear();
            searchInput.SendKeys("ZZZZZZ");

            _driver.FindElement(
                By.CssSelector("button[type='submit']")
            ).Click();

            var emptyMessage = _wait.Until(
                d => d.FindElement(
                    By.CssSelector(".pd-empty h2")
                )
            );

            Assert.That(
                emptyMessage.Text,
                Is.EqualTo("No doctors found")
            );
        }

        [Test]
        public void Patient_InvalidOneCharacterSearch_ShowsValidationError()
        {
            LoginAsPatient();
            OpenDoctorSearchPage();

            var searchInput = _wait.Until(
                d => d.FindElement(By.Id("doctor-search"))
            );

            searchInput.Clear();
            searchInput.SendKeys("D");

            _driver.FindElement(
                By.CssSelector("button[type='submit']")
            ).Click();

            var error = _wait.Until(
                d => d.FindElement(
                    By.CssSelector(".field-error")
                )
            );

            Assert.That(
                error.Text,
                Does.Contain("at least 2 characters")
                    .IgnoreCase
            );
        }

        [Test]
        public void Patient_CanSelectDoctorAndViewProfile()
        {
            LoginAsPatient();
            OpenDoctorSearchPage();

            var viewProfileButton = _wait.Until(
                d => d.FindElement(
                    By.CssSelector(".pd-view-btn")
                )
            );

            viewProfileButton.Click();

            _wait.Until(
                d => d.Url.Contains("/patient/doctors/")
            );

            // Wait for the asynchronous doctor profile request
            // to finish before checking the rendered page.
            _wait.Until(d =>
                !d.PageSource.Contains(
                    "Loading doctor profile...",
                    StringComparison.OrdinalIgnoreCase)
            );

            _wait.Until(d =>
                d.PageSource.Contains(
                    "Cardiology",
                    StringComparison.OrdinalIgnoreCase)
            );

            Assert.That(
                _driver.Url,
                Does.Contain("/patient/doctors/"),
                "Selecting a doctor should navigate to the doctor's profile."
            );

            Assert.That(
                _driver.PageSource,
                Does.Contain("Cardiology").IgnoreCase,
                "Doctor profile should display the doctor's professional information."
            );
        }

        [Test]
        public void Patient_OpenSlotsOnly_ShowsDoctorWithAvailableSlot()
        {
            LoginAsPatient();
            OpenDoctorSearchPage();

            var openSlotsCheckbox = _wait.Until(
                d => d.FindElement(
                    By.Id("doctor-available-only")
                )
            );

            openSlotsCheckbox.Click();

            _driver.FindElement(
                By.CssSelector("button[type='submit']")
            ).Click();

            var card = _wait.Until(d =>
            {
                var cards =
                    d.FindElements(By.CssSelector(".pd-card"));

                foreach (var result in cards)
                {
                    if (System.Text.RegularExpressions.Regex.IsMatch(
                        result.Text,
                        @"\d+\s+open\s+slots?",
                        System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                    {
                        return result;
                    }
                }

                return null;
            });

            Assert.That(
                card.Text,
                Does.Match(@"(?i)\d+\s+open\s+slots?"),
                "Doctor with an available consultation slot should appear when Open slots only is enabled."
            );
        }

        [TearDown]
        public void Teardown()
        {
            _driver?.Quit();
            _driver?.Dispose();
        }
    }
}