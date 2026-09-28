using System;
using System.Linq;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.Frontend.Tests.Selenium
{
  
    [TestFixture]
    public class GCN43PaymentTransactionTests
    {
        private IWebDriver _driver = null!;
        private WebDriverWait _wait = null!;

        private const string BaseUrl = "http://localhost:3000";

        [SetUp]
        public void Setup()
        {
            var options = new ChromeOptions();

            // Headed mode:
            // Chrome will visibly open during Selenium tests.
            options.AddArgument("--window-size=1400,1000");

            _driver = new ChromeDriver(options);

            _wait = new WebDriverWait(
                _driver,
                TimeSpan.FromSeconds(15)
            );
        }

        private void LoginAsStaff()
        {
            var email =
                Environment.GetEnvironmentVariable("CARENOVA_STAFF_EMAIL");

            var password =
                Environment.GetEnvironmentVariable("CARENOVA_STAFF_PASSWORD");

            if (string.IsNullOrWhiteSpace(email) ||
                string.IsNullOrWhiteSpace(password))
            {
                Assert.Ignore(
                    "Set CARENOVA_STAFF_EMAIL and CARENOVA_STAFF_PASSWORD."
                );
            }

            _driver.Navigate().GoToUrl($"{BaseUrl}/login");

            _wait.Until(d =>
                d.FindElement(By.Id("login-email"))
            ).SendKeys(email);

            _driver.FindElement(
                By.Id("login-password")
            ).SendKeys(password);

            _driver.FindElement(
                By.CssSelector("button[type='submit']")
            ).Click();

            _wait.Until(d =>
                !d.Url.Contains("/login")
            );
        }

        private void OpenPaymentTransactions()
        {
            LoginAsStaff();

            _driver.Navigate().GoToUrl(
                $"{BaseUrl}/pharmacy/payment-transactions"
            );

            _wait.Until(d =>
                d.FindElements(By.TagName("h1"))
                    .Any(element =>
                        element.Text.Contains(
                            "Medicine payment transactions"
                        ))
            );
        }

        [Test]
        public void PaymentTransactionsPage_ShowsStatusSummary()
        {
            OpenPaymentTransactions();

            Assert.That(
                _driver.PageSource,
                Does.Contain("Medicine payment transactions")
            );

            Assert.That(
                _driver.PageSource,
                Does.Contain("All")
            );

            Assert.That(
                _driver.PageSource,
                Does.Contain("Pending")
            );

            Assert.That(
                _driver.PageSource,
                Does.Contain("Successful")
            );

            Assert.That(
                _driver.PageSource,
                Does.Contain("Failed")
            );

            Assert.That(
                _driver.PageSource,
                Does.Contain("Rejected")
            );
        }

        [Test]
        public void PaymentTransactionsPage_ShowsTransactionTable()
        {
            OpenPaymentTransactions();

            _wait.Until(d =>
                d.FindElements(
                    By.CssSelector(".transactions-table tbody tr")
                ).Any()
            );

            Assert.That(
                _driver.PageSource,
                Does.Contain("Payment status")
            );

            Assert.That(
                _driver.PageSource,
                Does.Contain("Order status")
            );

            Assert.That(
                _driver.PageSource,
                Does.Contain("Customer")
            );

            Assert.That(
                _driver.PageSource,
                Does.Contain("Amount")
            );
        }

        [Test]
        public void PaymentTransactionsPage_CanOpenTransactionDetails()
        {
            OpenPaymentTransactions();

            var viewButton = _wait.Until(d =>
                d.FindElements(
                    By.CssSelector(
                        "a[aria-label^='View transaction for order']"
                    )
                ).FirstOrDefault()
            );

            Assert.That(viewButton, Is.Not.Null);

            viewButton!.Click();

            _wait.Until(d =>
                d.Url.Contains("/pharmacy/payment-transactions/")
            );

            Assert.That(
                _driver.PageSource,
                Does.Contain("Payment details")
            );

            Assert.That(
                _driver.PageSource,
                Does.Contain("Payment status")
            );

            Assert.That(
                _driver.PageSource,
                Does.Contain("Order status")
            );
        }

        [Test]
        public void PaymentTransactionsPage_CanOpenCompletedOrders()
        {
            OpenPaymentTransactions();

            var completedButton = _wait.Until(d =>
                d.FindElements(
                    By.XPath(
                        "//button[contains(.,'View completed orders')]"
                    )
                ).FirstOrDefault()
            );

            Assert.That(completedButton, Is.Not.Null);

            completedButton!.Click();

            _wait.Until(d =>
                d.FindElements(By.TagName("h1"))
                    .Any(element =>
                        element.Text.Contains("Completed orders"))
            );

            Assert.That(
                _driver.PageSource,
                Does.Contain("Completed orders")
            );

            Assert.That(
                _driver.PageSource,
                Does.Contain("Back to all transactions")
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