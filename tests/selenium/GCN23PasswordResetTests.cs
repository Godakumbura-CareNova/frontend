using System;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.Frontend.Tests.Selenium
{
    [TestFixture]
    public class GCN23PasswordResetTests
    {
        private IWebDriver _driver;
        private WebDriverWait _wait;

        private readonly string _baseUrl =
            Environment.GetEnvironmentVariable("CARENOVA_BASE_URL")
            ?? "http://localhost:3000";

        [SetUp]
        public void Setup()
        {
            var options = new ChromeOptions();

            options.AddArgument("--headless");
            options.AddArgument("--window-size=1920,1080");

            _driver = new ChromeDriver(options);

            _wait = new WebDriverWait(
                _driver,
                TimeSpan.FromSeconds(10));
        }

        // ============================================================
        // GCN23-01
        // Login -> Forgot Password navigation
        // ============================================================

        [Test]
        public void GCN23_01_LoginPage_ClickForgotPassword_ShouldOpenForgotPasswordPage()
        {
            _driver.Navigate().GoToUrl($"{_baseUrl}/login");

            var forgotPasswordLink = _wait.Until(
                d => d.FindElement(
                    By.LinkText("Forgot password?")));

            forgotPasswordLink.Click();

            _wait.Until(
                d => d.Url.Contains("/forgot-password"));

            Assert.That(
                _driver.Url,
                Does.Contain("/forgot-password"));

            Assert.That(
                _driver.PageSource,
                Does.Contain(
                    "Enter your email to receive recovery instructions"));
        }

        // ============================================================
        // GCN23-02
        // Invalid email should be rejected
        // Chrome performs HTML5 email validation before React submit
        // ============================================================

        [Test]
        public void GCN23_02_InvalidEmail_ShouldBeRejectedByBrowserValidation()
        {
            _driver.Navigate().GoToUrl(
                $"{_baseUrl}/forgot-password");

            var emailInput = _wait.Until(
                d => d.FindElement(
                    By.CssSelector("input[type='email']")));

            var submitButton = _driver.FindElement(
                By.CssSelector("button[type='submit']"));

            emailInput.SendKeys("abc");

            submitButton.Click();

            var js = (IJavaScriptExecutor)_driver;

            var isValid = (bool)js.ExecuteScript(
                "return arguments[0].validity.valid;",
                emailInput);

            var validationMessage = (string)js.ExecuteScript(
                "return arguments[0].validationMessage;",
                emailInput);

            Assert.That(
                isValid,
                Is.False,
                "Invalid email should fail browser validation.");

            Assert.That(
                validationMessage,
                Is.Not.Empty,
                "Browser should display an email validation message.");
        }

        // ============================================================
        // GCN23-05
        // Weak password validation
        // ============================================================

        [Test]
        public void GCN23_05_WeakPassword_ShouldShowPasswordStrengthError()
        {
            _driver.Navigate().GoToUrl(
                $"{_baseUrl}/reset-password?token=test-token");

            var passwordInputs = _wait.Until(
                d => d.FindElements(
                    By.CssSelector("input[type='password']")));

            Assert.That(
                passwordInputs.Count,
                Is.GreaterThanOrEqualTo(2),
                "Reset password page should contain two password fields.");

            passwordInputs[0].SendKeys("abc123");
            passwordInputs[1].SendKeys("abc123");

            var submitButton = _driver.FindElement(
                By.CssSelector("button[type='submit']"));

            submitButton.Click();

            var error = _wait.Until(
                d => d.FindElement(
                    By.CssSelector(".alert-error")));

            Assert.That(
                error.Text,
                Is.EqualTo(
                    "Password must be at least 6 characters and include an uppercase letter, lowercase letter, number, and special character."));
        }

        // ============================================================
        // GCN23-06
        // Password confirmation mismatch
        // ============================================================

        [Test]
        public void GCN23_06_MismatchedPasswords_ShouldShowMismatchError()
        {
            _driver.Navigate().GoToUrl(
                $"{_baseUrl}/reset-password?token=test-token");

            var passwordInputs = _wait.Until(
                d => d.FindElements(
                    By.CssSelector("input[type='password']")));

            Assert.That(
                passwordInputs.Count,
                Is.GreaterThanOrEqualTo(2),
                "Reset password page should contain two password fields.");

            passwordInputs[0].SendKeys("Test@456");
            passwordInputs[1].SendKeys("Different@456");

            var submitButton = _driver.FindElement(
                By.CssSelector("button[type='submit']"));

            submitButton.Click();

            var error = _wait.Until(
                d => d.FindElement(
                    By.CssSelector(".alert-error")));

            Assert.That(
                error.Text,
                Is.EqualTo("Passwords do not match."));
        }

        [TearDown]
        public void Teardown()
        {
            _driver?.Quit();
            _driver?.Dispose();
        }
    }
}