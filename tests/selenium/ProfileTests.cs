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
        public void GCN18_ProfileUpdate_WithAuthenticatedSession_ShouldDisplaySuccessAlert()
        {
            // Open the application first so localStorage is available
            _driver.Navigate().GoToUrl($"{_baseUrl}/login");

            var js = (IJavaScriptExecutor)_driver;

            js.ExecuteScript(
                "localStorage.setItem('carenova_token', 'gcn18-qa-token');");

            js.ExecuteScript(
                @"localStorage.setItem(
                    'carenova_user',
                    JSON.stringify({
                        id: '00000000-0000-0000-0000-000000000018',
                        email: 'gcn18.qa@example.com',
                        fullName: 'GCN18 QA Customer',
                        role: 'Patient'
                    })
                );");

            // Reload application with authenticated frontend state
            _driver.Navigate().GoToUrl($"{_baseUrl}/profile");

            var nameInput = _wait.Until(d =>
                d.FindElement(
                    By.XPath("//label[normalize-space()='Full Name']/following::input[1]")));

            nameInput.Clear();
            nameInput.SendKeys("GCN18 Selenium Updated Customer");

            var saveButton = _driver.FindElement(
                By.XPath("//button[contains(., 'Save Changes')]"));

            saveButton.Click();

            // Wait for either success or error so a defect produces
            // a useful assertion instead of a generic timeout.
            var alert = _wait.Until(d =>
                d.FindElement(By.CssSelector(".alert")));

            Assert.That(
                alert.GetAttribute("class"),
                Does.Contain("alert-success"),
                $"Expected successful GCN-18 profile update, but application displayed: '{alert.Text}'");
        }

        [TearDown]
        public void Teardown()
        {
            _driver?.Quit();
            _driver?.Dispose();
        }
    }
}
