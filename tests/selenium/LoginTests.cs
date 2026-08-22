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
            _driver = new ChromeDriver(options);
            _wait = new WebDriverWait(_driver, TimeSpan.FromSeconds(10));
        }

        [Test]
        public void UserLogin_WithValidCredentials_ShouldRedirectToDashboard()
        {
            _driver.Navigate().GoToUrl($"{_baseUrl}/login");

            var emailInput = _wait.Until(d => d.FindElement(By.Name("email")));
            var passwordInput = _driver.FindElement(By.Name("password"));
            var submitButton = _driver.FindElement(By.CssSelector("button[type='submit']"));

            emailInput.SendKeys("patient@carenova.org");
            passwordInput.SendKeys("Password123");
            submitButton.Click();

            _wait.Until(d => d.Url.Contains("-dashboard"));
            Assert.IsTrue(_driver.Url.Contains("dashboard"), "Successful login should redirect to a dashboard page.");
        }

        [TearDown]
        public void Teardown()
        {
            _driver?.Quit();
            _driver?.Dispose();
        }
    }
}
