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

        [Test]
        public void GCN17_ViewCustomerProfile_ShouldDisplayRegisteredCustomerDetails()
        {
            _driver.Navigate().GoToUrl($"{_baseUrl}/login");

            var emailInput = _wait.Until(
                d => d.FindElement(By.Name("email")));

            var passwordInput = _driver.FindElement(By.Name("password"));

            emailInput.SendKeys("gcn17.qa@example.com");
            passwordInput.SendKeys("Test@123");

            _driver.FindElement(
                By.CssSelector("button[type='submit']")).Click();

            _wait.Until(d => d.Url.Contains("/patient-dashboard"));

            _driver.Navigate().GoToUrl($"{_baseUrl}/profile");

            var heading = _wait.Until(
                d => d.FindElement(
                    By.XPath("//h1[contains(normalize-space(.), 'Customer Profile')]")));

            Assert.That(heading.Displayed, Is.True);

            var pageText = _driver.FindElement(By.TagName("body")).Text;

            Assert.Multiple(() =>
            {
                Assert.That(pageText, Does.Contain("GCN17 QA Customer"));
                Assert.That(pageText, Does.Contain("gcn17.qa@example.com"));
                Assert.That(pageText, Does.Contain("0771234567"));
                Assert.That(pageText, Does.Contain("0112345678"));
                Assert.That(pageText, Does.Contain("Colombo, Sri Lanka"));
                Assert.That(pageText, Does.Contain("May 15, 2000"));
                Assert.That(pageText, Does.Contain("Male"));
            });
        }

        [TearDown]
        public void Teardown()
        {
            _driver?.Quit();
            _driver?.Dispose();
        }
    }
}
