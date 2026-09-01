using System;
using System.IO;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.Frontend.Tests.Selenium
{
    [TestFixture]
    public class GCN19ProfilePictureTests
    {
        private IWebDriver _driver;
        private WebDriverWait _wait;

        private readonly string _baseUrl = "http://localhost:3000";
        private readonly string _imagePath =
            @"D:\CareNova-02\GCN19-TestFiles\images.jpg";

        [SetUp]
        public void Setup()
        {
            var options = new ChromeOptions();
            options.AddArgument("--headless");
            options.AddArgument("--window-size=1920,1080");

            _driver = new ChromeDriver(options);
            _wait = new WebDriverWait(
                _driver,
                TimeSpan.FromSeconds(15));
        }

        [Test]
        public void GCN19_ValidJpgUpload_ShouldDisplayUploadedProfilePicture()
        {
            Assert.That(
                File.Exists(_imagePath),
                Is.True,
                $"Test image was not found: {_imagePath}");

            var uniqueEmail =
                $"gcn19.selenium.{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}@example.com";

            const string password = "Test@123";

            RegisterCustomer(uniqueEmail, password);

            Login(uniqueEmail, password);

            _driver.Navigate().GoToUrl($"{_baseUrl}/profile");

            var profileImage = _wait.Until(d =>
                d.FindElement(By.CssSelector("img.profile-avatar-image")));

            var originalSource =
                profileImage.GetAttribute("src") ?? string.Empty;

            Assert.That(
                originalSource,
                Is.Not.Empty,
                "Profile avatar should have an initial source.");

            var fileInput = _wait.Until(d =>
                d.FindElement(
                    By.CssSelector("input.profile-picture-input[type='file']")));

            // The production file input is visually hidden.
            // Make it interactable for Selenium only.
            ((IJavaScriptExecutor)_driver).ExecuteScript(
                @"arguments[0].style.display='block';
                  arguments[0].style.visibility='visible';
                  arguments[0].style.opacity='1';",
                fileInput);

            fileInput.SendKeys(_imagePath);

            _wait.Until(d =>
            {
                var image = d.FindElement(
                    By.CssSelector("img.profile-avatar-image"));

                var currentSource =
                    image.GetAttribute("src") ?? string.Empty;

                return currentSource != originalSource &&
                       currentSource.Contains(
                           "/uploads/profile-pictures/",
                           StringComparison.OrdinalIgnoreCase);
            });

            var uploadedImage = _driver.FindElement(
                By.CssSelector("img.profile-avatar-image"));

            var uploadedSource =
                uploadedImage.GetAttribute("src") ?? string.Empty;

            Assert.Multiple(() =>
            {
                Assert.That(
                    uploadedSource,
                    Is.Not.EqualTo(originalSource),
                    "Uploaded picture should replace the default avatar.");

                Assert.That(
                    uploadedSource,
                    Does.Contain("/uploads/profile-pictures/"),
                    "Profile image should point to the uploaded profile picture.");

                Assert.That(
                    uploadedSource,
                    Does.EndWith(".jpg").IgnoreCase,
                    "Uploaded JPG should be stored as a JPG profile picture.");
            });
        }

        private void RegisterCustomer(
            string email,
            string password)
        {
            _driver.Navigate().GoToUrl($"{_baseUrl}/register");

            _wait.Until(d =>
                d.FindElement(By.Name("fullName")))
                .SendKeys("GCN19 Selenium Customer");

            _driver.FindElement(By.Name("email"))
                .SendKeys(email);

            _driver.FindElement(By.Name("password"))
                .SendKeys(password);

            _driver.FindElement(By.Name("confirmPassword"))
                .SendKeys(password);

            _driver.FindElement(By.Name("mobileNumber"))
                .SendKeys("0771234567");

            _driver.FindElement(By.Name("landPhoneNumber"))
                .SendKeys("0112345678");

            _driver.FindElement(By.Name("address"))
                .SendKeys("No. 10, Test Road, Colombo");

            _driver.FindElement(By.Name("dateOfBirth"))
                .SendKeys("05/15/1995");

            var genderSelect = new SelectElement(
                _driver.FindElement(By.Name("gender")));

            genderSelect.SelectByValue("Male");

            _driver.FindElement(
                By.CssSelector("button[type='submit']"))
                .Click();

            _wait.Until(d =>
                d.Url.Contains("/login") ||
                d.PageSource.Contains(
                    "success",
                    StringComparison.OrdinalIgnoreCase) ||
                d.PageSource.Contains(
                    "created",
                    StringComparison.OrdinalIgnoreCase));
        }

        private void Login(
            string email,
            string password)
        {
            _driver.Navigate().GoToUrl($"{_baseUrl}/login");

            _wait.Until(d =>
                d.FindElement(By.Name("email")))
                .SendKeys(email);

            _driver.FindElement(By.Name("password"))
                .SendKeys(password);

            _driver.FindElement(
                By.CssSelector("button[type='submit']"))
                .Click();

            _wait.Until(d =>
                d.Url.Contains("-dashboard"));
        }

        [TearDown]
        public void Teardown()
        {
            _driver?.Quit();
            _driver?.Dispose();
        }
    }
}
