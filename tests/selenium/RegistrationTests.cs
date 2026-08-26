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

            options.AddArgument("--headless=new");
            options.AddArgument("--window-size=1920,1080");

            _driver = new ChromeDriver(options);

            _wait = new WebDriverWait(
                _driver,
                TimeSpan.FromSeconds(10)
            );
        }

        [Test]
        public void RegistrationPage_ShouldLoadSuccessfully()
        {
            _driver.Navigate().GoToUrl($"{_baseUrl}/register");

            var fullNameInput = _wait.Until(
                d => d.FindElement(By.Name("fullName"))
            );

            Assert.That(
                fullNameInput.Displayed,
                Is.True,
                "Full name field should be visible."
            );

            Assert.That(
                _driver.Url,
                Does.Contain("/register")
            );
        }

        [Test]
        public void Registration_EmptyForm_ShouldShowRequiredValidation()
        {
            _driver.Navigate().GoToUrl($"{_baseUrl}/register");

            var submitButton = _wait.Until(
                d => d.FindElement(By.CssSelector("button[type='submit']"))
            );

            submitButton.Click();

            var pageText = _driver.FindElement(By.TagName("body")).Text;

            Assert.That(
                pageText,
                Does.Contain("This field is required.")
            );
        }

        [Test]
        public void Registration_WithInvalidEmail_ShouldShowValidationError()
        {
            _driver.Navigate().GoToUrl($"{_baseUrl}/register");

            _wait.Until(
                d => d.FindElement(By.Name("fullName"))
            ).SendKeys("QA Selenium User");

            _driver.FindElement(By.Name("email"))
                .SendKeys("invalid-email");

            var submitButton =
                _driver.FindElement(By.CssSelector("button[type='submit']"));

            submitButton.Click();

            var pageText =
                _driver.FindElement(By.TagName("body")).Text;

            Assert.That(
                pageText,
                Does.Contain("valid email")
                    .IgnoreCase
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