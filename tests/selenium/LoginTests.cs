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

        private readonly string _validEmail = "gcn20.selenium@example.com";
        private readonly string _validPassword = "Test@123";

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
        public void ValidLogin_ShouldRedirectToPatientDashboard()
        {
            Login(_validEmail, _validPassword);

            _wait.Until(
                d => d.Url.Contains("/patient-dashboard")
            );

            Assert.That(
                _driver.Url,
                Does.Contain("/patient-dashboard"),
                "A successfully authenticated Patient should be redirected to /patient-dashboard."
            );
        }

        [Test]
        public void InvalidPassword_ShouldRemainOnLoginPage()
        {
            Login(
                _validEmail,
                "WrongPassword123!"
            );

            _wait.Until(
                d => d.Url.Contains("/login")
            );

            Assert.That(
                _driver.Url,
                Does.Contain("/login"),
                "Invalid credentials must not allow access to an authenticated page."
            );
        }

        [Test]
        public void UnauthenticatedUser_AccessingProfile_ShouldRedirectToLogin()
        {
            _driver.Navigate().GoToUrl(
                $"{_baseUrl}/profile"
            );

            _wait.Until(
                d => d.Url.Contains("/login")
            );

            Assert.That(
                _driver.Url,
                Does.Contain("/login"),
                "Unauthenticated users should be redirected to /login."
            );
        }

        [Test]
        public void ValidLogin_ShouldStoreAuthenticationToken()
        {
            Login(_validEmail, _validPassword);

            _wait.Until(
                d => d.Url.Contains("/patient-dashboard")
            );

            var js = (IJavaScriptExecutor)_driver;

            var token = js.ExecuteScript(
                "return window.localStorage.getItem('carenova_token');"
            );

            Assert.That(
                token,
                Is.Not.Null,
                "Successful login should store an authentication token in localStorage."
            );

            Assert.That(
                token.ToString(),
                Is.Not.Empty,
                "Stored authentication token should not be empty."
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