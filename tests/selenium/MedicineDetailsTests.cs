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
    /// GCN-26 end-to-end tests for the customer Medicine Details page and quantity selector.
    /// Requires: auth service (5133), pharmacy API (5134) and the Vite dev server (3000) running.
    /// </summary>
    [TestFixture]
    public class MedicineDetailsTests
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

        private const int SeededStock = 3;
        private const decimal SeededPrice = 275.50m;

        private static readonly By Increase = By.CssSelector("button[aria-label='Increase quantity']");
        private static readonly By Decrease = By.CssSelector("button[aria-label='Decrease quantity']");
        private static readonly By QuantityValue = By.CssSelector(".quantity-control strong");
        private static readonly By ActionButton = By.CssSelector("button.details-action");

        private string _categoryName;
        private string _medicineName;
        private int _medicineId;

        [SetUp]
        public async Task Setup()
        {
            await SeedMedicineAsync();

            var options = new ChromeOptions();
            options.AddArgument("--headless");
            options.AddArgument("--window-size=1400,900");
            _driver = new ChromeDriver(options);
            _wait = new WebDriverWait(_driver, TimeSpan.FromSeconds(15));
            _wait.IgnoreExceptionTypes(typeof(StaleElementReferenceException));
            LoginAsPatient();
            _driver.Navigate().GoToUrl($"{_baseUrl}/patient/medicines/{_medicineId}");
            _wait.Until(d => d.FindElements(By.CssSelector(".medicine-details-card h1")).Any());
        }

        // Seeds a fresh in-stock medicine (3 units) through the staff API so every test starts from a known state.
        private async Task SeedMedicineAsync()
        {
            using var http = new HttpClient();
            var login = await http.PostAsJsonAsync($"{AuthApi}/auth/login", new { email = StaffEmail, password = StaffPassword });
            login.EnsureSuccessStatusCode();
            var token = (await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString();
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

            _categoryName = $"Selenium-Det-Cat-{Guid.NewGuid():N}".Substring(0, 26);
            var category = await http.PostAsJsonAsync($"{PharmacyApi}/staff/categories", new { name = _categoryName });
            category.EnsureSuccessStatusCode();
            var categoryId = (await category.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

            _medicineName = $"Selenium-Det-{Guid.NewGuid():N}".Substring(0, 24);
            var medicine = await http.PostAsJsonAsync($"{PharmacyApi}/staff/medicines",
                new { name = _medicineName, description = "Seeded by the details Selenium test", categoryId, price = SeededPrice, prescriptionRequired = false });
            medicine.EnsureSuccessStatusCode();
            _medicineId = (await medicine.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

            var batch = await http.PostAsJsonAsync($"{PharmacyApi}/staff/inventory/batches", new
            {
                medicineId = _medicineId, batchNumber = $"SEL-{Guid.NewGuid():N}".Substring(0, 12), quantity = SeededStock,
                purchasePrice = 200, sellingPrice = SeededPrice, manufacturingDate = "2026-01-01", expiryDate = "2027-01-01"
            });
            batch.EnsureSuccessStatusCode();
        }

        private void LoginAsPatient()
        {
            _driver.Navigate().GoToUrl($"{_baseUrl}/login");
            _wait.Until(d => d.FindElement(By.Id("login-email"))).SendKeys(PatientEmail);
            _driver.FindElement(By.Id("login-password")).SendKeys(PatientPassword);
            _driver.FindElement(By.CssSelector("button[type='submit']")).Click();
            _wait.Until(d => d.Url.Contains("patient-dashboard"));
        }

        private int Quantity() => int.Parse(_driver.FindElement(QuantityValue).Text.Trim());

        private void ClickTimes(By locator, int times)
        {
            for (var i = 0; i < times; i++) _driver.FindElement(locator).Click();
        }

        // 1 — detail view shows name, description, category, price, available stock and prescription status
        [Test]
        public void DetailsPage_ShowsMedicineInformation()
        {
            var card = _driver.FindElement(By.CssSelector(".medicine-details-card"));

            Assert.AreEqual(_medicineName, card.FindElement(By.CssSelector("h1")).Text);
            Assert.AreEqual("Seeded by the details Selenium test", card.FindElement(By.CssSelector(".medicine-description")).Text);
            Assert.AreEqual(_categoryName, card.FindElement(By.CssSelector(".category-badge")).Text);
            Assert.AreEqual("LKR 275.50", card.FindElement(By.CssSelector(".medicine-meta strong")).Text);
            Assert.AreEqual($"{SeededStock} units available", card.FindElement(By.CssSelector(".stock-badge")).Text);
            Assert.AreEqual("No prescription required", card.FindElement(By.CssSelector(".prescription-badge")).Text);
            Assert.AreEqual(1, Quantity(), "Quantity selector should start at 1.");
        }

        // 2 — Scenario 1: a valid quantity is accepted for adding to cart
        [Test]
        public void SelectValidQuantity_IsAcceptedForCart()
        {
            ClickTimes(Increase, 1);
            Assert.AreEqual(2, Quantity());
            Assert.AreEqual("Total: LKR 551.00", _driver.FindElement(By.CssSelector(".total-box strong")).Text);

            _driver.FindElement(ActionButton).Click();

            var pending = (string)((IJavaScriptExecutor)_driver).ExecuteScript("return sessionStorage.getItem('carenova.pendingCartItem');");
            Assert.IsNotNull(pending, "Add to Cart should record the selected item for the cart.");
            var item = JsonDocument.Parse(pending).RootElement;
            Assert.AreEqual(_medicineId, item.GetProperty("medicineId").GetInt32());
            Assert.AreEqual(2, item.GetProperty("quantity").GetInt32());
        }

        // 3 — Scenario 2: quantity greater than stock is rejected AND an error message is displayed.
        //     EXPECTED TO FAIL on the current build: the quantity is capped correctly, but no message is shown.
        [Test]
        public void SelectQuantityAboveStock_IsRejectedWithErrorMessage()
        {
            ClickTimes(Increase, SeededStock + 2);

            Assert.AreEqual(SeededStock, Quantity(), "Quantity must never exceed the available stock.");

            var messages = _driver.FindElements(By.CssSelector(".management-alert.error, .quantity-error, [role='alert']"))
                .Select(e => e.Text).Where(t => !string.IsNullOrWhiteSpace(t)).ToList();
            Assert.IsNotEmpty(messages,
                $"Scenario 2 not met: quantity was capped at {SeededStock} but no error message was displayed when the customer tried to exceed the available stock.");
        }

        // 4 — Scenario 3: zero / negative / non-numeric quantity shows a validation message.
        //     EXPECTED TO FAIL on the current build: there is no quantity input field (only +/− buttons).
        [Test]
        public void EnterInvalidQuantity_ShowsValidationMessage()
        {
            var inputs = _driver.FindElements(By.CssSelector(".quantity-control input, .quantity-section input, input[name='quantity'], input[aria-label*='uantity']"));
            Assert.IsNotEmpty(inputs,
                "Scenario 3 not met: the details page has no quantity input field, so a customer cannot enter zero, negative or non-numeric values and no validation message can be shown.");

            var input = inputs[0];
            foreach (var value in new[] { "0", "-1", "abc" })
            {
                input.Clear();
                input.SendKeys(value);
                _driver.FindElement(ActionButton).Click();
                var validation = _wait.Until(d => d.FindElements(By.CssSelector(".management-alert.error, .quantity-error, [role='alert']")).FirstOrDefault(e => e.Displayed));
                Assert.IsNotNull(validation, $"No validation message shown for quantity '{value}'.");
            }
        }

        [TearDown]
        public void Teardown()
        {
            _driver?.Quit();
            _driver?.Dispose();
        }
    }
}
