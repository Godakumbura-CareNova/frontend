using System;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.Frontend.Tests.Selenium
{
    /// <summary>
    /// GCN-39 end-to-end tests for medicine payment-method selection.
    /// Requires auth (5133), pharmacy (5134), doctor-payment (5135),
    /// Kafka (9092), and frontend (3000).
    /// </summary>
    [TestFixture]
    public class GCN39PaymentMethodTests
    {
        private IWebDriver _driver;
        private WebDriverWait _wait;

        private const string BaseUrl = "http://localhost:3000";
        private const string PatientEmail = "patient@gmail.com";

        [SetUp]
        public void Setup()
        {
            var password = Environment.GetEnvironmentVariable(
                "CARENOVA_PATIENT_PASSWORD");

            if (string.IsNullOrWhiteSpace(password))
            {
                Assert.Fail(
                    "Set CARENOVA_PATIENT_PASSWORD before running GCN-39 Selenium tests.");
            }

            var options = new ChromeOptions();
            options.AddArgument("--headless");
            options.AddArgument("--window-size=1400,1000");

            _driver = new ChromeDriver(options);
            _wait = new WebDriverWait(
                _driver,
                TimeSpan.FromSeconds(15));

            LoginAsPatient(password);
        }

        private void LoginAsPatient(string password)
        {
            _driver.Navigate().GoToUrl($"{BaseUrl}/login");

            _wait.Until(d =>
                d.FindElement(By.Id("login-email")))
                .SendKeys(PatientEmail);

            _driver.FindElement(By.Id("login-password"))
                .SendKeys(password);

            _driver.FindElement(
                By.CssSelector("button[type='submit']"))
                .Click();

            _wait.Until(d =>
                d.Url.Contains("patient-dashboard"));
        }

        private void OpenPaymentPage()
        {
            // Existing order created during manual GCN-39 QA.
            _driver.Navigate().GoToUrl(
                $"{BaseUrl}/patient/orders/5/payment");

            _wait.Until(d =>
                d.PageSource.Contains("Payment method"));
        }

        [Test]
        public void PaymentPage_ShouldDisplayAvailablePaymentMethods()
        {
            OpenPaymentPage();

            Assert.That(
                _wait.Until(d =>
                    d.PageSource.Contains("Online payment")),
                Is.True);

            Assert.That(
                _driver.PageSource.Contains("Bank transfer"),
                Is.True);

            Assert.That(
                _driver.PageSource.Contains("Cash"),
                Is.True);
        }


        [Test]
        public void OnlinePayment_ShouldBeSelectable()
        {
            OpenPaymentPage();

            var online = _wait.Until(d =>
                d.FindElement(By.XPath(
                    "//label[contains(.,'Online payment')]//input")));

            online.Click();

            Assert.That(online.Selected, Is.True);
        }

        [Test]
        public void BankTransfer_ShouldBeSelectable()
        {
            OpenPaymentPage();

            var bank = _wait.Until(d =>
                d.FindElement(By.XPath(
                    "//label[contains(.,'Bank transfer')]//input")));

            bank.Click();

            Assert.That(bank.Selected, Is.True);
        }

        [Test]
        public void Cash_ShouldBeSelectableForEligibleOrder()
        {
            OpenPaymentPage();

            var cash = _wait.Until(d =>
                d.FindElement(By.XPath(
                    "//label[contains(.,'Cash')]//input")));

            Assert.That(cash.Enabled, Is.True);

            cash.Click();

            Assert.That(cash.Selected, Is.True);
        }

        [TearDown]
        public void TearDown()
        {
            _driver?.Quit();
            _driver?.Dispose();
        }
    }
}