using System;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace CareNova.Frontend.Tests.Selenium
{
    [TestFixture]
    public class GCN35DoctorProfileTests
    {
        private IWebDriver _driver;
        private WebDriverWait _wait;

        private readonly string _baseUrl = "http://localhost:3000";
        private readonly string _doctorId =
            "08df1938-5b42-4def-83b1-dd2ef1ca9db9";

        private string _patientEmail;
        private string _patientPassword;

        [SetUp]
        public void Setup()
        {
            _patientEmail =
                Environment.GetEnvironmentVariable("CARENOVA_PATIENT_EMAIL");

            _patientPassword =
                Environment.GetEnvironmentVariable("CARENOVA_PATIENT_PASSWORD");

            Assert.That(
                _patientEmail,
                Is.Not.Null.And.Not.Empty,
                "CARENOVA_PATIENT_EMAIL environment variable is required.");

            Assert.That(
                _patientPassword,
                Is.Not.Null.And.Not.Empty,
                "CARENOVA_PATIENT_PASSWORD environment variable is required.");

            var options = new ChromeOptions();
            options.AddArgument("--headless");
            options.AddArgument("--window-size=1920,1080");

            _driver = new ChromeDriver(options);
            _wait = new WebDriverWait(
                _driver,
                TimeSpan.FromSeconds(15));

            LoginAsPatient();
        }

        private void LoginAsPatient()
        {
            _driver.Navigate().GoToUrl($"{_baseUrl}/login");

            _wait.Until(d =>
                d.FindElement(By.Id("login-email")))
                .SendKeys(_patientEmail);

            _driver.FindElement(By.Id("login-password"))
                .SendKeys(_patientPassword);

            _driver.FindElement(
                By.CssSelector("button[type='submit']"))
                .Click();

            _wait.Until(d =>
                d.Url.Contains("patient-dashboard"));
        }

        private void OpenDoctorProfile()
        {
            _driver.Navigate().GoToUrl(
                $"{_baseUrl}/patient/doctors/{_doctorId}");

            _wait.Until(d =>
                d.FindElements(By.CssSelector(".dp-hero-title")).Count > 0);
        }

        [Test]
        public void Patient_CanViewDoctorProfessionalProfile()
        {
            OpenDoctorProfile();

            var pageText = _driver.FindElement(By.TagName("body")).Text;

            Assert.Multiple(() =>
            {
                Assert.That(pageText, Does.Contain("Doctor"));
                Assert.That(pageText, Does.Contain("Cardiology"));
                Assert.That(pageText, Does.Contain("Specialization"));
                Assert.That(pageText, Does.Contain("Qualifications"));
                Assert.That(pageText, Does.Contain("Experience"));
            });
        }

        [Test]
        public void Patient_CanViewConfiguredConsultationFee()
        {
            OpenDoctorProfile();

            var fee = _wait.Until(d =>
                d.FindElement(
                    By.CssSelector("[data-testid='consultation-fee']")));

            Assert.That(fee.Displayed, Is.True);
            Assert.That(fee.Text, Does.Contain("2,500"));
        }

        [Test]
        public void Patient_CanViewDoctorAvailability()
        {
            OpenDoctorProfile();

            var pageText = _driver.FindElement(By.TagName("body")).Text;

            Assert.Multiple(() =>
            {
                Assert.That(
                    pageText,
                    Does.Contain("3 open consultation slots"));

                Assert.That(
                    pageText,
                    Does.Contain("10:00 AM"));

                Assert.That(
                    pageText,
                    Does.Contain("10:20 AM"));

                Assert.That(
                    pageText,
                    Does.Contain("10:40 AM"));
            });
        }

        [Test]
        public void MissingOptionalInformation_DoesNotBreakProfile()
        {
            OpenDoctorProfile();

            var pageText = _driver.FindElement(By.TagName("body")).Text;

            Assert.Multiple(() =>
            {
                Assert.That(
                    pageText,
                    Does.Contain("No qualifications listed."));

                Assert.That(
                    pageText,
                    Does.Contain("No experience listed."));

                Assert.That(
                    pageText,
                    Does.Contain("No other details listed."));
            });
        }

        [Test]
        public void UnknownDoctor_ShowsProfileNotAvailableMessage()
        {
            const string unknownDoctorId =
                "11111111-1111-1111-1111-111111111111";

            _driver.Navigate().GoToUrl(
                $"{_baseUrl}/patient/doctors/{unknownDoctorId}");

            var unavailable = _wait.Until(d =>
                d.FindElement(By.CssSelector(".pd-empty")));

            Assert.Multiple(() =>
            {
                Assert.That(
                    unavailable.Text,
                    Does.Contain("Doctor profile not available"));

                Assert.That(
                    unavailable.Text,
                    Does.Contain(
                        "This doctor has not published a professional profile yet."));

                Assert.That(
                    unavailable.Text,
                    Does.Contain("Back to doctor search"));
            });
        }

        [TearDown]
        public void Teardown()
        {
            _driver?.Quit();
            _driver?.Dispose();
        }
    }
}