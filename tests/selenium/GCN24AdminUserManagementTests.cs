using System;
using System.Linq;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.Frontend.Tests.Selenium
{
    [TestFixture]
    public class GCN24AdminUserManagementTests
    {
        private IWebDriver _driver = null!;
        private WebDriverWait _wait = null!;

        private readonly string _baseUrl = "http://localhost:3000";

        private string _adminEmail = "";
        private string _adminPassword = "";
        private string _testUserEmail = "";
        private string _testUserPassword = "";

        [SetUp]
        public void Setup()
        {
            _adminEmail =
                Environment.GetEnvironmentVariable("CARENOVA_ADMIN_EMAIL") ?? "";

            _adminPassword =
                Environment.GetEnvironmentVariable("CARENOVA_ADMIN_PASSWORD") ?? "";

            _testUserEmail =
                Environment.GetEnvironmentVariable("CARENOVA_TEST_USER_EMAIL") ?? "";

            _testUserPassword =
                Environment.GetEnvironmentVariable("CARENOVA_TEST_USER_PASSWORD") ?? "";

            var options = new ChromeOptions();

            options.AddArgument("--headless");
            options.AddArgument("--window-size=1920,1080");

            _driver = new ChromeDriver(options);

            _wait = new WebDriverWait(
                _driver,
                TimeSpan.FromSeconds(15));
        }

        private void RequireAdminCredentials()
        {
            if (string.IsNullOrWhiteSpace(_adminEmail) ||
                string.IsNullOrWhiteSpace(_adminPassword))
            {
                Assert.Ignore(
                    "Set CARENOVA_ADMIN_EMAIL and CARENOVA_ADMIN_PASSWORD before running this test.");
            }
        }

        private void RequireTestUserCredentials()
        {
            if (string.IsNullOrWhiteSpace(_testUserEmail) ||
                string.IsNullOrWhiteSpace(_testUserPassword))
            {
                Assert.Ignore(
                    "Set CARENOVA_TEST_USER_EMAIL and CARENOVA_TEST_USER_PASSWORD before running this test.");
            }
        }

        private void Login(string email, string password)
        {
            _driver.Navigate().GoToUrl($"{_baseUrl}/login");

            var emailInput = _wait.Until(
                d => d.FindElement(By.Name("email")));

            var passwordInput =
                _driver.FindElement(By.Name("password"));

            emailInput.Clear();
            emailInput.SendKeys(email);

            passwordInput.Clear();
            passwordInput.SendKeys(password);

            _driver
                .FindElement(By.CssSelector("button[type='submit']"))
                .Click();

            _wait.Until(d =>
                d.Url.Contains("-dashboard") ||
                d.Url.Contains("/forbidden"));
        }

        private void LoginAsAdmin()
        {
            RequireAdminCredentials();

            Login(_adminEmail, _adminPassword);

            _wait.Until(
                d => d.Url.Contains("/admin-dashboard"));

            Assert.That(
                _driver.Url,
                Does.Contain("/admin-dashboard"));
        }

        [Test]
        public void GCN24_TC01_Admin_ShouldAccessUserManagementPage()
        {
            LoginAsAdmin();

            _driver.Navigate().GoToUrl(
                $"{_baseUrl}/admin/users");

            _wait.Until(d =>
                d.Url.Contains("/admin/users"));

            var heading = _wait.Until(d =>
                d.FindElement(By.TagName("h1")));

            Assert.That(
                heading.Text,
                Is.EqualTo("User Management"));

            Assert.That(
                _driver.PageSource,
                Does.Contain("View registered users, assign roles, and manage account status"));
        }

        [Test]
        public void GCN24_TC02_Admin_ShouldSearchForRegisteredUserByEmail()
        {
            RequireTestUserCredentials();
            LoginAsAdmin();

            _driver.Navigate().GoToUrl(
                $"{_baseUrl}/admin/users");

            var searchInput = _wait.Until(d =>
                d.FindElement(
                    By.CssSelector(
                        "input[placeholder='Search by full name or email...']")));

            searchInput.Clear();
            searchInput.SendKeys(_testUserEmail);

            var searchButton = _driver
                .FindElements(By.TagName("button"))
                .First(button =>
                    button.Text.Contains(
                        "Search",
                        StringComparison.OrdinalIgnoreCase));

            searchButton.Click();

            _wait.Until(d =>
                d.PageSource.Contains(_testUserEmail));

            Assert.That(
                _driver.PageSource,
                Does.Contain(_testUserEmail));
        }

        [Test]
        public void GCN24_TC03_Admin_ShouldViewUserDetails()
        {
            RequireTestUserCredentials();
            LoginAsAdmin();

            _driver.Navigate().GoToUrl(
                $"{_baseUrl}/admin/users");

            var searchInput = _wait.Until(d =>
                d.FindElement(
                    By.CssSelector(
                        "input[placeholder='Search by full name or email...']")));

            searchInput.SendKeys(_testUserEmail);

            var searchButton = _driver
                .FindElements(By.TagName("button"))
                .First(button =>
                    button.Text.Contains(
                        "Search",
                        StringComparison.OrdinalIgnoreCase));

            searchButton.Click();

            _wait.Until(d =>
                d.PageSource.Contains(_testUserEmail));

            var userRow = _wait.Until(d =>
                d.FindElements(By.CssSelector("tbody tr"))
                    .FirstOrDefault(row =>
                        row.Text.Contains(
                            _testUserEmail,
                            StringComparison.OrdinalIgnoreCase)));

            Assert.That(
                userRow,
                Is.Not.Null,
                "Expected test user row was not found.");

            var viewButton = userRow!
                .FindElements(By.TagName("button"))
                .First(button =>
                    button.Text.Contains(
                        "View",
                        StringComparison.OrdinalIgnoreCase));

            viewButton.Click();

            var detailHeading = _wait.Until(d =>
                d.FindElements(By.TagName("h2"))
                    .FirstOrDefault(h =>
                        h.Text == "User Details"));

            Assert.That(
                detailHeading,
                Is.Not.Null);

            _wait.Until(d =>
                d.PageSource.Contains(_testUserEmail));

            Assert.That(
                _driver.PageSource,
                Does.Contain(_testUserEmail));

            Assert.That(
                _driver.PageSource,
                Does.Contain("Account Status"));
        }

        [Test]
        public void GCN24_TC04_NonAdminUser_ShouldBeRedirectedToForbiddenPage()
        {
            RequireTestUserCredentials();

            Login(
                _testUserEmail,
                _testUserPassword);

            Assert.That(
                _driver.Url,
                Does.Not.Contain("/admin-dashboard"));

            _driver.Navigate().GoToUrl(
                $"{_baseUrl}/admin/users");

            _wait.Until(d =>
                d.Url.Contains("/forbidden"));

            Assert.That(
                _driver.Url,
                Does.Contain("/forbidden"));

            _driver.Navigate().GoToUrl(
                $"{_baseUrl}/admin-dashboard");

            _wait.Until(d =>
                d.Url.Contains("/forbidden"));

            Assert.That(
                _driver.Url,
                Does.Contain("/forbidden"));
        }

        [TearDown]
        public void Teardown()
        {
            _driver?.Quit();
            _driver?.Dispose();
        }
    }
}
