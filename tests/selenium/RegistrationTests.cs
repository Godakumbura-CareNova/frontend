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
            options.AddArgument("--window-size=1920,1080");

            _driver = new ChromeDriver(options);

            _wait = new WebDriverWait(
                _driver,
                TimeSpan.FromSeconds(10)
            );
        }

        private void OpenRegistrationPage()
        {
            _driver.Navigate().GoToUrl(
                $"{_baseUrl}/register"
            );

            _wait.Until(d =>
                d.FindElement(
                    By.Name("fullName")
                ).Displayed
            );
        }

        private string CreateUniqueEmail()
        {
            return $"gcn15_{Guid.NewGuid():N}@example.com";
        }

        private void SetInputValue(
            string fieldName,
            string value)
        {
            var element =
                _driver.FindElement(
                    By.Name(fieldName)
                );

            var js =
                (IJavaScriptExecutor)_driver;

            js.ExecuteScript(
                @"
                const element = arguments[0];
                const value = arguments[1];

                const setter =
                    Object.getOwnPropertyDescriptor(
                        window.HTMLInputElement.prototype,
                        'value'
                    ).set;

                setter.call(element, value);

                element.dispatchEvent(
                    new Event(
                        'input',
                        { bubbles: true }
                    )
                );

                element.dispatchEvent(
                    new Event(
                        'change',
                        { bubbles: true }
                    )
                );
                ",
                element,
                value
            );
        }

        private void SetDate(string value)
        {
            SetInputValue(
                "dateOfBirth",
                value
            );
        }

        private void FillValidPersonalDetails(
            string email,
            bool includeLandPhone = true,
            string dateOfBirth = "2000-05-10")
        {
            _driver.FindElement(
                By.Name("fullName")
            ).SendKeys("Test Patient");

            _driver.FindElement(
                By.Name("email")
            ).SendKeys(email);

            _driver.FindElement(
                By.Name("mobileNumber")
            ).SendKeys("0771234567");

            if (includeLandPhone)
            {
                _driver.FindElement(
                    By.Name("landPhoneNumber")
                ).SendKeys("0112233445");
            }

            _driver.FindElement(
                By.Name("address")
            ).SendKeys("Colombo");

            SetDate(dateOfBirth);

            var gender =
                new SelectElement(
                    _driver.FindElement(
                        By.Name("gender")
                    )
                );

            gender.SelectByValue("Male");
        }

        [Test]
        public void GCN15_TC01_RegistrationPage_ShouldLoad()
        {
            OpenRegistrationPage();

            Assert.That(
                _driver.FindElement(
                    By.Name("fullName")
                ).Displayed,
                Is.True
            );

            Assert.That(
                _driver.FindElement(
                    By.Name("email")
                ).Displayed,
                Is.True
            );
        }

        [Test]
        public void GCN15_TC02_AllPersonalDetailFields_ShouldBeDisplayed()
        {
            OpenRegistrationPage();

            Assert.That(
                _driver.FindElement(
                    By.Name("fullName")
                ).Displayed,
                Is.True
            );

            Assert.That(
                _driver.FindElement(
                    By.Name("email")
                ).Displayed,
                Is.True
            );

            Assert.That(
                _driver.FindElement(
                    By.Name("mobileNumber")
                ).Displayed,
                Is.True
            );

            Assert.That(
                _driver.FindElement(
                    By.Name("landPhoneNumber")
                ).Displayed,
                Is.True
            );

            Assert.That(
                _driver.FindElement(
                    By.Name("address")
                ).Displayed,
                Is.True
            );

            Assert.That(
                _driver.FindElement(
                    By.Name("dateOfBirth")
                ).Displayed,
                Is.True
            );

            Assert.That(
                _driver.FindElement(
                    By.Name("gender")
                ).Displayed,
                Is.True
            );
        }

        [Test]
        public void GCN15_TC03_EmptyRequiredFields_ShouldShowErrors()
        {
            OpenRegistrationPage();

            _driver.FindElement(
                By.CssSelector(
                    "button[type='submit']"
                )
            ).Click();

            var errors =
                _driver.FindElements(
                    By.CssSelector(
                        ".field-error"
                    )
                );

            Assert.That(
                errors.Count,
                Is.GreaterThan(0)
            );
        }

        [Test]
        public void GCN15_TC04_InvalidEmail_ShouldShowError()
        {
            OpenRegistrationPage();

            FillValidPersonalDetails(
                "invalid-email"
            );

            _driver.FindElement(
                By.CssSelector(
                    "button[type='submit']"
                )
            ).Click();

            var error =
                _driver.FindElement(
                    By.XPath(
                        "//input[@name='email']" +
                        "/following-sibling::*" +
                        "[contains(@class,'field-error')]"
                    )
                );

            Assert.That(
                error.Text,
                Does.Contain("valid email")
            );
        }

        [Test]
        public void GCN15_TC05_MissingMobile_ShouldShowRequiredError()
        {
            OpenRegistrationPage();

            FillValidPersonalDetails(
                CreateUniqueEmail()
            );

            SetInputValue(
                "mobileNumber",
                ""
            );

            _driver.FindElement(
                By.CssSelector(
                    "button[type='submit']"
                )
            ).Click();

            var error =
                _driver.FindElement(
                    By.XPath(
                        "//input[@name='mobileNumber']" +
                        "/following-sibling::*" +
                        "[contains(@class,'field-error')]"
                    )
                );

            Assert.That(
                error.Text,
                Does.Contain("required")
            );
        }

        [Test]
        public void GCN15_TC06_MissingLandPhone_ShouldBeAllowed()
        {
            OpenRegistrationPage();

            FillValidPersonalDetails(
                CreateUniqueEmail(),
                includeLandPhone: false
            );

            _driver.FindElement(
                By.CssSelector(
                    "button[type='submit']"
                )
            ).Click();

            var errors =
                _driver.FindElements(
                    By.XPath(
                        "//input[@name='landPhoneNumber']" +
                        "/following-sibling::*" +
                        "[contains(@class,'field-error')]"
                    )
                );

            Assert.That(
                errors.Count,
                Is.EqualTo(0),
                "Land phone is optional."
            );
        }

        [Test]
        public void GCN15_TC07_FutureDateOfBirth_ShouldShowError()
        {
            OpenRegistrationPage();

            FillValidPersonalDetails(
                CreateUniqueEmail(),
                dateOfBirth: "2030-01-01"
            );

            _driver.FindElement(
                By.CssSelector(
                    "button[type='submit']"
                )
            ).Click();

            var error =
                _driver.FindElement(
                    By.XPath(
                        "//input[@name='dateOfBirth']" +
                        "/following-sibling::*" +
                        "[contains(@class,'field-error')]"
                    )
                );

            Assert.That(
                error.Text,
                Does.Contain("past")
            );
        }

        [Test]
        public void GCN15_TC08_Under16_ShouldShowAgeError()
        {
            OpenRegistrationPage();

            var today =
                DateTime.Today;

            var under16 =
                today
                    .AddYears(-16)
                    .AddDays(1);

            FillValidPersonalDetails(
                CreateUniqueEmail(),
                dateOfBirth:
                    under16.ToString(
                        "yyyy-MM-dd"
                    )
            );

            _driver.FindElement(
                By.CssSelector(
                    "button[type='submit']"
                )
            ).Click();

            var error =
                _driver.FindElement(
                    By.XPath(
                        "//input[@name='dateOfBirth']" +
                        "/following-sibling::*" +
                        "[contains(@class,'field-error')]"
                    )
                );

            Assert.That(
                error.Text,
                Does.Contain(
                    "at least 16"
                )
            );
        }

        [Test]
        public void GCN15_TC09_GenderSelection_ShouldWork()
        {
            OpenRegistrationPage();

            var gender =
                new SelectElement(
                    _driver.FindElement(
                        By.Name("gender")
                    )
                );

            gender.SelectByValue(
                "Female"
            );

            Assert.That(
                gender.SelectedOption
                      .GetAttribute("value"),
                Is.EqualTo("Female")
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
