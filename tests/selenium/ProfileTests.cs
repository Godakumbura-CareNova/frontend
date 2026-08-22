using System;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.Frontend.Tests.Selenium
{
    [TestFixture]
    public class ProfileTests
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
        public void ProfileUpdate_ShouldDisplaySuccessAlert()
        {
            _driver.Navigate().GoToUrl($"{_baseUrl}/login");

            // Perform mock login
            var emailInput = _wait.Until(d => d.FindElement(By.Name("email")));
            var passwordInput = _driver.FindElement(By.Name("password"));
            emailInput.SendKeys("testuser@carenova.org");
            passwordInput.SendKeys("Password123");
            _driver.FindElement(By.CssSelector("button[type='submit']")).Click();

            _wait.Until(d => d.Url.Contains("-dashboard"));

            // Navigate to profile page
            _driver.Navigate().GoToUrl($"{_baseUrl}/profile");

            var nameInput = _wait.Until(d => d.FindElement(By.XPath("//input[@value]")));
            nameInput.Clear();
            nameInput.SendKeys("Updated Test User");

            var saveButton = _driver.FindElement(By.CssSelector("button[type='submit']"));
            saveButton.Click();

            var alert = _wait.Until(d => d.FindElement(By.ClassName("alert-success")));
            Assert.IsNotNull(alert, "Profile update should trigger a success alert message.");
        }

        [TearDown]
        public void Teardown()
        {
            _driver?.Quit();
            _driver?.Dispose();
        }
    }
}
