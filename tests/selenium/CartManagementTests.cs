using System;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.Frontend.Tests.Selenium
{
    /// <summary>
    /// GCN-30 end-to-end tests for the customer cart page.
    /// Requires: auth service (5133), pharmacy API (5134) and the Vite dev server (3000) running.
    /// </summary>
    [TestFixture]
    public class CartManagementTests
    {
        private IWebDriver _driver;
        private WebDriverWait _wait;
        private readonly string _baseUrl = "http://localhost:3000";
        private const string AuthApi = "http://localhost:5133/api";
        private const string PharmacyApi = "http://localhost:5134/api";

        private const string PatientEmail = "patient.catalogue.2026@example.com";
        private const string PatientPassword = "Patient@2026";
        private const string StaffEmail = "pharmacy.staff.2026@example.com";
        private const string StaffPassword = "Staff@2026";

        private static readonly By CartItems = By.CssSelector(".cart-item");
        private static readonly By CartTotal = By.CssSelector(".cart-total strong");
        private static readonly By EmptyMessage = By.CssSelector(".cart-empty");
        private static readonly By ErrorAlert = By.CssSelector(".management-alert.error");

        private HttpClient _patientHttp;
        private string _paracetamolName;   // price 150, stock 10
        private string _limitedName;       // price 300, stock 2
        private int _paracetamolId;
        private int _limitedId;

        [SetUp]
        public async Task Setup()
        {
            await SeedMedicinesAsync();
            _patientHttp = await LoginHttpAsync(PatientEmail, PatientPassword);
            await ClearCartAsync();
            await _patientHttp.PostAsJsonAsync($"{PharmacyApi}/cart/items", new { medicineId = _paracetamolId, quantity = 2 });
            await _patientHttp.PostAsJsonAsync($"{PharmacyApi}/cart/items", new { medicineId = _limitedId, quantity = 2 });

            var options = new ChromeOptions();
            options.AddArgument("--headless");
            options.AddArgument("--window-size=1400,900");
            _driver = new ChromeDriver(options);
            _wait = new WebDriverWait(_driver, TimeSpan.FromSeconds(15));
            _wait.IgnoreExceptionTypes(typeof(StaleElementReferenceException));
            LoginAsPatient();
            _driver.Navigate().GoToUrl($"{_baseUrl}/patient/cart");
            _wait.Until(d => d.FindElements(CartItems).Count == 2);
        }

        private static async Task<HttpClient> LoginHttpAsync(string email, string password)
        {
            var http = new HttpClient();
            var login = await http.PostAsJsonAsync($"{AuthApi}/auth/login", new { email, password });
            login.EnsureSuccessStatusCode();
            var token = (await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString();
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            return http;
        }

        // Two fresh non-prescription medicines per test: one with plenty of stock, one with only 2 units.
        private async Task SeedMedicinesAsync()
        {
            using var staff = await LoginHttpAsync(StaffEmail, StaffPassword);
            var category = await staff.PostAsJsonAsync($"{PharmacyApi}/staff/categories", new { name = $"Selenium-Cart-Cat-{Guid.NewGuid():N}".Substring(0, 28) });
            category.EnsureSuccessStatusCode();
            var categoryId = (await category.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

            _paracetamolName = $"Selenium-Cart-A-{Guid.NewGuid():N}".Substring(0, 26);
            _limitedName = $"Selenium-Cart-B-{Guid.NewGuid():N}".Substring(0, 26);
            _paracetamolId = await CreateStockedMedicineAsync(staff, categoryId, _paracetamolName, 150m, 10);
            _limitedId = await CreateStockedMedicineAsync(staff, categoryId, _limitedName, 300m, 2);
        }

        private static async Task<int> CreateStockedMedicineAsync(HttpClient staff, int categoryId, string name, decimal price, int stock)
        {
            var medicine = await staff.PostAsJsonAsync($"{PharmacyApi}/staff/medicines",
                new { name, description = "Seeded by the cart Selenium test", categoryId, price, prescriptionRequired = false });
            medicine.EnsureSuccessStatusCode();
            var id = (await medicine.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
            var batch = await staff.PostAsJsonAsync($"{PharmacyApi}/staff/inventory/batches", new
            {
                medicineId = id, batchNumber = $"SEL-{Guid.NewGuid():N}".Substring(0, 12), quantity = stock,
                purchasePrice = price / 2, sellingPrice = price, manufacturingDate = "2026-01-01", expiryDate = "2027-01-01"
            });
            batch.EnsureSuccessStatusCode();
            return id;
        }

        // The cart is per customer and persists between tests, so start each test from an empty cart.
        private async Task ClearCartAsync()
        {
            var cart = await _patientHttp.GetFromJsonAsync<JsonElement>($"{PharmacyApi}/cart");
            foreach (var group in new[] { "readyItems", "pendingItems", "attentionItems" })
            {
                foreach (var item in cart.GetProperty(group).EnumerateArray())
                {
                    await _patientHttp.DeleteAsync($"{PharmacyApi}/cart/items/{item.GetProperty("id").GetInt32()}");
                }
            }
        }

        private void LoginAsPatient()
        {
            _driver.Navigate().GoToUrl($"{_baseUrl}/login");
            _wait.Until(d => d.FindElement(By.Id("login-email"))).SendKeys(PatientEmail);
            _driver.FindElement(By.Id("login-password")).SendKeys(PatientPassword);
            _driver.FindElement(By.CssSelector("button[type='submit']")).Click();
            _wait.Until(d => d.Url.Contains("patient-dashboard"));
        }

        private IWebElement Row(string medicineName) =>
            _wait.Until(d => d.FindElements(By.XPath($"//article[contains(@class,'cart-item')][.//h3[normalize-space()='{medicineName}']]")).FirstOrDefault());

        private string Total() => _driver.FindElement(CartTotal).Text.Trim();

        // 1 — Scenario 1: all items, quantities and the total are displayed
        [Test]
        public void CartPage_ShowsItemsQuantitiesAndTotal()
        {
            var paracetamol = Row(_paracetamolName);
            var limited = Row(_limitedName);

            Assert.IsTrue(paracetamol.Text.Contains("Quantity: 2"), paracetamol.Text);
            Assert.IsTrue(paracetamol.Text.Contains("LKR 150.00 each"), paracetamol.Text);
            Assert.IsTrue(paracetamol.Text.Contains("LKR 300.00"), "Line total for 2 x 150 should be shown.");
            Assert.IsTrue(limited.Text.Contains("Quantity: 2") && limited.Text.Contains("LKR 600.00"), limited.Text);
            Assert.AreEqual("LKR 900.00", Total(), "Cart total = 300 + 600.");
        }

        // 2 — Scenario 2: increasing a quantity within stock updates the line and cart totals
        [Test]
        public void IncreaseQuantity_WithinStock_UpdatesTotals()
        {
            Row(_paracetamolName).FindElement(By.CssSelector($"button[aria-label='Increase {_paracetamolName}']")).Click();

            _wait.Until(d => Row(_paracetamolName).Text.Contains("Quantity: 3"));
            Assert.IsTrue(Row(_paracetamolName).Text.Contains("LKR 450.00"), "Line total should be 3 x 150.");
            _wait.Until(d => Total() == "LKR 1050.00");
            Assert.AreEqual("LKR 1050.00", Total(), "Cart total = 450 + 600.");
            Assert.IsEmpty(_driver.FindElements(ErrorAlert));
        }

        // 3 — Scenario 3: removing an item recalculates the total; removing the last shows the empty-cart message
        [Test]
        public void RemoveItems_RecalculatesTotal_ThenShowsEmptyCart()
        {
            Row(_limitedName).FindElement(By.CssSelector("button.cart-remove")).Click();

            _wait.Until(d => d.FindElements(CartItems).Count == 1);
            Assert.IsEmpty(_driver.FindElements(By.XPath($"//h3[normalize-space()='{_limitedName}']")), "Removed item should disappear.");
            _wait.Until(d => Total() == "LKR 300.00");

            Row(_paracetamolName).FindElement(By.CssSelector("button.cart-remove")).Click();

            var empty = _wait.Until(d => d.FindElement(EmptyMessage));
            Assert.AreEqual("Your cart is empty.", empty.Text.Trim());
            Assert.IsEmpty(_driver.FindElements(CartItems));
            Assert.IsEmpty(_driver.FindElements(CartTotal), "No cart total should be shown for an empty cart.");
        }

        // 4 — "Updated quantity exceeds available stock → error message and prevent the update"
        [Test]
        public void IncreaseQuantity_BeyondStock_ShowsErrorAndKeepsQuantity()
        {
            Row(_limitedName).FindElement(By.CssSelector($"button[aria-label='Increase {_limitedName}']")).Click();

            var error = _wait.Until(d => d.FindElement(ErrorAlert));
            Assert.IsTrue(error.Text.Contains("Quantity must be between 1 and 2"), $"Unexpected message: {error.Text}");
            Assert.IsTrue(Row(_limitedName).Text.Contains("Quantity: 2"), "Quantity must not change when the update is rejected.");
            Assert.AreEqual("LKR 900.00", Total(), "Cart total must be unchanged.");
        }

        [TearDown]
        public void Teardown()
        {
            _driver?.Quit();
            _driver?.Dispose();
            _patientHttp?.Dispose();
        }
    }
}
