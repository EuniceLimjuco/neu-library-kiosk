const timeDisplay = document.getElementById("time-display");
const checkinDisplay = document.getElementById("checkin-display");
const collegeDisplay = document.getElementById("college-display");
const purposeDisplay = document.getElementById("purpose-display");
const doneButton = document.getElementById("doneButton");

function updateTime() {
  const now = new Date();
  timeDisplay.textContent = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
}

function setCheckInTime() {
  let savedCheckInTime = localStorage.getItem("checkInTime");

  if (!savedCheckInTime) {
    const now = new Date();
    savedCheckInTime = now.toLocaleString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      month: "long",
      day: "numeric",
      year: "numeric"
    });
    localStorage.setItem("checkInTime", savedCheckInTime);
  }

  checkinDisplay.textContent = savedCheckInTime;
}

function getCurrentVisitor() {
  try {
    return JSON.parse(localStorage.getItem("currentVisitor")) || {};
  } catch (error) {
    return {};
  }
}

function loadSelectedDetails() {
  const currentVisitor = getCurrentVisitor();

  const savedCollegeDepartment =
    currentVisitor.college ||
    localStorage.getItem("selectedCollegeDepartment") ||
    "Not provided";

  const savedPurpose =
    currentVisitor.purpose ||
    localStorage.getItem("selectedPurpose") ||
    "Not provided";

  collegeDisplay.textContent = savedCollegeDepartment;
  purposeDisplay.textContent = savedPurpose;
}

doneButton.addEventListener("click", function () {
  localStorage.removeItem("checkInTime");
  window.location.href = "index.html";
});

updateTime();
setInterval(updateTime, 1000);

loadSelectedDetails();
setCheckInTime();
