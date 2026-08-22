using System;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.Frontend.Tests.Selenium
{
    [TestFixture]
    public class RegistrationTests
    {
        private IWebDriver _driver;
        private WebDriverWait _wait;
        private readonly string _baseUrl = "http://localhost:3000";

        [SetUp]
        public void Setup()
        {
            var options = new ChromeOptions();
            options.AddArgument("--headless");
            _driver = new ChromeDriver(options);
            _wait = new WebDriverWait(_driver, TimeSpan.FromSeconds(10));
        }

        [Test]
        public void UserRegistration_WithValidDetails_ShouldNavigateToLogin()
        {
            _driver.Navigate().GoToUrl($"{_baseUrl}/register");

            var fullNameInput = _wait.Until(d => d.FindElement(By.Name("fullName")));
            var emailInput = _driver.FindElement(By.Name("email"));
            var roleSelect = new SelectElement(_driver.FindElement(By.Name("role")));
            var passwordInput = _driver.FindElement(By.Name("password"));
            var confirmPasswordInput = _driver.FindElement(By.Name("confirmPassword"));
            var submitButton = _driver.FindElement(By.CssSelector("button[type='submit']"));

            string testEmail = $"user_{Guid.NewGuid().ToString().Substring(0, 6)}@carenova.org";

            fullNameInput.SendKeys("Test Patient");
            emailInput.SendKeys(testEmail);
            roleSelect.SelectByValue("Patient");
            passwordInput.SendKeys("SecurePass123");
            confirmPasswordInput.SendKeys("SecurePass123");

            submitButton.Click();

            _wait.Until(d => d.Url.Contains("/login"));
            Assert.IsTrue(_driver.Url.Contains("/login"), "User registration should redirect to login page.");
        }

        [TearDown]
        public void Teardown()
        {
            _driver?.Quit();
            _driver?.Dispose();
        }
    }
}
