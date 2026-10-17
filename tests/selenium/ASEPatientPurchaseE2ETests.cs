

using System;
using System.Linq;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.Frontend.Tests.Selenium
{
    [TestFixture]
    public class ASEPatientPurchaseE2ETests
    {
        private IWebDriver _driver = null!;
        private WebDriverWait _wait = null!;

        private readonly string _baseUrl =
            Environment.GetEnvironmentVariable("CARENOVA_FRONTEND_URL")
            ?? "http://localhost:3000";

        private const string MedicineName = "MigraKind";
        private const string ExpectedUnitPrice = "LKR 2000.00";
        private const string ExpectedLineTotal = "LKR 4000.00";

        [SetUp]
        public void Setup()
        {
            var options = new ChromeOptions();
            options.AddArgument("--window-size=1400,900");

            _driver = new ChromeDriver(options);
            _wait = new WebDriverWait(
                _driver,
                TimeSpan.FromSeconds(20)
            );

            _wait.IgnoreExceptionTypes(
                typeof(StaleElementReferenceException),
                typeof(NoSuchElementException)
            );
        }

        private void LoginAsPatient()
        {
            var email = Environment.GetEnvironmentVariable(
                "CARENOVA_TEST_PATIENT_EMAIL");

            var password = Environment.GetEnvironmentVariable(
                "CARENOVA_TEST_PATIENT_PASSWORD");

            Assert.That(
                email,
                Is.Not.Null.And.Not.Empty,
                "Set CARENOVA_TEST_PATIENT_EMAIL."
            );

            Assert.That(
                password,
                Is.Not.Null.And.Not.Empty,
                "Set CARENOVA_TEST_PATIENT_PASSWORD."
            );

            _driver.Navigate().GoToUrl($"{_baseUrl}/login");

            _wait.Until(d =>
                d.FindElement(By.Id("login-email"))
            ).SendKeys(email!);

            _driver.FindElement(
                By.Id("login-password")
            ).SendKeys(password!);

            _driver.FindElement(
                By.CssSelector("button[type='submit']")
            ).Click();

            try
            {
                _wait.Until(d =>
                    d.Url.Contains("patient-dashboard")
                );
            }
            catch (WebDriverTimeoutException)
            {
                TestContext.Progress.WriteLine(
                    "Login failed. Current URL: " + _driver.Url
                );

                TestContext.Progress.WriteLine(
                    "Page: " + _driver.FindElement(
                        By.TagName("body")
                    ).Text
                );

                throw;
            }
        }

        private IWebElement? FindMedicineInCart()
        {
            return _driver
                .FindElements(By.CssSelector(".cart-item"))
                .FirstOrDefault(item =>
                    item.Text.Contains(
                        MedicineName,
                        StringComparison.OrdinalIgnoreCase
                    )
                );
        }

        private void RemoveMedicineFromCart()
        {
            _driver.Navigate().GoToUrl($"{_baseUrl}/patient/cart");

            _wait.Until(d =>
                d.FindElements(
                    By.CssSelector(
                        ".cart-item, .cart-empty, .management-alert.error"
                    )
                ).Count > 0
            );

            var error = _driver.FindElements(
                By.CssSelector(".management-alert.error")
            ).FirstOrDefault();

            Assert.That(
                error,
                Is.Null,
                "The cart could not be loaded."
            );

            for (int attempt = 0; attempt < 10; attempt++)
            {
                var item = FindMedicineInCart();

                if (item == null)
                    return;

                item.FindElement(
                    By.CssSelector("button.cart-remove")
                ).Click();

                _wait.Until(d =>
                    FindMedicineInCart() == null
                );
            }

            Assert.Fail(
                "Could not clear MigraKind from the cart."
            );
        }

        [Test]
        public void E2E01_PatientCanLogin()
        {
            LoginAsPatient();

            Assert.That(
                _driver.Url,
                Does.Contain("patient-dashboard")
            );

            TestContext.Progress.WriteLine(
                "E2E01 PASSED: Patient logged in successfully."
            );
        }

        [Test]
        public void E2E02_PatientCanAddMedicineToCart()
        {
            LoginAsPatient();
            RemoveMedicineFromCart();

            try
            {
                _driver.Navigate().GoToUrl(
                    $"{_baseUrl}/patient/medicines"
                );

                var search = _wait.Until(d =>
                    d.FindElement(
                        By.CssSelector(
                            "input[aria-label='Search medicines']"
                        )
                    )
                );

                search.Clear();
                search.SendKeys(MedicineName);

                var medicineCard = _wait.Until(d =>
                    d.FindElements(
                        By.CssSelector(".catalogue-card")
                    ).FirstOrDefault(card =>
                        card.Text.Contains(
                            MedicineName,
                            StringComparison.OrdinalIgnoreCase
                        )
                    )
                );

                Assert.That(
                    medicineCard,
                    Is.Not.Null,
                    "MigraKind was not found in the catalogue."
                );

                medicineCard!.FindElement(
                    By.CssSelector(
                        "button.catalogue-details-action"
                    )
                ).Click();

                _wait.Until(d =>
                    d.Url.Contains("/patient/medicines/")
                );

                var quantity = _wait.Until(d =>
                    d.FindElement(
                        By.CssSelector(
                            "input[aria-label='Quantity']"
                        )
                    )
                );

                quantity.Clear();
                quantity.SendKeys("2");

                Assert.That(
                    quantity.GetAttribute("value"),
                    Is.EqualTo("2")
                );

                _wait.Until(d =>
                {
                    var button = d.FindElement(
                        By.CssSelector(
                            ".details-add-to-cart"
                        )
                    );

                    return button.Enabled ? button : null;
                }).Click();

                _wait.Until(d =>
                    d.FindElements(
                        By.CssSelector(
                            ".management-alert.success"
                        )
                    ).Any(alert =>
                        alert.Text.Contains(
                            "Added to your cart"
                        )
                    )
                );

                _driver.Navigate().GoToUrl(
                    $"{_baseUrl}/patient/cart"
                );

                var cartItem = _wait.Until(d =>
                    FindMedicineInCart()
                );

                Assert.That(
                    cartItem,
                    Is.Not.Null,
                    "MigraKind was not found in the cart."
                );

                Assert.Multiple(() =>
                {
                    Assert.That(
                        cartItem!.Text,
                        Does.Contain(MedicineName)
                    );

                    Assert.That(
                        cartItem.Text,
                        Does.Contain("Quantity: 2")
                    );

                    Assert.That(
                        cartItem.Text,
                        Does.Contain(ExpectedUnitPrice)
                    );

                    Assert.That(
                        cartItem.Text,
                        Does.Contain(ExpectedLineTotal)
                    );
                });

                TestContext.Progress.WriteLine(
                    "E2E02 PASSED: MigraKind added with quantity 2 and correct line total."
                );
            }
            finally
            {
                try
                {
                    RemoveMedicineFromCart();
                }
                catch (Exception ex)
                {
                    TestContext.Progress.WriteLine(
                        "Cart cleanup failed: " + ex.Message
                    );
                }
            }
        }

        [Test]
        public void E2E03_PatientCannotAddInvalidQuantity()
        {
            LoginAsPatient();

            _driver.Navigate().GoToUrl(
                $"{_baseUrl}/patient/medicines"
            );

            var search = _wait.Until(d =>
                d.FindElement(
                    By.CssSelector(
                        "input[aria-label='Search medicines']"
                    )
                )
            );

            search.Clear();
            search.SendKeys(MedicineName);

            var medicineCard = _wait.Until(d =>
                d.FindElements(
                    By.CssSelector(".catalogue-card")
                ).FirstOrDefault(card =>
                    card.Text.Contains(
                        MedicineName,
                        StringComparison.OrdinalIgnoreCase
                    )
                )
            );

            Assert.That(
                medicineCard,
                Is.Not.Null,
                "MigraKind was not found in the catalogue."
            );

            medicineCard!.FindElement(
                By.CssSelector(
                    "button.catalogue-details-action"
                )
            ).Click();

            var quantity = _wait.Until(d =>
                d.FindElement(
                    By.CssSelector(
                        "input[aria-label='Quantity']"
                    )
                )
            );

            quantity.Clear();
            quantity.SendKeys("0");
            quantity.SendKeys(Keys.Tab);

            var error = _wait.Until(d =>
                d.FindElements(
                    By.Id("quantity-error")
                ).FirstOrDefault(e => e.Displayed)
            );

            Assert.That(
                error,
                Is.Not.Null,
                "Validation error should appear for quantity 0."
            );

            var addButton = _driver.FindElement(
                By.CssSelector(
                    ".details-add-to-cart"
                )
            );

            Assert.That(
                addButton.Enabled,
                Is.False,
                "Add to Cart must be disabled for invalid quantity."
            );

            TestContext.Progress.WriteLine(
                "E2E03 PASSED: Invalid quantity rejected successfully."
            );
        }

        [TearDown]
        public void TearDown()
        {
            _driver?.Quit();
            _driver?.Dispose();
        }
    }
}
