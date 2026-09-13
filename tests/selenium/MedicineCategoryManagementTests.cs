using System;
using System.Linq;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.Frontend.Tests.Selenium
{
    [TestFixture]
    public class MedicineCategoryManagementTests
    {
        private IWebDriver _driver;
        private WebDriverWait _wait;
        private readonly string _baseUrl = "http://localhost:3000";

        // A Pharmacy Staff account that already exists in the auth database.
        private const string StaffEmail = "pharmacystaff.selenium@carenova.org";
        private const string StaffPassword = "SeleniumTest@123";

        [SetUp]
        public void Setup()
        {
            var options = new ChromeOptions();
            options.AddArgument("--headless");
            options.AddArgument("--window-size=1400,900");
            _driver = new ChromeDriver(options);
            _wait = new WebDriverWait(_driver, TimeSpan.FromSeconds(10));
            LoginAsStaff();
        }

        private void LoginAsStaff()
        {
            _driver.Navigate().GoToUrl($"{_baseUrl}/login");
            _wait.Until(d => d.FindElement(By.Id("login-email"))).SendKeys(StaffEmail);
            _driver.FindElement(By.Id("login-password")).SendKeys(StaffPassword);
            _driver.FindElement(By.CssSelector("button[type='submit']")).Click();
            _wait.Until(d => d.Url.Contains("pharmacy-dashboard"));
        }

        private string CreateCategory()
        {
            var categoryName = $"Selenium-Category-{Guid.NewGuid():N}";
            _driver.Navigate().GoToUrl($"{_baseUrl}/pharmacy/categories");
            var nameInput = _wait.Until(d => d.FindElement(By.CssSelector(".management-card input")));
            nameInput.SendKeys(categoryName);
            _driver.FindElement(By.CssSelector("button.primary-action")).Click();
            _wait.Until(d => d.FindElement(By.CssSelector(".management-alert.success")));
            return categoryName;
        }

        [Test]
        public void AddCategory_WithDuplicateName_ShowsWarning()
        {
            var categoryName = CreateCategory();

            _driver.Navigate().Refresh();
            var input = _wait.Until(d => d.FindElement(By.CssSelector(".management-card input")));
            input.SendKeys(categoryName);
            _driver.FindElement(By.CssSelector("button.primary-action")).Click();

            var errorMessage = _wait.Until(d => d.FindElement(By.CssSelector(".management-alert.error")));
            Assert.IsTrue(errorMessage.Text.Contains("already exists"));
        }

        [Test]
        public void AddMedicine_WithValidData_AppearsInList()
        {
            var categoryName = CreateCategory();
            var medicineName = $"Selenium-Med-{Guid.NewGuid():N}";
            _driver.Navigate().GoToUrl($"{_baseUrl}/pharmacy/medicines");

            _wait.Until(d => d.FindElement(By.Name("name"))).SendKeys(medicineName);
            _driver.FindElement(By.Name("description")).SendKeys("Added by Selenium test");
            new SelectElement(_driver.FindElement(By.Name("categoryId"))).SelectByText(categoryName);
            _driver.FindElement(By.Name("price")).SendKeys("19.99");
            _driver.FindElement(By.CssSelector("button.primary-action")).Click();

            _wait.Until(d => d.FindElement(By.CssSelector(".management-alert.success")));
            Assert.IsTrue(_driver.PageSource.Contains(medicineName));
        }

        [Test]
        public void AddMedicine_WithDuplicateNameInSameCategory_ShowsWarning()
        {
            var categoryName = CreateCategory();
            var medicineName = $"Selenium-Dup-{Guid.NewGuid():N}";
            _driver.Navigate().GoToUrl($"{_baseUrl}/pharmacy/medicines");

            _wait.Until(d => d.FindElement(By.Name("name"))).SendKeys(medicineName);
            _driver.FindElement(By.Name("description")).SendKeys("First one");
            new SelectElement(_driver.FindElement(By.Name("categoryId"))).SelectByText(categoryName);
            _driver.FindElement(By.Name("price")).SendKeys("10.00");
            _driver.FindElement(By.CssSelector("button.primary-action")).Click();
            _wait.Until(d => d.FindElement(By.CssSelector(".management-alert.success")));
            _driver.Navigate().Refresh();

            _wait.Until(d => d.FindElement(By.Name("name"))).SendKeys(medicineName);
            _driver.FindElement(By.Name("description")).SendKeys("Second one, same name");
            new SelectElement(_driver.FindElement(By.Name("categoryId"))).SelectByText(categoryName);
            _driver.FindElement(By.Name("price")).SendKeys("12.00");
            _driver.FindElement(By.CssSelector("button.primary-action")).Click();

            var errorMessage = _wait.Until(d => d.FindElement(By.CssSelector(".management-alert.error")));
            Assert.IsTrue(errorMessage.Text.Contains("already exists"));
        }

        [Test]
        public void DeactivateMedicine_MarksItAsDeactivated()
        {
            var categoryName = CreateCategory();
            var medicineName = $"Selenium-Deactivate-{Guid.NewGuid():N}";
            _driver.Navigate().GoToUrl($"{_baseUrl}/pharmacy/medicines");
            _wait.Until(d => d.FindElement(By.Name("name"))).SendKeys(medicineName);
            _driver.FindElement(By.Name("description")).SendKeys("Will be deactivated");
            new SelectElement(_driver.FindElement(By.Name("categoryId"))).SelectByText(categoryName);
            _driver.FindElement(By.Name("price")).SendKeys("5.00");
            _driver.FindElement(By.CssSelector("button.primary-action")).Click();
            _wait.Until(d => d.FindElement(By.CssSelector(".management-alert.success")));
            _driver.Navigate().Refresh();

            var row = _wait.Until(d => d.FindElements(By.CssSelector(".medicine-row")).FirstOrDefault(r => r.Text.Contains(medicineName)));
            row.FindElement(By.CssSelector("button.danger-link")).Click();
            _driver.SwitchTo().Alert().Accept();

            _wait.Until(d => d.PageSource.Contains("Deactivated"));
            var refreshedRow = _driver.FindElements(By.CssSelector(".medicine-row")).First(r => r.Text.Contains(medicineName));
            Assert.IsTrue(refreshedRow.Text.Contains("Deactivated"));
        }

        [Test]
        public void DeleteCategory_WithActiveMedicineAssigned_ShowsWarning()
        {
            var categoryName = CreateCategory();
            _driver.Navigate().GoToUrl($"{_baseUrl}/pharmacy/medicines");
            _wait.Until(d => d.FindElement(By.Name("name"))).SendKeys($"Selenium-Blocker-{Guid.NewGuid():N}");
            _driver.FindElement(By.Name("description")).SendKeys("Keeps the category in use");
            new SelectElement(_driver.FindElement(By.Name("categoryId"))).SelectByText(categoryName);
            _driver.FindElement(By.Name("price")).SendKeys("8.50");
            _driver.FindElement(By.CssSelector("button.primary-action")).Click();
            _wait.Until(d => d.FindElement(By.CssSelector(".management-alert.success")));

            _driver.Navigate().GoToUrl($"{_baseUrl}/pharmacy/categories");
            var categoryRow = _wait.Until(d => d.FindElements(By.CssSelector(".list-row")).FirstOrDefault(r => r.Text.Contains(categoryName)));
            categoryRow.FindElement(By.CssSelector("button.danger-link")).Click();
            _driver.SwitchTo().Alert().Accept();

            var errorMessage = _wait.Until(d => d.FindElement(By.CssSelector(".management-alert.error")));
            Assert.IsTrue(errorMessage.Text.Contains("cannot be deleted"));
        }

        [TearDown]
        public void Teardown()
        {
            _driver?.Quit();
            _driver?.Dispose();
        }
    }
}