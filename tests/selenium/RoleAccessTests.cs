using System;
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

        [SetUp]
        public void Setup()
        {
            var options = new ChromeOptions();
            options.AddArgument("--headless");
            _driver = new ChromeDriver(options);
            _wait = new WebDriverWait(_driver, TimeSpan.FromSeconds(10));
        }

        [Test]
        public void UnauthenticatedUser_AccessingProtectedPage_ShouldRedirectToLogin()
        {
            _driver.Navigate().GoToUrl($"{_baseUrl}/admin-dashboard");

            _wait.Until(d => d.Url.Contains("/login"));
            Assert.IsTrue(_driver.Url.Contains("/login"), "Unauthenticated user attempting to access protected route should be redirected to login.");
        }

        [TearDown]
        public void Teardown()
        {
            _driver?.Quit();
            _driver?.Dispose();
        }
    }
}
