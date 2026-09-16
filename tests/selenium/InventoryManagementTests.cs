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
    /// GCN-28 end-to-end tests for the staff Inventory Management page.
    /// Requires: auth service (5133), pharmacy API (5134) and the Vite dev server (3000) running.
    /// </summary>
    [TestFixture]
    public class InventoryManagementTests
    {
        private IWebDriver _driver;
        private WebDriverWait _wait;
        private readonly string _baseUrl = "http://localhost:3000";
        private const string AuthApi = "http://localhost:5133/api";
        private const string PharmacyApi = "http://localhost:5134/api";

        // A Pharmacy Staff account that already exists in the auth database.
        private const string StaffEmail = "pharmacy.staff.2026@example.com";
        private const string StaffPassword = "Staff@2026";

        private string _medicineName;

        [SetUp]
        public async Task Setup()
        {
            // Each test gets a fresh medicine (created through the API) so stock totals start at zero.
            _medicineName = await CreateMedicineAsync();

            var options = new ChromeOptions();
            options.AddArgument("--headless");
            options.AddArgument("--window-size=1400,900");
            _driver = new ChromeDriver(options);
            _wait = new WebDriverWait(_driver, TimeSpan.FromSeconds(15));
            LoginAsStaff();
            _driver.Navigate().GoToUrl($"{_baseUrl}/pharmacy/inventory");
            _wait.Until(d => d.FindElements(By.CssSelector("select[name='medicineId'] option")).Count > 1);
        }

        private static async Task<string> CreateMedicineAsync()
        {
            using var http = new HttpClient();
            var login = await http.PostAsJsonAsync($"{AuthApi}/auth/login", new { email = StaffEmail, password = StaffPassword });
            login.EnsureSuccessStatusCode();
            var token = (await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString();
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

            var category = await http.PostAsJsonAsync($"{PharmacyApi}/staff/categories", new { name = $"Selenium-Inv-Cat-{Guid.NewGuid():N}" });
            category.EnsureSuccessStatusCode();
            var categoryId = (await category.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

            var medicineName = $"Selenium-Inv-{Guid.NewGuid():N}";
            var medicine = await http.PostAsJsonAsync($"{PharmacyApi}/staff/medicines",
                new { name = medicineName, description = "Created by Selenium inventory test", categoryId, price = 12.5, prescriptionRequired = false });
            medicine.EnsureSuccessStatusCode();
            return medicineName;
        }

        private void LoginAsStaff()
        {
            _driver.Navigate().GoToUrl($"{_baseUrl}/login");
            _wait.Until(d => d.FindElement(By.Id("login-email"))).SendKeys(StaffEmail);
            _driver.FindElement(By.Id("login-password")).SendKeys(StaffPassword);
            _driver.FindElement(By.CssSelector("button[type='submit']")).Click();
            _wait.Until(d => d.Url.Contains("pharmacy-dashboard"));
        }

        // React controlled inputs (dates especially) are set through the native value setter so onChange fires.
        private void SetValue(string name, string value)
        {
            var element = _driver.FindElement(By.Name(name));
            ((IJavaScriptExecutor)_driver).ExecuteScript(@"
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(arguments[0], arguments[1]);
                arguments[0].dispatchEvent(new Event('input', { bubbles: true }));", element, value);
        }

        // Centre the element first so a sticky header or an in-flight smooth scroll can't intercept the click.
        private void Click(IWebElement element)
        {
            ((IJavaScriptExecutor)_driver).ExecuteScript("arguments[0].scrollIntoView({ block: 'center' });", element);
            _wait.Until(_ => element.Displayed && element.Enabled);
            element.Click();
        }

        private void FillBatchForm(string quantity, string manufacturingDate = "2026-01-01", string expiryDate = "2027-01-01")
        {
            new SelectElement(_driver.FindElement(By.Name("medicineId"))).SelectByText(_medicineName);
            SetValue("batchNumber", $"SEL-{Guid.NewGuid():N}".Substring(0, 12));
            SetValue("quantity", quantity);
            SetValue("purchasePrice", "80");
            SetValue("sellingPrice", "100");
            SetValue("manufacturingDate", manufacturingDate);
            SetValue("expiryDate", expiryDate);
        }

        // One XPath lookup instead of reading .Text on every one of the hundreds of inventory rows.
        private By RowContaining(params string[] fragments) =>
            By.XPath("//div[contains(@class,'list-row')]" + string.Concat(fragments.Select(f => $"[contains(., '{f}')]")));

        private IWebElement WaitForRow(params string[] fragments) =>
            _wait.Until(d => d.FindElements(RowContaining(fragments)).FirstOrDefault());

        private void SaveBatchAndWaitForSuccess(string quantity)
        {
            FillBatchForm(quantity);
            Click(_driver.FindElement(By.CssSelector("button.primary-action")));
            _wait.Until(d => d.FindElement(By.CssSelector(".management-alert.success")));
        }

        // 1 — Scenario 1: stock update is reflected in the inventory list
        [Test]
        public void AddStockBatch_WithValidData_UpdatesQuantityAndAvailability()
        {
            SaveBatchAndWaitForSuccess("50");

            var row = WaitForRow(_medicineName, "50 units");
            Assert.IsNotNull(row, "Inventory row did not show the new quantity.");
            Assert.IsTrue(row.Text.Contains("Available"), $"Expected 'Available' but row text was: {row.Text}");
        }

        // 2 — expiry before manufacturing is rejected with a validation message
        [Test]
        public void AddStockBatch_WithExpiryBeforeManufacturing_ShowsValidationMessage()
        {
            FillBatchForm("20", manufacturingDate: "2027-06-01", expiryDate: "2026-06-01");
            Click(_driver.FindElement(By.CssSelector("button.primary-action")));

            var error = _wait.Until(d => d.FindElement(By.CssSelector(".management-alert.error")));
            Assert.IsTrue(error.Text.Contains("Expiry date cannot be before manufacturing date"), $"Unexpected message: {error.Text}");
        }

        // 3 — negative quantity is blocked by the form's own validation before it reaches the API
        [Test]
        public void AddStockBatch_WithNegativeQuantity_ShowsValidationMessage()
        {
            FillBatchForm("-5");
            Click(_driver.FindElement(By.CssSelector("button.primary-action")));

            var quantity = _driver.FindElement(By.Name("quantity"));
            var js = (IJavaScriptExecutor)_driver;
            var isValid = (bool)js.ExecuteScript("return arguments[0].checkValidity();", quantity);
            var validationMessage = (string)js.ExecuteScript("return arguments[0].validationMessage;", quantity);

            Assert.IsFalse(isValid, "A negative quantity should fail validation.");
            Assert.IsNotEmpty(validationMessage, "Browser should display a validation message for the quantity field.");
            Assert.IsEmpty(_driver.FindElements(By.CssSelector(".management-alert.success")), "Batch must not be saved.");
        }

        // 4 — Scenario 2: low stock medicine appears in the low-stock alert list
        [Test]
        public void LowStockFilter_ShowsMedicineBelowThreshold()
        {
            SaveBatchAndWaitForSuccess("3");

            Click(_driver.FindElement(By.Name("lowStockOnly")));

            var row = WaitForRow(_medicineName, "3 units");
            Assert.IsNotNull(row, "Low-stock medicine was not listed in the low-stock view.");
            Assert.IsTrue(row.Text.Contains("Low stock"), $"Expected 'Low stock' but row text was: {row.Text}");
        }

        // 5 — Scenario 3: editing the batch down to zero marks the medicine out of stock
        [Test]
        public void UpdateStockBatchToZero_MarksMedicineOutOfStock()
        {
            SaveBatchAndWaitForSuccess("5");

            Click(WaitForRow(_medicineName).FindElement(By.CssSelector("button"))); // View batches
            var batchesCard = _wait.Until(d => d.FindElement(By.CssSelector(".inventory-batches")));
            Click(batchesCard.FindElement(By.CssSelector(".list-row button"))); // Edit
            _wait.Until(d => d.FindElement(By.CssSelector("button.primary-action")).Text.Contains("Save changes"));

            SetValue("quantity", "0");
            Click(_driver.FindElement(By.CssSelector("button.primary-action")));
            _wait.Until(d => d.FindElements(By.CssSelector(".management-alert.success")).Any(a => a.Text.Contains("updated")));

            var row = WaitForRow(_medicineName, "0 units");
            Assert.IsNotNull(row, "Inventory row did not show zero units.");
            Assert.IsTrue(row.Text.Contains("Out of stock"), $"Expected 'Out of stock' but row text was: {row.Text}");
        }

        [TearDown]
        public void Teardown()
        {
            _driver?.Quit();
            _driver?.Dispose();
        }
    }
}
