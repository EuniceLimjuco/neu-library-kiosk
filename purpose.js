import { saveVisitorLog, isUserBlocked } from "./db.js";

function updateTime() {
  const now = new Date();
  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

  const display = document.getElementById("time-display");
  if (display) {
    display.textContent = time;
  }
}

setInterval(updateTime, 1000);
updateTime();

const helpBtn = document.getElementById("helpBtn");
const helpModal = document.getElementById("helpModal");
const closeHelpModal = document.getElementById("closeHelpModal");
const closeHelpModalFooter = document.getElementById("closeHelpModalFooter");

const purposeCards = document.querySelectorAll(".purpose-card");
const continueButton = document.getElementById("continueButton");
const cancelButton = document.getElementById("cancelButton");

let selectedPurpose = null;

function lockBodyScroll() {
  document.body.classList.add("overflow-hidden");
}

function unlockBodyScroll() {
  document.body.classList.remove("overflow-hidden");
}

function openModal(modal) {
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  lockBodyScroll();
}

function closeModal(modal) {
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  unlockBodyScroll();
}

function getCurrentVisitor() {
  try {
    return JSON.parse(localStorage.getItem("currentVisitor")) || {};
  } catch (error) {
    return {};
  }
}

helpBtn.addEventListener("click", function () {
  openModal(helpModal);
});

closeHelpModal.addEventListener("click", function () {
  closeModal(helpModal);
});

closeHelpModalFooter.addEventListener("click", function () {
  closeModal(helpModal);
});

helpModal.addEventListener("click", function (e) {
  const content = helpModal.firstElementChild;
  if (!content.contains(e.target)) {
    closeModal(helpModal);
  }
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && !helpModal.classList.contains("hidden")) {
    closeModal(helpModal);
  }
});

purposeCards.forEach((card) => {
  card.addEventListener("click", function () {
    purposeCards.forEach((item) => {
      item.classList.remove("selected");
      item.setAttribute("aria-pressed", "false");
    });

    this.classList.add("selected");
    this.setAttribute("aria-pressed", "true");

    selectedPurpose = this.dataset.purpose;

    continueButton.disabled = false;
    continueButton.classList.remove("disabled-btn");
    continueButton.classList.add("active");
  });
});

continueButton.addEventListener("click", async function () {
  if (!selectedPurpose) return;

  const currentVisitor = getCurrentVisitor();

  if (!currentVisitor.name && !currentVisitor.idNumber && !currentVisitor.email) {
    alert("No visitor information found. Please start again from the home page.");
    window.location.href = "index.html";
    return;
  }

  if (await isUserBlocked(currentVisitor)) {
    alert("This user is blocked and cannot check in.");
    localStorage.removeItem("currentVisitor");
    window.location.href = "index.html";
    return;
  }

  currentVisitor.purpose = selectedPurpose;

  if (!currentVisitor.idNumber) {
    currentVisitor.idNumber = "-";
  }

  try {
    const createdLog = await saveVisitorLog(currentVisitor);

    localStorage.setItem("latestVisitorLogId", createdLog.log_id);
    localStorage.setItem("selectedPurpose", selectedPurpose);
    localStorage.setItem("currentVisitor", JSON.stringify(currentVisitor));

    localStorage.removeItem("studentIdentifier");
    localStorage.removeItem("studentName");

    window.location.href = "welcome.html";
  } catch (error) {
    console.error(error);
    alert("Failed to save visitor log.");
  }
});

cancelButton.addEventListener("click", function () {
  localStorage.removeItem("currentVisitor");
  window.location.href = "index.html";
});
