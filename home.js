import { supabase } from "./supabase.js";
import { saveAdminSession, isUserBlocked } from "./db.js";

const liveTime = document.getElementById("liveTime");

const helpBtn = document.getElementById("helpBtn");
const helpModal = document.getElementById("helpModal");
const closeHelpModal = document.getElementById("closeHelpModal");
const closeHelpModalFooter = document.getElementById("closeHelpModalFooter");

const adminLoginBtn = document.getElementById("adminLoginBtn");
const adminModal = document.getElementById("adminModal");
const closeAdminModal = document.getElementById("closeAdminModal");
const cancelAdminModal = document.getElementById("cancelAdminModal");
const submitAdminLogin = document.getElementById("submitAdminLogin");
const adminIdentifier = document.getElementById("adminIdentifier");
const adminPassword = document.getElementById("adminPassword");
const adminError = document.getElementById("adminError");
const adminSuccess = document.getElementById("adminSuccess");
const togglePassword = document.getElementById("togglePassword");
const togglePasswordIcon = document.getElementById("togglePasswordIcon");
const adminGoogleQuickLogin = document.getElementById("adminGoogleQuickLogin");

const scanNowBtn = document.getElementById("scanNowBtn");
const scanModal = document.getElementById("scanModal");
const closeScanModal = document.getElementById("closeScanModal");
const cancelScanModal = document.getElementById("cancelScanModal");
const doneScanModal = document.getElementById("doneScanModal");

const studentNumberBtn = document.getElementById("studentNumberBtn");
const studentNumberModal = document.getElementById("studentNumberModal");
const closeStudentNumberModal = document.getElementById("closeStudentNumberModal");
const cancelStudentNumberModal = document.getElementById("cancelStudentNumberModal");
const nextStudentNumberModal = document.getElementById("nextStudentNumberModal");
const studentNameInput = document.getElementById("studentNameInput");
const studentNumberInput = document.getElementById("studentNumberInput");
const studentNameError = document.getElementById("studentNameError");
const studentNumberError = document.getElementById("studentNumberError");

const googleSignInBtn = document.getElementById("googleSignInBtn");

/* kept here in case these elements still exist in your HTML */
const googleEmailModal = document.getElementById("googleEmailModal");
const closeGoogleEmailModal = document.getElementById("closeGoogleEmailModal");
const cancelGoogleEmailModal = document.getElementById("cancelGoogleEmailModal");
const nextGoogleEmailModal = document.getElementById("nextGoogleEmailModal");
const googleEmailInput = document.getElementById("googleEmailInput");
const googleEmailError = document.getElementById("googleEmailError");

const collegeDepartmentModal = document.getElementById("collegeDepartmentModal");
const closeCollegeDepartmentModal = document.getElementById("closeCollegeDepartmentModal");
const cancelCollegeDepartmentModal = document.getElementById("cancelCollegeDepartmentModal");
const nextCollegeDepartmentModal = document.getElementById("nextCollegeDepartmentModal");
const collegeDepartmentSelect = document.getElementById("collegeDepartmentSelect");
const collegeDepartmentError = document.getElementById("collegeDepartmentError");

const ADMIN_SESSION_KEY = "currentAdminSession";
const LIVE_SITE_ORIGIN = "https://neu-library-system.netlify.app";

function updateLiveTime() {
  const now = new Date();
  if (liveTime) {
    liveTime.textContent = now.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  }
}

function lockBodyScroll() {
  document.body.classList.add("overflow-hidden");
}

function unlockBodyScroll() {
  document.body.classList.remove("overflow-hidden");
}

function openModal(modal) {
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  lockBodyScroll();
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  unlockBodyScroll();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidStudentNumber(studentNumber) {
  return /^\d{10}$/.test(studentNumber);
}

function getAdminRoleFromEmail(email) {
  const normalized = (email || "").toLowerCase();

  if (normalized.includes("faculty")) return "Faculty";
  if (
    normalized.includes("admin") ||
    normalized.includes("employee") ||
    normalized.includes("staff")
  ) {
    return "Employee";
  }

  return "Admin";
}

function getNameFromEmail(email) {
  const username = (email || "").split("@")[0] || "User";

  return (
    username
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || "User"
  );
}

function showBlockedMessage(message) {
  alert(message || "This user is blocked and cannot access the system.");
}

function clearCurrentVisitor() {
  localStorage.removeItem("currentVisitor");
}

function clearAdminSession() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
  localStorage.removeItem("adminSessionLogId");
  sessionStorage.removeItem("adminSessionLogId");
  localStorage.removeItem("sessionLogId");
  sessionStorage.removeItem("sessionLogId");
}

function clearStoredSessions() {
  clearCurrentVisitor();
  clearAdminSession();
  localStorage.removeItem("selectedCollegeDepartment");
}

function getCurrentVisitor() {
  try {
    return JSON.parse(localStorage.getItem("currentVisitor")) || {};
  } catch (error) {
    return {};
  }
}

function saveCurrentVisitor(visitorData) {
  localStorage.setItem("currentVisitor", JSON.stringify(visitorData));
}

function saveCurrentAdminSession(adminSessionData) {
  const sessionLogId = adminSessionData.sessionLogId || adminSessionData.logId || "";

  const payload = {
    logId: sessionLogId,
    sessionLogId: sessionLogId,
    email: adminSessionData.email || "",
    name: adminSessionData.name || "",
    role: adminSessionData.role || "Admin"
  };

  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(payload));
  localStorage.setItem("adminSessionLogId", sessionLogId);
  sessionStorage.setItem("adminSessionLogId", sessionLogId);
  localStorage.setItem("sessionLogId", sessionLogId);
  sessionStorage.setItem("sessionLogId", sessionLogId);
}

function clearOAuthParamsFromUrl() {
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete("admin_google");
  cleanUrl.searchParams.delete("student_google");
  cleanUrl.searchParams.delete("code");
  cleanUrl.searchParams.delete("error");
  cleanUrl.hash = "";
  window.history.replaceState({}, "", cleanUrl.pathname);
}

async function resetForStudentCheckIn() {
  clearCurrentVisitor();
  localStorage.removeItem("selectedCollegeDepartment");
  localStorage.removeItem("sessionLogId");
  sessionStorage.removeItem("sessionLogId");

  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error("Failed to clear Supabase session:", error);
  }

  clearOAuthParamsFromUrl();
}

function clearStaleAdminSessionOnHome() {
  const path = (window.location.pathname || "").toLowerCase();
  const isAdminPage =
    path.includes("admindb.html") ||
    path.includes("user_management.html") ||
    path.includes("block_list.html");

  if (!isAdminPage) {
    clearAdminSession();
  }
}

function openHelpModalFunc() {
  openModal(helpModal);
}

function closeHelpModalFunc() {
  closeModal(helpModal);
}

function openAdminModal() {
  if (adminError) adminError.classList.add("hidden");
  if (adminSuccess) adminSuccess.classList.add("hidden");
  if (adminIdentifier) adminIdentifier.value = "";
  if (adminPassword) {
    adminPassword.value = "";
    adminPassword.type = "password";
  }
  if (togglePasswordIcon) togglePasswordIcon.textContent = "visibility";

  openModal(adminModal);

  setTimeout(() => {
    if (adminIdentifier) adminIdentifier.focus();
  }, 100);
}

function closeAdminModalFunc() {
  closeModal(adminModal);
}

function openScanModalFunc() {
  openModal(scanModal);
}

function closeScanModalFunc() {
  closeModal(scanModal);
}

async function openStudentNumberModalFunc() {
  await resetForStudentCheckIn();

  if (studentNameInput) studentNameInput.value = "";
  if (studentNumberInput) studentNumberInput.value = "";
  if (studentNameError) studentNameError.classList.add("hidden");
  if (studentNumberError) studentNumberError.classList.add("hidden");

  openModal(studentNumberModal);

  setTimeout(() => {
    if (studentNameInput) studentNameInput.focus();
  }, 100);
}

function closeStudentNumberModalFunc() {
  if (studentNameInput) studentNameInput.value = "";
  if (studentNumberInput) studentNumberInput.value = "";
  if (studentNameError) studentNameError.classList.add("hidden");
  if (studentNumberError) studentNumberError.classList.add("hidden");
  closeModal(studentNumberModal);
}

/* kept only in case your HTML still has this modal */
function closeGoogleEmailModalFunc() {
  if (googleEmailInput) googleEmailInput.value = "";
  if (googleEmailError) googleEmailError.classList.add("hidden");
  closeModal(googleEmailModal);
}

function setNextCollegeButtonState(enabled) {
  if (!nextCollegeDepartmentModal) return;

  nextCollegeDepartmentModal.disabled = !enabled;

  if (enabled) {
    nextCollegeDepartmentModal.classList.remove("disabled-btn");
    nextCollegeDepartmentModal.classList.add("primary-btn");
  } else {
    nextCollegeDepartmentModal.classList.remove("primary-btn");
    nextCollegeDepartmentModal.classList.add("disabled-btn");
  }
}

function openCollegeDepartmentModalFunc() {
  if (collegeDepartmentSelect) collegeDepartmentSelect.value = "";
  if (collegeDepartmentError) collegeDepartmentError.classList.add("hidden");
  setNextCollegeButtonState(false);
  openModal(collegeDepartmentModal);
}

function closeCollegeDepartmentModalFunc() {
  if (collegeDepartmentSelect) collegeDepartmentSelect.value = "";
  if (collegeDepartmentError) collegeDepartmentError.classList.add("hidden");
  setNextCollegeButtonState(false);
  closeModal(collegeDepartmentModal);
}

async function proceedToPurposePage() {
  const selectedValue = collegeDepartmentSelect ? collegeDepartmentSelect.value.trim() : "";

  if (!selectedValue) {
    if (collegeDepartmentError) collegeDepartmentError.classList.remove("hidden");
    setNextCollegeButtonState(false);
    return;
  }

  if (collegeDepartmentError) collegeDepartmentError.classList.add("hidden");

  const currentVisitor = getCurrentVisitor();
  currentVisitor.college = selectedValue;
  currentVisitor.collegeDepartment = selectedValue;
  saveCurrentVisitor(currentVisitor);
  localStorage.setItem("selectedCollegeDepartment", selectedValue);

  window.location.href = "purpose.html";
}

async function handleStudentNumberSubmit() {
  const studentName = studentNameInput ? studentNameInput.value.trim() : "";
  const studentNumber = studentNumberInput ? studentNumberInput.value.trim() : "";

  let hasError = false;

  if (!studentName) {
    if (studentNameError) {
      studentNameError.textContent = "Please enter your full name.";
      studentNameError.classList.remove("hidden");
    }
    hasError = true;
  } else if (studentNameError) {
    studentNameError.classList.add("hidden");
  }

  if (!studentNumber) {
    if (studentNumberError) {
      studentNumberError.textContent = "Please enter your student number.";
      studentNumberError.classList.remove("hidden");
    }
    hasError = true;
  } else if (!isValidStudentNumber(studentNumber)) {
    if (studentNumberError) {
      studentNumberError.textContent = "Student number must be exactly 10 digits.";
      studentNumberError.classList.remove("hidden");
    }
    hasError = true;
  } else if (studentNumberError) {
    studentNumberError.classList.add("hidden");
  }

  if (hasError) return;

  const blocked = await isUserBlocked({
    idNumber: studentNumber,
    name: studentName
  });

  if (blocked) {
    showBlockedMessage("This student is blocked and cannot access the system.");
    return;
  }

  saveCurrentVisitor({
    name: studentName,
    email: "",
    idNumber: studentNumber,
    role: "Student",
    authType: "student-number"
  });

  closeStudentNumberModalFunc();
  openCollegeDepartmentModalFunc();
}

/* THIS RESTORES THE REAL GOOGLE STUDENT FLOW */
async function handleStudentGoogleLogin() {
  try {
    await resetForStudentCheckIn();

    const redirectTo = `${LIVE_SITE_ORIGIN}/index.html?student_google=1`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo
      }
    });

    if (error) throw error;
  } catch (error) {
    console.error("Student Google login failed:", error);
    alert("Google sign in failed. Please try again.");
  }
}

async function handleAdminLogin() {
  const identifier = adminIdentifier ? adminIdentifier.value.trim() : "";
  const password = adminPassword ? adminPassword.value : "";

  if (adminError) adminError.classList.add("hidden");
  if (adminSuccess) adminSuccess.classList.add("hidden");

  if (!identifier || !password) {
    if (adminError) {
      adminError.textContent = "Please enter your institutional email and password.";
      adminError.classList.remove("hidden");
    }
    return;
  }

  const blocked = await isUserBlocked({ email: identifier });

  if (blocked) {
    showBlockedMessage("This admin account is blocked and cannot access the system.");
    return;
  }

  try {
    const sessionLogId = `admin_${Date.now()}`;

    await saveAdminSession({
      logId: sessionLogId,
      name: getNameFromEmail(identifier),
      email: identifier,
      idNumber: "-",
      collegeDepartment: "Admin",
      role: getAdminRoleFromEmail(identifier),
      purpose: "Admin Access",
      status: "Checked In"
    });

    saveCurrentAdminSession({
      sessionLogId,
      email: identifier,
      name: getNameFromEmail(identifier),
      role: getAdminRoleFromEmail(identifier)
    });

    if (adminSuccess) {
      adminSuccess.textContent = "Login successful. Redirecting to admin dashboard...";
      adminSuccess.classList.remove("hidden");
    }

    setTimeout(() => {
      window.location.href = "admindb.html";
    }, 800);
  } catch (error) {
    console.error("Admin login failed:", error);
    if (adminError) {
      adminError.textContent = "Admin login failed. Please try again.";
      adminError.classList.remove("hidden");
    }
  }
}

async function handleAdminGoogleLogin() {
  try {
    clearStoredSessions();

    const redirectTo = `${LIVE_SITE_ORIGIN}/index.html?admin_google=1`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo
      }
    });

    if (error) throw error;
  } catch (error) {
    console.error("Google admin login failed:", error);
    if (adminError) {
      adminError.textContent = "Google login failed. Please try again.";
      adminError.classList.remove("hidden");
    }
  }
}

async function handleGoogleAuthResult() {
  const url = new URL(window.location.href);
  const isAdminGoogleFlow = url.searchParams.get("admin_google") === "1";
  const isStudentGoogleFlow = url.searchParams.get("student_google") === "1";
  const hasCode = url.searchParams.has("code");
  const hasError = url.searchParams.has("error");

  if (!isAdminGoogleFlow && !isStudentGoogleFlow && !hasCode && !hasError) return;

  if (hasError) {
    console.error("OAuth error:", url.searchParams.get("error"));
    clearOAuthParamsFromUrl();
    return;
  }

  try {
    const {
      data: { session },
      error
    } = await supabase.auth.getSession();

    if (error) throw error;
    if (!session || !session.user) return;

    const email = session.user.email || "";
    const name =
      session.user.user_metadata?.full_name ||
      session.user.user_metadata?.name ||
      getNameFromEmail(email);

    const blocked = await isUserBlocked({ email, name });

    if (blocked) {
      await supabase.auth.signOut();
      clearStoredSessions();
      showBlockedMessage("This Google account is blocked and cannot access the system.");
      clearOAuthParamsFromUrl();
      return;
    }

    if (isAdminGoogleFlow) {
      const sessionLogId = `admin_${Date.now()}`;

      await saveAdminSession({
        logId: sessionLogId,
        name,
        email,
        idNumber: "-",
        collegeDepartment: "Admin",
        role: getAdminRoleFromEmail(email),
        purpose: "Admin Access",
        status: "Checked In"
      });

      saveCurrentAdminSession({
        sessionLogId,
        email,
        name,
        role: getAdminRoleFromEmail(email)
      });

      clearOAuthParamsFromUrl();
      window.location.href = "admindb.html";
      return;
    }

    if (isStudentGoogleFlow) {
      saveCurrentVisitor({
        name,
        email,
        idNumber: "-",
        role: "Student",
        authType: "google-oauth"
      });

      clearOAuthParamsFromUrl();
      openCollegeDepartmentModalFunc();
    }
  } catch (error) {
    console.error("Failed to complete Google login:", error);
    clearOAuthParamsFromUrl();
  }
}

if (helpBtn) helpBtn.addEventListener("click", openHelpModalFunc);
if (closeHelpModal) closeHelpModal.addEventListener("click", closeHelpModalFunc);
if (closeHelpModalFooter) closeHelpModalFooter.addEventListener("click", closeHelpModalFunc);

if (adminLoginBtn) adminLoginBtn.addEventListener("click", openAdminModal);
if (closeAdminModal) closeAdminModal.addEventListener("click", closeAdminModalFunc);
if (cancelAdminModal) cancelAdminModal.addEventListener("click", closeAdminModalFunc);
if (submitAdminLogin) submitAdminLogin.addEventListener("click", handleAdminLogin);
if (adminGoogleQuickLogin) adminGoogleQuickLogin.addEventListener("click", handleAdminGoogleLogin);

if (togglePassword) {
  togglePassword.addEventListener("click", () => {
    if (!adminPassword || !togglePasswordIcon) return;

    const isHidden = adminPassword.type === "password";
    adminPassword.type = isHidden ? "text" : "password";
    togglePasswordIcon.textContent = isHidden ? "visibility_off" : "visibility";
  });
}

if (scanNowBtn) scanNowBtn.addEventListener("click", openScanModalFunc);
if (closeScanModal) closeScanModal.addEventListener("click", closeScanModalFunc);
if (cancelScanModal) cancelScanModal.addEventListener("click", closeScanModalFunc);
if (doneScanModal) {
  doneScanModal.addEventListener("click", async () => {
    await resetForStudentCheckIn();

    saveCurrentVisitor({
      name: "Scanned Student",
      email: "",
      idNumber: "-",
      role: "Student",
      authType: "tap-id"
    });

    closeScanModalFunc();
    openCollegeDepartmentModalFunc();
  });
}

if (studentNumberBtn) studentNumberBtn.addEventListener("click", openStudentNumberModalFunc);
if (closeStudentNumberModal) closeStudentNumberModal.addEventListener("click", closeStudentNumberModalFunc);
if (cancelStudentNumberModal) cancelStudentNumberModal.addEventListener("click", closeStudentNumberModalFunc);
if (nextStudentNumberModal) nextStudentNumberModal.addEventListener("click", handleStudentNumberSubmit);

/* student google button now opens real google chooser */
if (googleSignInBtn) googleSignInBtn.addEventListener("click", handleStudentGoogleLogin);

/* kept only if these modal elements still exist */
if (closeGoogleEmailModal) closeGoogleEmailModal.addEventListener("click", closeGoogleEmailModalFunc);
if (cancelGoogleEmailModal) cancelGoogleEmailModal.addEventListener("click", closeGoogleEmailModalFunc);
if (nextGoogleEmailModal && googleEmailInput) {
  nextGoogleEmailModal.addEventListener("click", async () => {
    const email = googleEmailInput.value.trim();

    if (!email || !isValidEmail(email)) {
      if (googleEmailError) {
        googleEmailError.textContent = "Please enter a valid email address.";
        googleEmailError.classList.remove("hidden");
      }
      return;
    }

    const blocked = await isUserBlocked({ email });

    if (blocked) {
      showBlockedMessage("This email is blocked and cannot access the system.");
      return;
    }

    saveCurrentVisitor({
      name: getNameFromEmail(email),
      email,
      idNumber: "-",
      role: "Student",
      authType: "google-email"
    });

    closeGoogleEmailModalFunc();
    openCollegeDepartmentModalFunc();
  });
}

if (collegeDepartmentSelect) {
  collegeDepartmentSelect.addEventListener("change", () => {
    const hasValue = !!collegeDepartmentSelect.value.trim();
    if (collegeDepartmentError) collegeDepartmentError.classList.add("hidden");
    setNextCollegeButtonState(hasValue);
  });
}

if (closeCollegeDepartmentModal) closeCollegeDepartmentModal.addEventListener("click", closeCollegeDepartmentModalFunc);
if (cancelCollegeDepartmentModal) cancelCollegeDepartmentModal.addEventListener("click", closeCollegeDepartmentModalFunc);
if (nextCollegeDepartmentModal) nextCollegeDepartmentModal.addEventListener("click", proceedToPurposePage);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (helpModal && !helpModal.classList.contains("hidden")) closeHelpModalFunc();
    if (adminModal && !adminModal.classList.contains("hidden")) closeAdminModalFunc();
    if (scanModal && !scanModal.classList.contains("hidden")) closeScanModalFunc();
    if (studentNumberModal && !studentNumberModal.classList.contains("hidden")) closeStudentNumberModalFunc();
    if (googleEmailModal && !googleEmailModal.classList.contains("hidden")) closeGoogleEmailModalFunc();
    if (collegeDepartmentModal && !collegeDepartmentModal.classList.contains("hidden")) closeCollegeDepartmentModalFunc();
  }
});

clearStaleAdminSessionOnHome();
updateLiveTime();
setInterval(updateLiveTime, 1000);
handleGoogleAuthResult();
