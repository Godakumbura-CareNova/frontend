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
    /// GCN-25 end-to-end tests for the customer Medicine Catalogue page.
    /// Requires: auth service (5133), pharmacy API (5134) and the Vite dev server (3000) running.
    /// </summary>
    [TestFixture]
    public class MedicineCatalogueTests
    {
        private IWebDriver _driver;
        private WebDriverWait _wait;
        private readonly string _baseUrl = "http://localhost:3000";
        private const string AuthApi = "http://localhost:5133/api";
        private const string PharmacyApi = "http://localhost:5134/api";

        // Customer account used to browse the catalogue (already exists in the auth database).
        private const string PatientEmail = "patient.catalogue.2026@example.com";
        private const string PatientPassword = "Patient@2026";

        // Staff account used only to seed catalogue data through the API.
        private const string StaffEmail = "pharmacy.staff.2026@example.com";
        private const string StaffPassword = "Staff@2026";

        private static readonly By SearchBox = By.CssSelector("input[aria-label='Search medicines']");
        private static readonly By CategorySelect = By.CssSelector("select[aria-label='Category']");
        private static readonly By SearchButton = By.CssSelector(".catalogue-filters button.primary-action");
        private static readonly By Cards = By.CssSelector(".catalogue-card");

        private string _categoryName;
        private string _medicineName;
        private int _medicineId;

        [SetUp]
        public async Task Setup()
        {
            await SeedCatalogueDataAsync();

            var options = new ChromeOptions();
            options.AddArgument("--headless");
            options.AddArgument("--window-size=1400,900");
            _driver = new ChromeDriver(options);
            _wait = new WebDriverWait(_driver, TimeSpan.FromSeconds(15));
            _wait.IgnoreExceptionTypes(typeof(StaleElementReferenceException));
            LoginAsPatient();
            _driver.Navigate().GoToUrl($"{_baseUrl}/patient/medicines");
            _wait.Until(d => d.FindElements(Cards).Count > 0);
        }

        private static async Task<HttpClient> StaffClientAsync()
        {
            var http = new HttpClient();
            var login = await http.PostAsJsonAsync($"{AuthApi}/auth/login", new { email = StaffEmail, password = StaffPassword });
            login.EnsureSuccessStatusCode();
            var token = (await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString();
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            return http;
        }

        // Each test gets its own category with one in-stock medicine so searches and filters are unambiguous.
        private async Task SeedCatalogueDataAsync()
        {
            using var http = await StaffClientAsync();
            _categoryName = $"Selenium-Cat-{Guid.NewGuid():N}".Substring(0, 24);
            var category = await http.PostAsJsonAsync($"{PharmacyApi}/staff/categories", new { name = _categoryName });
            category.EnsureSuccessStatusCode();
            var categoryId = (await category.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

            _medicineName = $"Selenium-Med-{Guid.NewGuid():N}".Substring(0, 24);
            var medicine = await http.PostAsJsonAsync($"{PharmacyApi}/staff/medicines",
                new { name = _medicineName, description = "Seeded by the catalogue Selenium test", categoryId, price = 275.5, prescriptionRequired = false });
            medicine.EnsureSuccessStatusCode();
            _medicineId = (await medicine.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

            var batch = await http.PostAsJsonAsync($"{PharmacyApi}/staff/inventory/batches", new
            {
                medicineId = _medicineId, batchNumber = $"SEL-{Guid.NewGuid():N}".Substring(0, 12), quantity = 25,
                purchasePrice = 200, sellingPrice = 275.5, manufacturingDate = "2026-01-01", expiryDate = "2027-01-01"
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

        private void Search(string term)
        {
            var box = _driver.FindElement(SearchBox);
            box.Clear();
            box.SendKeys(term);
            _driver.FindElement(SearchButton).Click();
        }

        // One XPath lookup (instead of reading .Text of every card) so a React re-render mid-loop can't go stale.
        private IWebElement WaitForCard(string medicineName) =>
            _wait.Until(d => d.FindElements(By.XPath($"//article[contains(@class,'catalogue-card')][contains(., '{medicineName}')]")).FirstOrDefault());

        // 1 — catalogue lists medicines with name, category, price and stock status
        [Test]
        public void Catalogue_ListsMedicinesWithBasicDetails()
        {
            var cards = _driver.FindElements(Cards);

            Assert.That(cards.Count, Is.InRange(1, 12), "A catalogue page shows at most 12 medicines.");
            foreach (var card in cards)
            {
                Assert.IsNotEmpty(card.FindElement(By.CssSelector("h2")).Text, "Each card must show the medicine name.");
                Assert.IsNotEmpty(card.FindElement(By.CssSelector("span")).Text, "Each card must show the category.");
                StringAssert.StartsWith("LKR ", card.FindElement(By.CssSelector("strong")).Text, "Each card must show the price.");
                var status = card.FindElement(By.CssSelector(".stock-available, .stock-out")).Text;
                Assert.That(status, Is.EqualTo("Available").Or.EqualTo("Out of stock"), "Each card must show a stock status.");
            }
        }

        // 2 — Scenario 1: searching by name shows the matching medicine with its details
        [Test]
        public void Search_ByMedicineName_ShowsMatchingMedicine()
        {
            Search(_medicineName);

            var card = WaitForCard(_medicineName);
            Assert.IsNotNull(card, "The searched medicine did not appear.");
            Assert.IsTrue(card.Text.Contains(_categoryName), "Card should show the medicine's category.");
            Assert.IsTrue(card.Text.Contains("LKR 275.50"), $"Card should show the price. Card text: {card.Text}");
            Assert.IsTrue(card.Text.Contains("Available"), "Seeded medicine has stock and should be Available.");
            Assert.IsTrue(_driver.FindElements(Cards).All(c => c.Text.Contains(_medicineName)), "Only matching medicines should be listed.");
        }

        // 3 — Scenario 2: filtering by category shows only that category's medicines
        [Test]
        public void Filter_ByCategory_ShowsOnlyThatCategory()
        {
            _wait.Until(d => d.FindElements(By.CssSelector("select[aria-label='Category'] option")).Any(o => o.Text == _categoryName));
            new SelectElement(_driver.FindElement(CategorySelect)).SelectByText(_categoryName);
            _driver.FindElement(SearchButton).Click();

            var card = WaitForCard(_medicineName);
            Assert.IsNotNull(card, "Medicine from the selected category did not appear.");
            var cards = _driver.FindElements(Cards);
            Assert.That(cards.Count, Is.EqualTo(1), "Only the seeded medicine belongs to this new category.");
            Assert.IsTrue(cards.All(c => c.FindElement(By.CssSelector("span")).Text == _categoryName), "Every card must belong to the selected category.");
        }

        // 4 — Scenario 3: no matching results shows the "no results" message
        [Test]
        public void Search_WithNoMatches_ShowsNoResultsMessage()
        {
            Search($"no-such-medicine-{Guid.NewGuid():N}");

            var empty = _wait.Until(d => d.FindElement(By.CssSelector(".catalogue-empty")));
            Assert.IsTrue(empty.Text.Contains("No medicines match your search"), $"Unexpected message: {empty.Text}");
            Assert.IsEmpty(_driver.FindElements(Cards), "No medicine cards should be shown when nothing matches.");
        }

        // 6 — REQUIREMENT (user story: "Filter medicines by stock availability").
        //     The catalogue page must offer a stock-availability filter that hides out-of-stock medicines.
        //     EXPECTED TO FAIL on the current build: the page only has a search box and a category dropdown.
        [Test]
        public void Filter_ByStockAvailability_HidesOutOfStockMedicines()
        {
            var filters = _driver.FindElements(By.CssSelector(
                ".catalogue-filters select[aria-label*='vailab' i], .catalogue-filters input[type='checkbox'], .catalogue-filters select[name*='stock' i]"));

            Assert.IsNotEmpty(filters,
                "Stock-availability filter is not implemented: the catalogue filter bar has no availability control " +
                $"(controls present: {string.Join(", ", _driver.FindElements(By.CssSelector(".catalogue-filters > *")).Select(e => e.TagName + (e.GetAttribute("aria-label") is { Length: > 0 } l ? $"[{l}]" : "")))}).");

            var control = filters[0];
            if (control.TagName == "select") new SelectElement(control).SelectByIndex(1); else control.Click();
            _driver.FindElement(SearchButton).Click();
            _wait.Until(d => d.FindElements(Cards).Count > 0);

            Assert.IsEmpty(_driver.FindElements(By.CssSelector(".catalogue-card .stock-out")),
                "Out-of-stock medicines are still listed after applying the availability filter.");
        }

        // 5 — image loading. EXPECTED TO FAIL on the current build: the API stores image paths as
        //     "/uploads/medicines/<file>", so the catalogue renders <img src="/uploads/..."> which the
        //     browser resolves against the frontend (localhost:3000) instead of the API (localhost:5134).
        [Test]
        public async Task MedicineImage_IsDisplayedInCatalogue()
        {
            using (var http = await StaffClientAsync())
            {
                using var form = new MultipartFormDataContent();
                var png = new ByteArrayContent(OnePixelPng());
                png.Headers.ContentType = new MediaTypeHeaderValue("image/png");
                form.Add(png, "image", "selenium.png");
                var upload = await http.PostAsync($"{PharmacyApi}/staff/medicines/{_medicineId}/image", form);
                upload.EnsureSuccessStatusCode();
            }

            _driver.Navigate().Refresh();
            _wait.Until(d => d.FindElements(Cards).Count > 0);
            Search(_medicineName);
            var card = WaitForCard(_medicineName);
            var images = card.FindElements(By.CssSelector("img"));
            Assert.IsNotEmpty(images, "The medicine has an image path, so the card should render an <img>.");

            var img = images[0];
            _wait.Until(_ => (bool)((IJavaScriptExecutor)_driver).ExecuteScript("return arguments[0].complete;", img));
            var naturalWidth = Convert.ToInt64(((IJavaScriptExecutor)_driver).ExecuteScript("return arguments[0].naturalWidth;", img));
            var src = img.GetAttribute("src");

            Assert.That(naturalWidth, Is.GreaterThan(0),
                $"Image did not load in the browser. src resolved to '{src}' — it points at the frontend origin instead of the pharmacy API.");
        }

        // Smallest valid PNG (1x1 transparent pixel).
        private static byte[] OnePixelPng() => Convert.FromBase64String(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==");

        [TearDown]
        public void Teardown()
        {
            _driver?.Quit();
            _driver?.Dispose();
        }
    }
}
