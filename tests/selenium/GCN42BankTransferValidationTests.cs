using System;
using System.Linq;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.Frontend.Tests.Selenium
{
    [TestFixture]
    public class GCN42BankTransferValidationTests
    {
        private IWebDriver _driver = null!;
        private WebDriverWait _wait = null!;

        private const string BaseUrl = "http://localhost:3000";

        [SetUp]
        public void Setup()
        {
            var options = new ChromeOptions();

            // Headed mode so the browser is visible.
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

        private void OpenBankTransferValidation()
        {
            LoginAsStaff();

            _driver.Navigate().GoToUrl(
                $"{BaseUrl}/pharmacy/payments"
            );

            _wait.Until(d =>
                d.FindElements(By.TagName("h1"))
                    .Any(element =>
                        element.Text.Contains(
                            "Bank transfer verification"
                        ))
            );
        }

        [Test]
        public void ValidationPage_ShowsStatusGroups()
        {
            OpenBankTransferValidation();

            Assert.That(
                _driver.PageSource,
                Does.Contain("Bank transfer verification")
            );

            Assert.That(
                _driver.PageSource,
                Does.Contain("Pending")
            );

            Assert.That(
                _driver.PageSource,
                Does.Contain("Approved")
            );

            Assert.That(
                _driver.PageSource,
                Does.Contain("Rejected")
            );
        }

        [Test]
        public void ValidationPage_ShowsTransactionQueueOrEmptyState()
        {
            OpenBankTransferValidation();

            _wait.Until(d =>
                d.PageSource.Contains("Review transaction") ||
                d.PageSource.Contains("All caught up") ||
                d.PageSource.Contains("Nothing to show")
            );

            Assert.That(
                _driver.PageSource.Contains("Review transaction") ||
                _driver.PageSource.Contains("All caught up") ||
                _driver.PageSource.Contains("Nothing to show"),
                Is.True
            );
        }

        [Test]
        public void ValidationPage_CanOpenReceiptReview()
        {
            OpenBankTransferValidation();

            var allTab = _wait.Until(d =>
                d.FindElements(
                    By.XPath("//button[@role='tab' and contains(.,'All')]")
                ).FirstOrDefault()
            );

            allTab!.Click();

            var reviewButton = _wait.Until(d =>
                d.FindElements(
                    By.CssSelector(
                        "button[aria-label^='Review order']"
                    )
                ).FirstOrDefault()
            );

            Assert.That(reviewButton, Is.Not.Null);

            reviewButton!.Click();

            _wait.Until(d =>
                d.FindElements(
                    By.CssSelector(
                        "article[role='dialog']"
                    )
                ).Any()
            );

            Assert.That(
                _driver.PageSource,
                Does.Contain("Uploaded receipt")
            );

            Assert.That(
                _driver.PageSource,
                Does.Contain("Payment information")
            );
        }

        [Test]
        public void PendingReceipt_ShowsApproveAndRejectActions()
        {
            OpenBankTransferValidation();

            var pendingTab = _wait.Until(d =>
                d.FindElements(
                    By.XPath(
                        "//button[@role='tab' and contains(.,'Pending')]"
                    )
                ).FirstOrDefault()
            );

            pendingTab!.Click();

            var pendingReceipt = _wait.Until(d =>
                d.FindElements(
                    By.CssSelector(
                        "button[aria-label^='Review order']"
                    )
                ).FirstOrDefault()
            );

            if (pendingReceipt is null)
            {
                Assert.Ignore(
                    "No pending bank-transfer receipt is available for the action test."
                );
            }

            pendingReceipt.Click();

            _wait.Until(d =>
                d.FindElements(
                    By.CssSelector(
                        "article[role='dialog']"
                    )
                ).Any()
            );

            Assert.That(
                _driver.PageSource,
                Does.Contain("Approve transaction")
            );

            Assert.That(
                _driver.PageSource,
                Does.Contain("Reject transaction")
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