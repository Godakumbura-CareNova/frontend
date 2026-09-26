using System;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.Frontend.Tests.Selenium
{
    [TestFixture]
    public class GCN38FeeChangeTests
    {
        private IWebDriver _driver;
        private WebDriverWait _wait;

        private readonly string _baseUrl = "http://localhost:3000";

        private string DoctorPassword =>
            Environment.GetEnvironmentVariable("CARENOVA_DOCTOR_PASSWORD")
            ?? throw new InvalidOperationException(
                "CARENOVA_DOCTOR_PASSWORD environment variable is not set.");

        [SetUp]
        public void Setup()
        {
            var options = new ChromeOptions();
            options.AddArgument("--headless");
            options.AddArgument("--window-size=1920,1080");

            _driver = new ChromeDriver(options);
            _wait = new WebDriverWait(_driver, TimeSpan.FromSeconds(15));

            LoginAsDoctor();
            _driver.Navigate().GoToUrl($"{_baseUrl}/profile");

            _wait.Until(d =>
                d.PageSource.Contains("Consultation Fee"));
        }

        private void LoginAsDoctor()
        {
            _driver.Navigate().GoToUrl($"{_baseUrl}/login");

            var email = _wait.Until(d =>
                d.FindElement(By.Name("email")));

            var password = _driver.FindElement(By.Name("password"));

            email.SendKeys("doctor@gmail.com");
            password.SendKeys(DoctorPassword);

            _driver.FindElement(
                By.CssSelector("button[type='submit']")
            ).Click();

            _wait.Until(d => d.Url.Contains("-dashboard"));
        }

        [Test]
        public void ConsultationFee_ShouldBeDisplayed()
        {
            var fee = _wait.Until(d =>
                d.FindElement(
                    By.CssSelector("[data-testid='doctor-consultation-fee']")
                ));

            Assert.That(fee.Displayed, Is.True);
            Assert.That(fee.Text, Is.Not.Empty);
        }

        [Test]
        public void RequestFeeChange_ShouldOpenRequestForm()
        {
            var requestButton = _wait.Until(d =>
                d.FindElement(
                    By.XPath("//button[contains(., 'Request Fee Change')]")
                ));

            Assert.That(requestButton.Enabled, Is.True);

            requestButton.Click();

            var continueButton = _wait.Until(d =>
                d.FindElement(
                    By.XPath("//button[contains(., 'Yes, Continue')]")
                ));

            continueButton.Click();

            var feeInput = _wait.Until(d =>
                d.FindElement(By.Name("requestedFee")));

            Assert.That(feeInput.Displayed, Is.True);
        }

        [Test]
        public void InvalidZeroFee_ShouldShowValidationError()
        {
            var requestButton = _wait.Until(d =>
                d.FindElement(
                    By.XPath("//button[contains(., 'Request Fee Change')]")
                ));

            requestButton.Click();

            _wait.Until(d =>
                d.FindElement(
                    By.XPath("//button[contains(., 'Yes, Continue')]")
                )).Click();

            var feeInput = _wait.Until(d =>
                d.FindElement(By.Name("requestedFee")));

            feeInput.Clear();
            feeInput.SendKeys("0");

            _driver.FindElement(
                By.XPath("//button[contains(., 'Submit Request')]")
            ).Click();

            var error = _wait.Until(d =>
                d.FindElement(
                    By.XPath("//*[contains(text(), 'greater than 0')]")
                ));

            Assert.That(error.Displayed, Is.True);
        }

        [Test]
        public void OpeningRequestForm_ShouldShowCurrentFee()
        {
            var displayedFee = _wait.Until(d =>
                d.FindElement(
                    By.CssSelector("[data-testid='doctor-consultation-fee']")
                )).Text;

            var requestButton = _driver.FindElement(
                By.XPath("//button[contains(., 'Request Fee Change')]")
            );

            requestButton.Click();

            _wait.Until(d =>
                d.FindElement(
                    By.XPath("//button[contains(., 'Yes, Continue')]")
                )).Click();

            var form = _wait.Until(d =>
                d.FindElement(
                    By.CssSelector("form[aria-label='Request consultation fee change']")
                ));

            Assert.That(
                form.Text,
                Does.Contain("Current fee:")
            );

            Assert.That(displayedFee, Is.Not.Empty);
        }

        [TearDown]
        public void Teardown()
        {
            _driver?.Quit();
            _driver?.Dispose();
        }
    }
}