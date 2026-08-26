using System;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.Frontend.Tests.Selenium.GCN16
{
    [TestFixture]
    [Category("GCN-16")]
    public class SecurePasswordRegistrationTests
    {
        private IWebDriver _driver = null!;
        private WebDriverWait _wait = null!;

        private readonly string _baseUrl =
            Environment.GetEnvironmentVariable("CARENOVA_BASE_URL")
            ?? "http://localhost:3000";

        [SetUp]
        public void Setup()
        {
            var options = new ChromeOptions();

            options.AddArgument("--headless=new");
            options.AddArgument("--window-size=1440,1200");
            options.AddArgument("--no-sandbox");
            options.AddArgument("--disable-dev-shm-usage");

            _driver = new ChromeDriver(options);

            _wait = new WebDriverWait(
                _driver,
                TimeSpan.FromSeconds(10)
            );

            OpenRegistrationPage();
        }

        private void OpenRegistrationPage()
        {
            _driver.Navigate().GoToUrl($"{_baseUrl}/register");

            _wait.Until(
                d => d.FindElement(By.Name("fullName")).Displayed
            );

            _wait.Until(
                d => d.FindElement(By.Name("password")).Displayed
            );
        }

        private void FillBaseRegistrationForm(
            string password,
            string confirmPassword
        )
        {
            _driver.FindElement(By.Name("fullName"))
                .SendKeys("GCN16 QA Patient");

            _driver.FindElement(By.Name("email"))
                .SendKeys(
                    $"gcn16_{Guid.NewGuid():N}@carenova.org"
                );

            _driver.FindElement(By.Name("password"))
                .SendKeys(password);

            _driver.FindElement(By.Name("confirmPassword"))
                .SendKeys(confirmPassword);

            _driver.FindElement(By.Name("mobileNumber"))
                .SendKeys("0771234567");

            /*
             * Current frontend implementation requires Land Phone.
             * We provide a valid value here because these tests are
             * specifically testing GCN-16 password validation.
             *
             * Optional Land Phone behavior should be tested separately
             * as a regression test.
             */
            _driver.FindElement(By.Name("landPhoneNumber"))
                .SendKeys("0571234567");

            _driver.FindElement(By.Name("address"))
                .SendKeys("No. 5, Temple Road, Welimada");

            _driver.FindElement(By.Name("dateOfBirth"))
                .SendKeys("01/01/2000");

            new SelectElement(
                _driver.FindElement(By.Name("gender"))
            ).SelectByValue("Male");
        }

        private void Submit()
        {
            _driver.FindElement(
                By.CssSelector("button[type='submit']")
            ).Click();
        }

        private IWebElement? PasswordError()
        {
            var matches = _driver.FindElements(
                By.XPath(
                    "//input[@name='password']" +
                    "/following-sibling::span[contains(@class,'field-error')]"
                )
            );

            return matches.Count > 0
                ? matches[0]
                : null;
        }

        private IWebElement? ConfirmPasswordError()
        {
            var matches = _driver.FindElements(
                By.XPath(
                    "//input[@name='confirmPassword']" +
                    "/following-sibling::span[contains(@class,'field-error')]"
                )
            );

            return matches.Count > 0
                ? matches[0]
                : null;
        }

        private void AssertPasswordRejectedByClient(
            string password
        )
        {
            FillBaseRegistrationForm(
                password,
                password
            );

            Submit();

            _wait.Until(
                _ => PasswordError() != null
            );

            Assert.That(
                PasswordError(),
                Is.Not.Null,
                $"GCN-16: Password '{password}' should be rejected."
            );

            Assert.That(
                _driver.Url,
                Does.Contain("/register"),
                "Invalid password must remain on registration page."
            );
        }

        // -------------------------------------------------
        // GCN16-TC02
        // Password shorter than 6 characters
        // -------------------------------------------------

        [Test]
        [Description(
            "GCN16-TC02: Reject password shorter than six characters."
        )]
        public void GCN16_TC02_PasswordShorterThanSixCharacters_ShouldBeRejected()
        {
            AssertPasswordRejectedByClient(
                "Ca@12"
            );
        }

        // -------------------------------------------------
        // GCN16-TC03
        // No uppercase letter
        // -------------------------------------------------

        [Test]
        [Description(
            "GCN16-TC03: Reject password without uppercase letter."
        )]
        public void GCN16_TC03_PasswordWithoutUppercase_ShouldBeRejected()
        {
            AssertPasswordRejectedByClient(
                "care@123"
            );
        }

        // -------------------------------------------------
        // GCN16-TC04
        // No lowercase letter
        // -------------------------------------------------

        [Test]
        [Description(
            "GCN16-TC04: Reject password without lowercase letter."
        )]
        public void GCN16_TC04_PasswordWithoutLowercase_ShouldBeRejected()
        {
            AssertPasswordRejectedByClient(
                "CARE@123"
            );
        }

        // -------------------------------------------------
        // GCN16-TC05
        // No number
        // -------------------------------------------------

        [Test]
        [Description(
            "GCN16-TC05: Reject password without number."
        )]
        public void GCN16_TC05_PasswordWithoutNumber_ShouldBeRejected()
        {
            AssertPasswordRejectedByClient(
                "Care@Test"
            );
        }

        // -------------------------------------------------
        // GCN16-TC06
        // No special character
        // -------------------------------------------------

        [Test]
        [Description(
            "GCN16-TC06: Reject password without special character."
        )]
        public void GCN16_TC06_PasswordWithoutSpecialCharacter_ShouldBeRejected()
        {
            AssertPasswordRejectedByClient(
                "Care1234"
            );
        }

        // -------------------------------------------------
        // Valid strong passwords
        // TC08, TC16, TC17
        // -------------------------------------------------

        [TestCase(
            "Aa@123",
            TestName =
                "GCN16_TC08_ExactlySixCharacterStrongPassword_ShouldPassClientValidation"
        )]

        [TestCase(
            "@Care123",
            TestName =
                "GCN16_TC16_SpecialCharacterAtBeginning_ShouldPassClientValidation"
        )]

        [TestCase(
            "Care123@",
            TestName =
                "GCN16_TC17_SpecialCharacterAtEnd_ShouldPassClientValidation"
        )]

        [Description(
            "Valid strong passwords should pass client-side password validation."
        )]
        public void ValidStrongPassword_ShouldNotShowPasswordValidationError(
            string password
        )
        {
            FillBaseRegistrationForm(
                password,
                password
            );

            Submit();

            System.Threading.Thread.Sleep(500);

            Assert.That(
                PasswordError(),
                Is.Null,
                $"Valid strong password '{password}' should not show password validation error."
            );
        }

        // -------------------------------------------------
        // GCN16-TC12
        // Password mismatch
        // -------------------------------------------------

        [Test]
        [Description(
            "GCN16-TC12: Password and Confirm Password must match."
        )]
        public void GCN16_TC12_MismatchedPasswords_ShouldShowConfirmPasswordError()
        {
            FillBaseRegistrationForm(
                "Care@123",
                "Care@124"
            );

            Submit();

            _wait.Until(
                _ => ConfirmPasswordError() != null
            );

            Assert.That(
                ConfirmPasswordError()!.Text,
                Does.Contain("Passwords do not match")
            );
        }

        // -------------------------------------------------
        // GCN16-TC13
        // Case-sensitive confirmation
        // -------------------------------------------------

        [Test]
        [Description(
            "GCN16-TC13: Password confirmation must be case-sensitive."
        )]
        public void GCN16_TC13_CaseDifferentConfirmation_ShouldBeRejected()
        {
            FillBaseRegistrationForm(
                "Care@123",
                "care@123"
            );

            Submit();

            _wait.Until(
                _ => ConfirmPasswordError() != null
            );

            Assert.That(
                ConfirmPasswordError()!.Text,
                Does.Contain("Passwords do not match")
            );
        }

        // -------------------------------------------------
        // GCN16-TC22
        // Password masking
        // -------------------------------------------------

        [Test]
        [Description(
            "GCN16-TC22: Password field must mask characters."
        )]
        public void GCN16_TC22_PasswordField_ShouldBeMasked()
        {
            var password =
                _driver.FindElement(
                    By.Name("password")
                );

            Assert.That(
                password.GetAttribute("type"),
                Is.EqualTo("password")
            );
        }

        // -------------------------------------------------
        // GCN16-TC23
        // Confirm Password masking
        // -------------------------------------------------

        [Test]
        [Description(
            "GCN16-TC23: Confirm Password field must mask characters."
        )]
        public void GCN16_TC23_ConfirmPasswordField_ShouldBeMasked()
        {
            var confirmPassword =
                _driver.FindElement(
                    By.Name("confirmPassword")
                );

            Assert.That(
                confirmPassword.GetAttribute("type"),
                Is.EqualTo("password")
            );
        }

        // -------------------------------------------------
        // GCN16-TC24
        // Fix invalid password
        // -------------------------------------------------

        [Test]
        [Description(
            "GCN16-TC24: Password error should clear after password is corrected."
        )]
        public void GCN16_TC24_CorrectingInvalidPassword_ShouldClearPasswordError()
        {
            FillBaseRegistrationForm(
                "Ca@12",
                "Ca@12"
            );

            Submit();

            _wait.Until(
                _ => PasswordError() != null
            );

            Assert.That(
                PasswordError(),
                Is.Not.Null
            );

            var passwordInput =
                _driver.FindElement(
                    By.Name("password")
                );

            passwordInput.Clear();

            passwordInput.SendKeys(
                "Care@123"
            );

            _wait.Until(
                _ => PasswordError() == null
            );

            Assert.That(
                PasswordError(),
                Is.Null
            );
        }

        [TearDown]
        public void Teardown()
        {
            try
            {
                _driver?.Quit();
            }
            finally
            {
                _driver?.Dispose();
            }
        }
    }
}