using System;
using System.IO;
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
    /// GCN-29 end-to-end tests: add to cart, prescription requirement check, and prescription upload.
    /// Requires: auth service (5133), pharmacy API (5134) and the Vite dev server (3000) running.
    /// </summary>
    [TestFixture]
    public class PrescriptionUploadTests
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

        private static readonly By ActionButton = By.CssSelector("button.details-action");
        private static readonly By FileInput = By.Id("prescription-file");
        private static readonly By UploadButton = By.CssSelector(".prescription-upload-form button.primary-action");
        private static readonly By ErrorAlert = By.CssSelector(".management-alert.error");

        private int _rxMedicineId;
        private string _rxMedicineName;
        private int _plainMedicineId;
        private string _tempDir;

        [SetUp]
        public async Task Setup()
        {
            await SeedMedicinesAsync();
            _tempDir = Directory.CreateDirectory(Path.Combine(Path.GetTempPath(), "carenova-selenium", Guid.NewGuid().ToString("N"))).FullName;

            var options = new ChromeOptions();
            options.AddArgument("--headless");
            options.AddArgument("--window-size=1400,900");
            _driver = new ChromeDriver(options);
            _wait = new WebDriverWait(_driver, TimeSpan.FromSeconds(15));
            _wait.IgnoreExceptionTypes(typeof(StaleElementReferenceException));
            LoginAsPatient();
        }

        // Seeds one prescription-required and one ordinary medicine, both in stock, through the staff API.
        private async Task SeedMedicinesAsync()
        {
            using var http = new HttpClient();
            var login = await http.PostAsJsonAsync($"{AuthApi}/auth/login", new { email = StaffEmail, password = StaffPassword });
            login.EnsureSuccessStatusCode();
            var token = (await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString();
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

            var category = await http.PostAsJsonAsync($"{PharmacyApi}/staff/categories", new { name = $"Selenium-Rx-Cat-{Guid.NewGuid():N}".Substring(0, 26) });
            category.EnsureSuccessStatusCode();
            var categoryId = (await category.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

            _rxMedicineName = $"Selenium-Rx-{Guid.NewGuid():N}".Substring(0, 24);
            _rxMedicineId = await CreateStockedMedicineAsync(http, categoryId, _rxMedicineName, prescriptionRequired: true);
            _plainMedicineId = await CreateStockedMedicineAsync(http, categoryId, $"Selenium-Plain-{Guid.NewGuid():N}".Substring(0, 24), prescriptionRequired: false);
        }

        private static async Task<int> CreateStockedMedicineAsync(HttpClient http, int categoryId, string name, bool prescriptionRequired)
        {
            var medicine = await http.PostAsJsonAsync($"{PharmacyApi}/staff/medicines",
                new { name, description = "Seeded by the prescription Selenium test", categoryId, price = 150.0, prescriptionRequired });
            medicine.EnsureSuccessStatusCode();
            var id = (await medicine.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
            var batch = await http.PostAsJsonAsync($"{PharmacyApi}/staff/inventory/batches", new
            {
                medicineId = id, batchNumber = $"SEL-{Guid.NewGuid():N}".Substring(0, 12), quantity = 10,
                purchasePrice = 100, sellingPrice = 150, manufacturingDate = "2026-01-01", expiryDate = "2027-01-01"
            });
            batch.EnsureSuccessStatusCode();
            return id;
        }

        private void LoginAsPatient()
        {
            _driver.Navigate().GoToUrl($"{_baseUrl}/login");
            _wait.Until(d => d.FindElement(By.Id("login-email"))).SendKeys(PatientEmail);
            _driver.FindElement(By.Id("login-password")).SendKeys(PatientPassword);
            _driver.FindElement(By.CssSelector("button[type='submit']")).Click();
            _wait.Until(d => d.Url.Contains("patient-dashboard"));
        }

        private void OpenDetails(int medicineId)
        {
            _driver.Navigate().GoToUrl($"{_baseUrl}/patient/medicines/{medicineId}");
            _wait.Until(d => d.FindElements(By.CssSelector(".medicine-details-card h1")).Any());
        }

        // Opens the prescription medicine, selects quantity 2 and continues to the upload page.
        private void GoToUploadPageForRxMedicine()
        {
            OpenDetails(_rxMedicineId);
            _driver.FindElement(By.CssSelector("button[aria-label='Increase quantity']")).Click();
            _driver.FindElement(ActionButton).Click();
            _wait.Until(d => d.Url.Contains("/patient/prescriptions/upload"));
            _wait.Until(d => d.FindElements(FileInput).Any());
        }

        private string WriteTempFile(string name, string content)
        {
            var path = Path.Combine(_tempDir, name);
            File.WriteAllText(path, content);
            return path;
        }

        // 1 — Scenario 1: a non-prescription medicine is added without any prescription prompt
        [Test]
        public void AddNonPrescriptionMedicine_DoesNotAskForPrescription()
        {
            OpenDetails(_plainMedicineId);
            Assert.AreEqual("Add to Cart", _driver.FindElement(ActionButton).Text.Trim());

            _driver.FindElement(ActionButton).Click();

            Assert.IsFalse(_driver.Url.Contains("/prescriptions"), "Non-prescription medicine must not be routed to prescription upload.");
            Assert.IsEmpty(_driver.FindElements(FileInput), "No prescription file input should be shown.");
            var pending = (string)((IJavaScriptExecutor)_driver).ExecuteScript("return sessionStorage.getItem('carenova.pendingCartItem');");
            Assert.IsNotNull(pending, "The selected item should be recorded for the cart.");
            var item = JsonDocument.Parse(pending).RootElement;
            Assert.AreEqual(_plainMedicineId, item.GetProperty("medicineId").GetInt32());
            Assert.IsFalse(item.GetProperty("prescriptionRequired").GetBoolean());
        }

        // 2 — Scenario 3: prescription medicine without an uploaded file is blocked with a warning
        [Test]
        public void PrescriptionMedicine_WithoutUpload_IsBlockedWithWarning()
        {
            GoToUploadPageForRxMedicine();
            Assert.IsTrue(_driver.PageSource.Contains($"{_rxMedicineName} × 2"), "Upload page should show the selected medicine and quantity.");

            _driver.FindElement(UploadButton).Click();

            var warning = _wait.Until(d => d.FindElement(ErrorAlert));
            Assert.AreEqual("Choose a prescription file before uploading.", warning.Text.Trim());
            Assert.IsTrue(_driver.Url.Contains("/patient/prescriptions/upload"), "Customer must stay on the upload step.");
            Assert.IsFalse(_driver.PageSource.Contains("Prescription uploaded successfully"));
        }

        // 3 — unsupported file format → error message
        [Test]
        public void PrescriptionUpload_UnsupportedFormat_ShowsErrorMessage()
        {
            GoToUploadPageForRxMedicine();
            var badFile = WriteTempFile("prescription.txt", "not a prescription");

            _driver.FindElement(FileInput).SendKeys(badFile);

            var error = _wait.Until(d => d.FindElement(ErrorAlert));
            Assert.AreEqual("Choose a PDF, JPG, JPEG, or PNG file.", error.Text.Trim());
            _driver.FindElement(UploadButton).Click();
            Assert.IsFalse(_driver.PageSource.Contains("Prescription uploaded successfully"), "An unsupported file must never be uploaded.");
        }

        // 4 — Scenario 2: valid PDF is uploaded and stored with the medicine and quantity
        [Test]
        public void PrescriptionMedicine_WithValidUpload_IsStoredWithMedicineAndQuantity()
        {
            GoToUploadPageForRxMedicine();
            var pdf = WriteTempFile($"selenium-rx-{Guid.NewGuid():N}.pdf", "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF");

            _driver.FindElement(FileInput).SendKeys(pdf);
            _driver.FindElement(UploadButton).Click();

            var confirmation = _wait.Until(d => d.FindElement(By.CssSelector(".confirmation-card")));
            Assert.IsTrue(confirmation.Text.Contains("Prescription uploaded successfully"));
            Assert.IsTrue(confirmation.Text.Contains(Path.GetFileName(pdf)), "Confirmation should name the uploaded file.");
            Assert.IsTrue(confirmation.Text.Contains(_rxMedicineName), "Confirmation should name the medicine.");
            Assert.IsTrue(confirmation.Text.Contains("Pending verification"));
            Assert.IsNull(((IJavaScriptExecutor)_driver).ExecuteScript("return sessionStorage.getItem('carenova.pendingCartItem');"), "Pending selection should be cleared after upload.");

            _driver.Navigate().GoToUrl($"{_baseUrl}/patient/prescriptions");
            var row = _wait.Until(d => d.FindElements(By.CssSelector(".prescription-table-row")).FirstOrDefault(r => r.Text.Contains(Path.GetFileName(pdf))));
            Assert.IsNotNull(row, "Uploaded prescription should appear in My prescriptions.");
            Assert.IsTrue(row.Text.Contains(_rxMedicineName) && row.Text.Contains("2"), $"Row should show medicine and quantity 2. Row: {row.Text}");
        }

        [TearDown]
        public void Teardown()
        {
            _driver?.Quit();
            _driver?.Dispose();
            if (_tempDir is not null && Directory.Exists(_tempDir)) Directory.Delete(_tempDir, recursive: true);
        }
    }
}
