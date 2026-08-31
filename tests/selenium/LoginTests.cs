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

        [SetUp]
        public void Setup()
        {
            var options = new ChromeOptions();

            options.AddArgument("--headless");
            options.AddArgument("--window-size=1920,1080");

            _driver = new ChromeDriver(options);

            _wait = new WebDriverWait(
                _driver,
                TimeSpan.FromSeconds(10)
            );
        }

        private void Login(string email, string password)
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

            emailInput.Clear();
            emailInput.SendKeys(email);

            passwordInput.Clear();
            passwordInput.SendKeys(password);

            submitButton.Click();
        }

        [Test]
        public void PatientLogin_ShouldRedirectToPatientDashboard()
        {
            Login(
                "test-patient@carenova.dev",
                "Patient@2026"
            );

            _wait.Until(
                d => d.Url.Contains("/patient-dashboard")
            );

            Assert.That(
                _driver.Url,
                Does.Contain("/patient-dashboard"),
                "Patient should be redirected to /patient-dashboard."
            );
        }

        [Test]
        public void DoctorLogin_ShouldRedirectToDoctorDashboard()
        {
            Login(
                "test-doctor@carenova.dev",
                "Doctor@2026"
            );

            _wait.Until(
                d => d.Url.Contains("/doctor-dashboard")
            );

            Assert.That(
                _driver.Url,
                Does.Contain("/doctor-dashboard"),
                "Doctor should be redirected to /doctor-dashboard."
            );
        }

        [Test]
        public void PharmacyStaffLogin_ShouldRedirectToPharmacyDashboard()
        {
            Login(
                "test-pharmacy@carenova.dev",
                "Pharmacy@2026"
            );

            _wait.Until(
                d => d.Url.Contains("/pharmacy-dashboard")
            );

            Assert.That(
                _driver.Url,
                Does.Contain("/pharmacy-dashboard"),
                "PharmacyStaff should be redirected to /pharmacy-dashboard."
            );
        }

        [Test]
        public void AdminLogin_ShouldRedirectToAdminDashboard()
        {
            Login(
                "admin@carenova.dev",
                "Admin@2026"
            );

            _wait.Until(
                d => d.Url.Contains("/admin-dashboard")
            );

            Assert.That(
                _driver.Url,
                Does.Contain("/admin-dashboard"),
                "Admin should be redirected to /admin-dashboard."
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