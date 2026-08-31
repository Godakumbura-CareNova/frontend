using System;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.Frontend.Tests.Selenium
{
    [TestFixture]
    public class LoginTests
    {
        private IWebDriver _driver;
        private WebDriverWait _wait;
        private readonly string _baseUrl = "http://localhost:3000";

        private readonly string _patientEmail = "gcn21.patient2@example.com";
        private readonly string _patientPassword = "Test@123";

        [SetUp]
        public void Setup()
        {
            var options = new ChromeOptions();
            options.AddArgument("--headless");
            options.AddArgument("--window-size=1920,1080");

            _driver = new ChromeDriver(options);
            _wait = new WebDriverWait(_driver, TimeSpan.FromSeconds(10));
        }

        [Test]
        public void PatientLogin_WithValidCredentials_ShouldRedirectToPatientDashboard()
        {
            _driver.Navigate().GoToUrl($"{_baseUrl}/login");

            var emailInput = _wait.Until(
                d => d.FindElement(By.Name("email"))
            );

            var passwordInput = _driver.FindElement(
                By.Name("password")
            );

            var submitButton = _driver.FindElement(
                By.CssSelector("button[type='submit']")
            );

            emailInput.SendKeys(_patientEmail);
            passwordInput.SendKeys(_patientPassword);
            submitButton.Click();

            _wait.Until(
                d => d.Url.Contains("/patient-dashboard")
            );

            Assert.That(
                _driver.Url,
                Does.Contain("/patient-dashboard"),
                "A valid Patient login should redirect to /patient-dashboard."
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