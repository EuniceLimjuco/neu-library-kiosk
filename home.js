import { supabase } from "./supabase.js";
import { saveVisitorLog, saveAdminSession, isUserBlocked } from "./db.js";

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
  const sessionLogId =
    adminSessionData.sessionLogId ||
    adminSessionData.logId ||
    "";

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
  cleanUrl.searchParams.delete("code");
  cleanUrl.searchParams.delete("error");
  cleanUrl.hash = "";
  window.history.replaceState({}, "", cleanUrl.pathname);
}

async function resetForStudentCheckIn() {
  clearStoredSessions();

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

async function openGoogleEmailModalFunc() {
  await resetForStudentCheckIn();

  if (googleEmailInput) googleEmailInput.value = "";
  if (googleEmailError) googleEmailError.classList.add("hidden");
  openModal(googleEmailModal);

  setTimeout(() => {
    if (googleEmailInput) googleEmailInput.focus();
  }, 100);
}

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

async function handleGoogleSignIn() {
  try {
    await resetForStudentCheckIn();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${LIVE_SITE_ORIGIN}/index.html`,
        queryParams: {
          prompt: "select_account"
        },
        scopes: "openid email profile https://www.googleapis.com/auth/userinfo.email"
      }
    });

    if (error) {
      console.error("Google sign-in error:", error);
      alert("Google sign-in failed.");
    }
  } catch (error) {
    console.error("Unexpected Google sign-in error:", error);
    alert("Google sign-in failed.");
  }
}

async function handleAdminGoogleOAuth() {
  try {
    clearStoredSessions();

    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Failed to clear Supabase session before admin Google login:", error);
    }

    const redirectUrl = new URL(`${LIVE_SITE_ORIGIN}/index.html`);
    redirectUrl.searchParams.set("admin_google", "1");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl.toString(),
        queryParams: {
          prompt: "select_account"
        },
        scopes: "openid email profile https://www.googleapis.com/auth/userinfo.email"
      }
    });

    if (error) {
      console.error("Admin Google sign-in error:", error);
      alert("Admin Google sign-in failed.");
    }
  } catch (error) {
    console.error("Unexpected admin Google sign-in error:", error);
    alert("Admin Google sign-in failed.");
  }
}

async function handleGoogleAuthResult() {
  try {
    const url = new URL(window.location.href);
    const hasHashAccessToken = window.location.hash.includes("access_token=");
    const hasHashError = window.location.hash.includes("error=");
    const hasOAuthCode = url.searchParams.get("code");
    const hasOAuthError = url.searchParams.get("error");
    const isAdminGoogleLogin = url.searchParams.get("admin_google") === "1";

    const sessionResult = await supabase.auth.getSession();
    const session = sessionResult?.data?.session || null;
    const error = sessionResult?.error || null;

    if (error) {
      console.error("Error getting Google session:", error);
      return;
    }

    const hasAnyOAuthSignal =
      !!hasOAuthCode ||
      !!hasOAuthError ||
      hasHashAccessToken ||
      hasHashError ||
      !!session;

    if (!hasAnyOAuthSignal) {
      return;
    }

    if (hasOAuthError || hasHashError) {
      console.error("Google OAuth returned an error.");
      clearOAuthParamsFromUrl();
      return;
    }

    if (!session || !session.user) {
      return;
    }

    const email = session.user.email || "";
    const fullName =
      session.user.user_metadata?.full_name ||
      session.user.user_metadata?.name ||
      getNameFromEmail(email);

    if (isAdminGoogleLogin) {
      if (!isValidEmail(email)) {
        await supabase.auth.signOut();
        alert("Invalid Google email account for admin login.");
        clearOAuthParamsFromUrl();
        return;
      }

      const adminUser = {
        name: fullName,
        email,
        idNumber: "-",
        role: getAdminRoleFromEmail(email)
      };

      if (await isUserBlocked(adminUser)) {
        await supabase.auth.signOut();
        alert("This admin account is blocked and cannot log in.");
        clearOAuthParamsFromUrl();
        return;
      }

      try {
        const createdLog = await saveVisitorLog({
          ...adminUser,
          college: "Employee",
          purpose: "Admin Google Login",
          status: "Checked In",
          loginMethod: "Google Login"
        });

        const sessionLogId = createdLog.log_id || createdLog.logId;

        await saveAdminSession(
          adminUser,
          sessionLogId,
          "Google Login"
        );

        saveCurrentAdminSession({
          logId: sessionLogId,
          sessionLogId,
          email: adminUser.email,
          name: adminUser.name,
          role: adminUser.role
        });

        clearCurrentVisitor();
        await supabase.auth.signOut();
        clearOAuthParamsFromUrl();

        window.location.href = "admindb.html";
        return;
      } catch (saveError) {
        console.error("Failed admin Google login save:", saveError);
        alert("Failed to complete admin Google login.");
        return;
      }
    }

    if (!isValidEmail(email)) {
      await supabase.auth.signOut();
      alert("Invalid Google email account.");
      clearOAuthParamsFromUrl();
      return;
    }

    const visitor = {
      name: fullName,
      idNumber: "-",
      email,
      role: "Student",
      loginMethod: "Google OAuth"
    };

    if (await isUserBlocked(visitor)) {
      await supabase.auth.signOut();
      showBlockedMessage("This user is blocked and cannot check in.");
      clearOAuthParamsFromUrl();
      return;
    }

    clearAdminSession();
    saveCurrentVisitor(visitor);

    await supabase.auth.signOut();
    clearOAuthParamsFromUrl();
    openCollegeDepartmentModalFunc();
  } catch (error) {
    console.error("Google auth result error:", error);
  }
}

async function handleAdminLogin() {
  const email = adminIdentifier.value.trim();
  const password = adminPassword.value.trim();

  if (adminError) adminError.classList.add("hidden");
  if (adminSuccess) adminSuccess.classList.add("hidden");

  if (!email || !password) {
    adminError.textContent = "Please enter your email and password.";
    adminError.classList.remove("hidden");
    return;
  }

  if (!isValidEmail(email)) {
    adminError.textContent = "Please enter a valid email address.";
    adminError.classList.remove("hidden");
    return;
  }

  const adminUser = {
    name: getNameFromEmail(email),
    email,
    idNumber: "-",
    role: getAdminRoleFromEmail(email)
  };

  if (await isUserBlocked(adminUser)) {
    adminError.textContent = "This account is blocked and cannot log in.";
    adminError.classList.remove("hidden");
    return;
  }

  try {
    clearCurrentVisitor();

    const createdLog = await saveVisitorLog({
      ...adminUser,
      college: "Employee",
      purpose: "Admin Login",
      status: "Checked In",
      loginMethod: "Email Password"
    });

    const sessionLogId = createdLog.log_id || createdLog.logId;

    await saveAdminSession(
      adminUser,
      sessionLogId,
      "Email Password"
    );

    saveCurrentAdminSession({
      logId: sessionLogId,
      sessionLogId,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role
    });

    adminSuccess.textContent = "Login successful. Redirecting to admin dashboard...";
    adminSuccess.classList.remove("hidden");

    setTimeout(() => {
      window.location.href = "admindb.html";
    }, 800);
  } catch (error) {
    console.error(error);
    adminError.textContent = "Failed to log in admin.";
    adminError.classList.remove("hidden");
  }
}

async function handleStudentNumberNext() {
  const studentName = studentNameInput.value.trim();
  const studentNumber = studentNumberInput.value.trim();

  studentNameError.classList.add("hidden");
  studentNumberError.classList.add("hidden");

  if (!studentName) {
    studentNameError.classList.remove("hidden");
    studentNameInput.focus();
    return;
  }

  if (!isValidStudentNumber(studentNumber)) {
    studentNumberError.classList.remove("hidden");
    studentNumberInput.focus();
    return;
  }

  const visitor = {
    name: studentName,
    idNumber: studentNumber,
    email: "",
    role: "Student",
    loginMethod: "Student Number"
  };

  if (await isUserBlocked(visitor)) {
    showBlockedMessage("This user is blocked and cannot check in.");
    return;
  }

  clearAdminSession();
  saveCurrentVisitor(visitor);
  closeStudentNumberModalFunc();
  openCollegeDepartmentModalFunc();
}

async function handleGoogleEmailNext() {
  const email = googleEmailInput.value.trim();

  googleEmailError.classList.add("hidden");

  if (!isValidEmail(email)) {
    googleEmailError.classList.remove("hidden");
    googleEmailInput.focus();
    return;
  }

  const visitor = {
    name: getNameFromEmail(email),
    idNumber: "-",
    email,
    role: "Student",
    loginMethod: "Google Email"
  };

  if (await isUserBlocked(visitor)) {
    showBlockedMessage("This user is blocked and cannot check in.");
    return;
  }

  clearAdminSession();
  saveCurrentVisitor(visitor);
  closeGoogleEmailModalFunc();
  openCollegeDepartmentModalFunc();
}

if (helpBtn) helpBtn.addEventListener("click", openHelpModalFunc);
if (closeHelpModal) closeHelpModal.addEventListener("click", closeHelpModalFunc);
if (closeHelpModalFooter) closeHelpModalFooter.addEventListener("click", closeHelpModalFunc);

if (adminLoginBtn) adminLoginBtn.addEventListener("click", openAdminModal);
if (closeAdminModal) closeAdminModal.addEventListener("click", closeAdminModalFunc);
if (cancelAdminModal) cancelAdminModal.addEventListener("click", closeAdminModalFunc);
if (submitAdminLogin) submitAdminLogin.addEventListener("click", handleAdminLogin);

if (adminGoogleQuickLogin) {
  adminGoogleQuickLogin.addEventListener("click", function () {
    handleAdminGoogleOAuth();
  });
}

if (adminPassword) {
  adminPassword.addEventListener("keydown", function (e) {
    if (e.key === "Enter") handleAdminLogin();
  });
}

if (adminIdentifier) {
  adminIdentifier.addEventListener("keydown", function (e) {
    if (e.key === "Enter") handleAdminLogin();
  });
}

if (togglePassword) {
  togglePassword.addEventListener("click", function () {
    const isPassword = adminPassword.type === "password";
    adminPassword.type = isPassword ? "text" : "password";
    togglePasswordIcon.textContent = isPassword ? "visibility_off" : "visibility";
  });
}

if (scanNowBtn) scanNowBtn.addEventListener("click", openScanModalFunc);
if (closeScanModal) closeScanModal.addEventListener("click", closeScanModalFunc);
if (cancelScanModal) cancelScanModal.addEventListener("click", closeScanModalFunc);

if (doneScanModal) {
  doneScanModal.addEventListener("click", async function () {
    const visitor = {
      name: "Student User",
      idNumber: "Scanned ID",
      email: "",
      role: "Student",
      loginMethod: "ID Scan"
    };

    if (await isUserBlocked(visitor)) {
      closeScanModalFunc();
      showBlockedMessage("This user is blocked and cannot check in.");
      return;
    }

    clearAdminSession();
    saveCurrentVisitor(visitor);
    closeScanModalFunc();
    openCollegeDepartmentModalFunc();
  });
}

if (studentNumberBtn) {
  studentNumberBtn.addEventListener("click", function () {
    openStudentNumberModalFunc();
  });
}

if (closeStudentNumberModal) closeStudentNumberModal.addEventListener("click", closeStudentNumberModalFunc);
if (cancelStudentNumberModal) cancelStudentNumberModal.addEventListener("click", closeStudentNumberModalFunc);
if (nextStudentNumberModal) nextStudentNumberModal.addEventListener("click", handleStudentNumberNext);

if (studentNameInput) {
  studentNameInput.addEventListener("input", function () {
    studentNameError.classList.add("hidden");
  });

  studentNameInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      studentNumberInput.focus();
    }
  });
}

if (studentNumberInput) {
  studentNumberInput.addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "").slice(0, 10);
    studentNumberError.classList.add("hidden");
  });

  studentNumberInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleStudentNumberNext();
    }
  });
}

if (googleSignInBtn) {
  googleSignInBtn.addEventListener("click", function () {
    handleGoogleSignIn();
  });
}

if (closeGoogleEmailModal) {
  closeGoogleEmailModal.addEventListener("click", closeGoogleEmailModalFunc);
}
if (cancelGoogleEmailModal) {
  cancelGoogleEmailModal.addEventListener("click", closeGoogleEmailModalFunc);
}
if (nextGoogleEmailModal) {
  nextGoogleEmailModal.addEventListener("click", handleGoogleEmailNext);
}

if (googleEmailInput) {
  googleEmailInput.addEventListener("input", function () {
    googleEmailError.classList.add("hidden");
  });

  googleEmailInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleGoogleEmailNext();
    }
  });
}

if (closeCollegeDepartmentModal) {
  closeCollegeDepartmentModal.addEventListener("click", closeCollegeDepartmentModalFunc);
}
if (cancelCollegeDepartmentModal) {
  cancelCollegeDepartmentModal.addEventListener("click", closeCollegeDepartmentModalFunc);
}

if (collegeDepartmentSelect) {
  collegeDepartmentSelect.addEventListener("change", function () {
    collegeDepartmentError.classList.add("hidden");
    setNextCollegeButtonState(!!this.value);
  });
}

if (nextCollegeDepartmentModal) {
  nextCollegeDepartmentModal.addEventListener("click", async function () {
    if (!collegeDepartmentSelect.value) {
      collegeDepartmentError.classList.remove("hidden");
      return;
    }

    const currentVisitor = getCurrentVisitor();

    if (await isUserBlocked(currentVisitor)) {
      closeCollegeDepartmentModalFunc();
      clearCurrentVisitor();
      showBlockedMessage("This user is blocked and cannot continue.");
      window.location.href = "index.html";
      return;
    }

    currentVisitor.college = collegeDepartmentSelect.value;
    saveCurrentVisitor(currentVisitor);
    localStorage.setItem("selectedCollegeDepartment", collegeDepartmentSelect.value);

    window.location.href = "purpose.html";
  });
}

[
  helpModal,
  adminModal,
  scanModal,
  studentNumberModal,
  googleEmailModal,
  collegeDepartmentModal
].forEach((modal) => {
  if (!modal) return;

  modal.addEventListener("click", function (e) {
    const content = modal.firstElementChild;
    if (content && !content.contains(e.target)) {
      closeModal(modal);
    }
  });
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
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
