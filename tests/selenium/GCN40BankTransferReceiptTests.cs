using System;
using System.IO;
using System.Linq;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.Frontend.Tests.Selenium
{
    /// <summary>
    /// GCN-40 UI tests for bank-transfer receipt upload.
    ///
    /// Requires:
    /// - User Auth: http://localhost:5133
    /// - Pharmacy: http://localhost:5134
    /// - Doctor Payment: http://localhost:5135
    /// - Frontend: http://localhost:3000
    ///
    /// Environment variables:
    /// - GCN40_ORDER_ID
    /// - CARENOVA_PATIENT_EMAIL
    /// - CARENOVA_PATIENT_PASSWORD
    /// </summary>
    [TestFixture]
    public class GCN40BankTransferReceiptTests
    {
        private IWebDriver _driver = null!;
        private WebDriverWait _wait = null!;
        private string _tempDir = null!;

        private const string BaseUrl = "http://localhost:3000";

        [SetUp]
        public void Setup()
        {
            _tempDir = Directory.CreateDirectory(
                Path.Combine(
                    Path.GetTempPath(),
                    "carenova-gcn40-selenium",
                    Guid.NewGuid().ToString("N")
                )
            ).FullName;

            var options = new ChromeOptions();
            options.AddArgument("--headless");
            options.AddArgument("--window-size=1400,900");

            _driver = new ChromeDriver(options);
            _wait = new WebDriverWait(
                _driver,
                TimeSpan.FromSeconds(15)
            );
        }

        private string WriteTempFile(
            string name,
            int sizeBytes = 100
        )
        {
            var path = Path.Combine(_tempDir, name);

            File.WriteAllBytes(
                path,
                new byte[sizeBytes]
            );

            return path;
        }

        private void OpenReceiptPage()
        {
            var orderId =
                Environment.GetEnvironmentVariable("GCN40_ORDER_ID");

            if (string.IsNullOrWhiteSpace(orderId))
            {
                Assert.Ignore(
                    "Set GCN40_ORDER_ID to an unused Bank Transfer order ID."
                );
            }

            var email =
                Environment.GetEnvironmentVariable(
                    "CARENOVA_PATIENT_EMAIL"
                );

            var password =
                Environment.GetEnvironmentVariable(
                    "CARENOVA_PATIENT_PASSWORD"
                );

            if (string.IsNullOrWhiteSpace(email) ||
                string.IsNullOrWhiteSpace(password))
            {
                Assert.Ignore(
                    "Set CARENOVA_PATIENT_EMAIL and CARENOVA_PATIENT_PASSWORD."
                );
            }

            // Login
            _driver.Navigate().GoToUrl(
                $"{BaseUrl}/login"
            );

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
                d.Url.Contains("patient-dashboard")
            );

            // Open medicine-order payment page
            _driver.Navigate().GoToUrl(
                $"{BaseUrl}/patient/orders/{orderId}/payment"
            );

            // Bank transfer should already be selected for
            // the GCN-40 QA order. Continue to payment.
            var continueButton = _wait.Until(d =>
                d.FindElements(
                    By.XPath(
                        "//button[contains(.,'Continue to payment')]"
                    )
                ).FirstOrDefault()
            );

            continueButton!.Click();

            // The application opens a confirmation modal.
            var confirmButton = _wait.Until(d =>
                d.FindElements(
                    By.XPath(
                        "//button[contains(.,'Confirm bank transfer')]"
                    )
                ).FirstOrDefault()
            );

            confirmButton!.Click();

            // Wait until the receipt uploader is actually rendered.
            _wait.Until(d =>
                d.FindElements(
                    By.CssSelector(
                        "input[aria-label='Payment receipt']"
                    )
                ).Any()
            );
        }

        [Test]
        public void ReceiptUploadPage_ShowsSupportedFormatsAndPendingMessage()
        {
            OpenReceiptPage();

            Assert.That(
                _driver.PageSource,
                Does.Contain("Upload your payment receipt")
            );

            Assert.That(
                _driver.PageSource,
                Does.Contain("JPG, JPEG or PNG, up to 5 MB")
            );

            Assert.That(
                _driver.PageSource,
                Does.Contain(
                    "Your order stays Pending until the pharmacy verifies the receipt."
                )
            );
        }

        [Test]
        public void UploadWithoutFile_ShowsValidationMessage()
        {
            OpenReceiptPage();

            _driver.FindElement(
                By.XPath(
                    "//button[contains(.,'Upload receipt')]"
                )
            ).Click();

            var alert = _wait.Until(d =>
                d.FindElement(
                    By.CssSelector("[role='alert']")
                )
            );

            Assert.That(
                alert.Text,
                Does.Contain(
                    "Select a receipt to upload."
                )
            );
        }

        [Test]
        public void UnsupportedFile_ShowsFormatValidationMessage()
        {
            OpenReceiptPage();

            var badFile =
                WriteTempFile("receipt.txt");

            _driver.FindElement(
                By.CssSelector(
                    "input[aria-label='Payment receipt']"
                )
            ).SendKeys(badFile);

            var alert = _wait.Until(d =>
                d.FindElement(
                    By.CssSelector("[role='alert']")
                )
            );

            Assert.That(
                alert.Text,
                Does.Contain(
                    "Unsupported file format. Only JPG, JPEG and PNG files are allowed."
                )
            );
        }

        [Test]
        public void OversizedReceipt_ShowsFiveMbValidationMessage()
        {
            OpenReceiptPage();

            var largeFile = WriteTempFile(
                "large-receipt.png",
                5 * 1024 * 1024 + 1
            );

            _driver.FindElement(
                By.CssSelector(
                    "input[aria-label='Payment receipt']"
                )
            ).SendKeys(largeFile);

            var alert = _wait.Until(d =>
                d.FindElement(
                    By.CssSelector("[role='alert']")
                )
            );

            Assert.That(
                alert.Text,
                Does.Contain(
                    "The receipt is larger than 5 MB. Please upload a file of 5 MB or less."
                )
            );
        }

        [TearDown]
        public void Teardown()
        {
            _driver?.Quit();
            _driver?.Dispose();

            if (!string.IsNullOrWhiteSpace(_tempDir) &&
                Directory.Exists(_tempDir))
            {
                Directory.Delete(
                    _tempDir,
                    recursive: true
                );
            }
        }
    }
}