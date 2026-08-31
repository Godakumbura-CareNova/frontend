using System;
using System.Linq;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.Frontend.Tests.Selenium
{
    [TestFixture]
    public class RoleAccessTests
    {
        private IWebDriver _driver;
        private WebDriverWait _wait;
        private readonly string _baseUrl = "http://localhost:3000";

        private readonly string _patientEmail = "gcn21.patient2@example.com";
        private readonly string _patientPassword = "Test@123";

        private readonly string _adminEmail = "admin@carenova.org";
        private readonly string _adminPassword = "Admin@12345";

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

            emailInput.SendKeys(email);
            passwordInput.SendKeys(password);
            submitButton.Click();

            _wait.Until(d =>
                d.Url.Contains("dashboard") ||
                d.Url.Contains("/forbidden")
            );
        }

        [Test]
        public void UnauthenticatedUser_AccessingProtectedPage_ShouldRedirectToLogin()
        {
            _driver.Navigate().GoToUrl(
                $"{_baseUrl}/admin-dashboard"
            );

            _wait.Until(
                d => d.Url.Contains("/login")
            );

            Assert.That(
                _driver.Url,
                Does.Contain("/login"),
                "Unauthenticated users should be redirected to login."
            );
        }

        [Test]
        public void Patient_AccessingAdminDashboard_ShouldRedirectToForbidden()
        {
            Login(_patientEmail, _patientPassword);

            _driver.Navigate().GoToUrl(
                $"{_baseUrl}/admin-dashboard"
            );

            _wait.Until(
                d => d.Url.Contains("/forbidden")
            );

            Assert.That(
                _driver.Url,
                Does.Contain("/forbidden"),
                "Patient must not have access to the Admin dashboard."
            );
        }

        [Test]
        public void Patient_AccessingAdminUsers_ShouldRedirectToForbidden()
        {
            Login(_patientEmail, _patientPassword);

            _driver.Navigate().GoToUrl(
                $"{_baseUrl}/admin/users"
            );

            _wait.Until(
                d => d.Url.Contains("/forbidden")
            );

            Assert.That(
                _driver.Url,
                Does.Contain("/forbidden"),
                "Patient must not have access to Admin user management."
            );
        }

        [Test]
        public void Admin_AccessingAdminDashboard_ShouldBeAllowed()
        {
            Login(_adminEmail, _adminPassword);

            _driver.Navigate().GoToUrl(
                $"{_baseUrl}/admin-dashboard"
            );

            _wait.Until(
                d => d.Url.Contains("/admin-dashboard")
            );

            Assert.That(
                _driver.Url,
                Does.Contain("/admin-dashboard"),
                "Admin should be allowed to access the Admin dashboard."
            );
        }

        [Test]
        public void Patient_ShouldHaveLogoutControl()
        {
            Login(_patientEmail, _patientPassword);

            var logoutElements = _driver.FindElements(
                By.XPath(
                    "//button[contains(" +
                    "translate(normalize-space(.)," +
                    "'ABCDEFGHIJKLMNOPQRSTUVWXYZ'," +
                    "'abcdefghijklmnopqrstuvwxyz')," +
                    "'logout')] | " +
                    "//a[contains(" +
                    "translate(normalize-space(.)," +
                    "'ABCDEFGHIJKLMNOPQRSTUVWXYZ'," +
                    "'abcdefghijklmnopqrstuvwxyz')," +
                    "'logout')]"
                )
            );

            Assert.That(
                logoutElements.Any(),
                Is.True,
                "Authenticated Patient dashboard should provide a Logout control."
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