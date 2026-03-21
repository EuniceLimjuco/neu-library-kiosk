import {
  getVisitorLogs,
  getBlockedUsers,
  blockUser,
  unblockUser,
  saveAdminActivityLog,
  logoutAdminSession
} from "./db.js";

const logoutBtn = document.getElementById("logoutBtn");
const searchInput = document.getElementById("searchInput");
const collegeFilter = document.getElementById("collegeFilter");
const roleFilter = document.getElementById("roleFilter");
const purposeFilter = document.getElementById("purposeFilter");
const statusFilter = document.getElementById("statusFilter");
const dateFilter = document.getElementById("dateFilter");
const timeFilter = document.getElementById("timeFilter");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const activityTableBody = document.getElementById("activityTableBody");
const resultsText = document.getElementById("resultsText");

const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageIndicator = document.getElementById("pageIndicator");

const blockReasonModal = document.getElementById("blockReasonModal");
const closeBlockModalBtn = document.getElementById("closeBlockModalBtn");
const cancelBlockBtn = document.getElementById("cancelBlockBtn");
const confirmBlockBtn = document.getElementById("confirmBlockBtn");
const blockReasonSelect = document.getElementById("blockReasonSelect");
const blockModalUserName = document.getElementById("blockModalUserName");

const ADMIN_SESSION_KEY = "currentAdminSession";
const ITEMS_PER_PAGE = 10;

let currentPage = 1;
let filteredLogsCache = [];
let visitorLogsCache = [];
let blockedUsersCache = [];
let selectedUserToBlock = null;

function getAdminSession() {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY)) || {};
  } catch (error) {
    return {};
  }
}

function getStoredSessionLogId() {
  const adminSession = getAdminSession();

  return (
    adminSession.sessionLogId ||
    adminSession.logId ||
    localStorage.getItem("adminSessionLogId") ||
    sessionStorage.getItem("adminSessionLogId") ||
    localStorage.getItem("sessionLogId") ||
    sessionStorage.getItem("sessionLogId") ||
    ""
  );
}

function clearStoredAdminSession() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
  localStorage.removeItem("adminSessionLogId");
  sessionStorage.removeItem("adminSessionLogId");
  localStorage.removeItem("sessionLogId");
  sessionStorage.removeItem("sessionLogId");
}

function loadAdminProfile() {
  const profileName = document.querySelector(".profile-name");
  const profileRole = document.querySelector(".profile-role");
  const session = getAdminSession();

  if (profileName && session.name) profileName.textContent = session.name;
  if (profileRole && session.role) profileRole.textContent = session.role;
}

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getInitials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "NA"
  );
}

function getBadgeClass(index) {
  const badgeClasses = ["badge-blue", "badge-yellow", "badge-pink", "badge-purple"];
  return badgeClasses[index % badgeClasses.length];
}

function getRoleClass(role = "") {
  const normalized = role.toLowerCase();
  if (normalized.includes("student")) return "tag-student";
  if (normalized.includes("faculty")) return "tag-faculty";
  if (normalized.includes("employee")) return "tag-employee";
  return "tag-neutral";
}

function getStatusClass(status = "") {
  return status.toLowerCase() === "checked out" ? "status-out" : "status-in";
}

function getStatusDotClass(status = "") {
  return status.toLowerCase() === "checked out" ? "dot-out" : "dot-in";
}

function formatDateTime(dateString) {
  if (!dateString) return { time: "N/A", date: "N/A" };

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return { time: "N/A", date: "N/A" };

  return {
    time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    date: date.toISOString().split("T")[0]
  };
}

function sortLogsNewestFirst(logs) {
  return [...logs].sort((a, b) => {
    const dateA = new Date(a.checkInTime || 0).getTime();
    const dateB = new Date(b.checkInTime || 0).getTime();
    return dateB - dateA;
  });
}

function isBlockedLog(log) {
  return blockedUsersCache.some((blockedUser) => {
    return (
      (blockedUser.log_id && blockedUser.log_id === log.logId) ||
      (blockedUser.user_email && log.email && blockedUser.user_email === log.email) ||
      (blockedUser.id_number && log.idNumber && blockedUser.id_number === log.idNumber) ||
      (blockedUser.user_name && log.name && blockedUser.user_name === log.name)
    );
  });
}

function getFilteredLogs() {
  const logs = sortLogsNewestFirst(visitorLogsCache);

  const searchValue = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const collegeValue = collegeFilter ? collegeFilter.value.trim().toLowerCase() : "";
  const roleValue = roleFilter ? roleFilter.value.trim().toLowerCase() : "";
  const purposeValue = purposeFilter ? purposeFilter.value.trim().toLowerCase() : "";
  const statusValue = statusFilter ? statusFilter.value.trim().toLowerCase() : "";
  const dateValue = dateFilter ? dateFilter.value : "";
  const timeValue = timeFilter ? timeFilter.value : "";

  return logs.filter((log) => {
    const name = (log.name || "").toLowerCase();
    const email = (log.email || "").toLowerCase();
    const idNumber = (log.idNumber || "").toLowerCase();
    const college = (log.college || "").toLowerCase();
    const role = (log.role || "").toLowerCase();
    const purpose = (log.purpose || "").toLowerCase();
    const status = (log.status || "").toLowerCase();

    const matchesSearch =
      !searchValue ||
      name.includes(searchValue) ||
      email.includes(searchValue) ||
      idNumber.includes(searchValue);

    const matchesCollege = !collegeValue || college.includes(collegeValue);
    const matchesRole = !roleValue || role.includes(roleValue);
    const matchesPurpose = !purposeValue || purpose.includes(purposeValue);
    const matchesStatus = !statusValue || status.includes(statusValue);

    let matchesDate = true;
    if (dateValue && log.checkInTime) {
      const parsedDate = new Date(log.checkInTime);
      if (!Number.isNaN(parsedDate.getTime())) {
        matchesDate = parsedDate.toISOString().split("T")[0] === dateValue;
      }
    }

    let matchesTime = true;
    if (timeValue && log.checkInTime) {
      const parsedDate = new Date(log.checkInTime);
      if (!Number.isNaN(parsedDate.getTime())) {
        const hours = String(parsedDate.getHours()).padStart(2, "0");
        const minutes = String(parsedDate.getMinutes()).padStart(2, "0");
        matchesTime = `${hours}:${minutes}` === timeValue;
      }
    }

    return (
      matchesSearch &&
      matchesCollege &&
      matchesRole &&
      matchesPurpose &&
      matchesStatus &&
      matchesDate &&
      matchesTime
    );
  });
}

function openBlockReasonModal(userData) {
  selectedUserToBlock = userData;
  if (blockModalUserName) blockModalUserName.textContent = userData.userName || "User";
  if (blockReasonSelect) blockReasonSelect.value = "";
  if (blockReasonModal) blockReasonModal.classList.remove("hidden");
}

function closeBlockReasonModal() {
  selectedUserToBlock = null;
  if (blockReasonSelect) blockReasonSelect.value = "";
  if (blockReasonModal) blockReasonModal.classList.add("hidden");
}

async function confirmBlockUser() {
  if (!selectedUserToBlock) return;

  const selectedReason = blockReasonSelect ? blockReasonSelect.value.trim() : "";
  if (!selectedReason) {
    alert("Please select a reason for blocking this user.");
    return;
  }

  const adminSession = getAdminSession();

  try {
    await blockUser({
      logId: selectedUserToBlock.logId,
      userName: selectedUserToBlock.userName || "",
      userEmail: selectedUserToBlock.userEmail || "",
      idNumber: selectedUserToBlock.idNumber || "-",
      collegeDepartment: selectedUserToBlock.collegeDepartment || "-",
      role: selectedUserToBlock.role || "-",
      purpose: selectedUserToBlock.purpose || "-",
      status: selectedUserToBlock.status || "Checked In",
      reason: selectedReason,
      blockedBy: adminSession.email || ""
    });

    await saveAdminActivityLog({
      adminEmail: adminSession.email || "",
      adminName: adminSession.name || "",
      action: "Block User",
      targetLogId: selectedUserToBlock.logId || "",
      targetName: selectedUserToBlock.userName || "",
      details: selectedReason
    });

    alert(`${selectedUserToBlock.userName || "User"} has been added to the block list.`);
    closeBlockReasonModal();
    await initializeUserManagement();
  } catch (error) {
    console.error(error);
    alert("Failed to block user.");
  }
}

function renderTable() {
  if (!activityTableBody) return;

  filteredLogsCache = getFilteredLogs();

  const totalCount = filteredLogsCache.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = filteredLogsCache.slice(start, start + ITEMS_PER_PAGE);

  if (!pageItems.length) {
    activityTableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding: 24px; color: #64748b;">
          No visitor logs found.
        </td>
      </tr>
    `;
  } else {
    activityTableBody.innerHTML = pageItems
      .map((log, index) => {
        const name = log.name || "Unknown User";
        const email = log.email || "No email";
        const idNumber = log.idNumber || "-";
        const college = log.college || "-";
        const role = log.role || "Visitor";
        const purpose = log.purpose || "-";
        const status = log.status || "Checked In";
        const rawDateTime = log.checkInTime || "";
        const formatted = formatDateTime(rawDateTime);
        const isBlocked = isBlockedLog(log);

        return `
          <tr class="${isBlocked ? "blocked-row" : ""}">
            <td>
              <div class="table-user">
                <div class="user-badge ${getBadgeClass(start + index)}">${escapeHtml(getInitials(name))}</div>
                <div>
                  <p class="user-name" title="${escapeHtml(name)}">${escapeHtml(name)}</p>
                  <p class="user-email" title="${escapeHtml(email)}">${escapeHtml(email)}</p>
                </div>
              </div>
            </td>
            <td class="body-text-muted">${escapeHtml(idNumber)}</td>
            <td><span class="mini-tag tag-neutral">${escapeHtml(college)}</span></td>
            <td><span class="mini-tag ${getRoleClass(role)}">${escapeHtml(role)}</span></td>
            <td class="body-text">${escapeHtml(purpose)}</td>
            <td class="time-main" data-datetime="${escapeHtml(rawDateTime)}">
              ${escapeHtml(formatted.time)}<br />
              <span class="time-sub">${escapeHtml(formatted.date)}</span>
            </td>
            <td>
              <span class="status-pill ${getStatusClass(status)}">
                <span class="status-dot ${getStatusDotClass(status)}"></span>
                ${escapeHtml(status)}
              </span>
            </td>
            <td class="actions-cell">
              <button
                class="${isBlocked ? "unblock-btn" : "block-btn"}"
                data-log-id="${escapeHtml(log.logId || "")}"
                data-name="${escapeHtml(name)}"
                data-email="${escapeHtml(email === "No email" ? "" : email)}"
                data-id="${escapeHtml(idNumber)}"
                data-college="${escapeHtml(college)}"
                data-role="${escapeHtml(role)}"
                data-purpose="${escapeHtml(purpose)}"
                data-checkin="${escapeHtml(rawDateTime)}"
                data-status="${escapeHtml(status)}"
              >
                <span class="material-symbols-outlined block-icon">${isBlocked ? "check_circle" : "block"}</span>
                ${isBlocked ? "Unblock" : "Block"}
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  attachActionEvents();

  resultsText.textContent = `Showing ${totalCount === 0 ? 0 : start + 1}-${Math.min(start + ITEMS_PER_PAGE, totalCount)} of ${totalCount} logs • Page ${currentPage} of ${totalPages}`;
  pageIndicator.textContent = String(currentPage);
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage === totalPages;
}

function attachActionEvents() {
  document.querySelectorAll(".block-btn").forEach((button) => {
    button.addEventListener("click", function () {
      openBlockReasonModal({
        logId: this.dataset.logId || "",
        userName: this.dataset.name || "",
        userEmail: this.dataset.email || "",
        idNumber: this.dataset.id || "-",
        collegeDepartment: this.dataset.college || "-",
        role: this.dataset.role || "-",
        purpose: this.dataset.purpose || "-",
        checkIn: this.dataset.checkin || "",
        status: this.dataset.status || "Checked In"
      });
    });
  });

  document.querySelectorAll(".unblock-btn").forEach((button) => {
    button.addEventListener("click", async function () {
      const adminSession = getAdminSession();

      try {
        await unblockUser({
          logId: this.dataset.logId || ""
        });

        await saveAdminActivityLog({
          adminEmail: adminSession.email || "",
          adminName: adminSession.name || "",
          action: "Unblock User",
          targetLogId: this.dataset.logId || "",
          targetName: this.dataset.name || "",
          details: "User unblocked"
        });

        alert(`${this.dataset.name || "User"} has been unblocked.`);
        await initializeUserManagement();
      } catch (error) {
        console.error(error);
        alert("Failed to unblock user.");
      }
    });
  });
}

function clearAllFilters() {
  if (searchInput) searchInput.value = "";
  if (collegeFilter) collegeFilter.value = "";
  if (roleFilter) roleFilter.value = "";
  if (purposeFilter) purposeFilter.value = "";
  if (statusFilter) statusFilter.value = "";
  if (dateFilter) dateFilter.value = "";
  if (timeFilter) timeFilter.value = "";
  currentPage = 1;
  renderTable();
}

async function initializeUserManagement() {
  loadAdminProfile();
  visitorLogsCache = await getVisitorLogs();
  blockedUsersCache = await getBlockedUsers();
  renderTable();
}

async function handleAdminLogout() {
  try {
    const sessionLogId = getStoredSessionLogId();

    if (sessionLogId) {
      await logoutAdminSession(sessionLogId);
    } else {
      console.warn("No admin session log id found during logout.");
    }
  } catch (error) {
    console.error("Error during logout:", error);
    alert("Logout failed. Please try again.");
    return;
  }

  clearStoredAdminSession();
  window.location.href = "index.html";
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", handleAdminLogout);
}

if (clearFiltersBtn) clearFiltersBtn.addEventListener("click", clearAllFilters);

if (searchInput) searchInput.addEventListener("input", () => { currentPage = 1; renderTable(); });
if (collegeFilter) collegeFilter.addEventListener("change", () => { currentPage = 1; renderTable(); });
if (roleFilter) roleFilter.addEventListener("change", () => { currentPage = 1; renderTable(); });
if (purposeFilter) purposeFilter.addEventListener("change", () => { currentPage = 1; renderTable(); });
if (statusFilter) statusFilter.addEventListener("change", () => { currentPage = 1; renderTable(); });
if (dateFilter) dateFilter.addEventListener("change", () => { currentPage = 1; renderTable(); });
if (timeFilter) timeFilter.addEventListener("change", () => { currentPage = 1; renderTable(); });

if (prevPageBtn) {
  prevPageBtn.addEventListener("click", function () {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  });
}

if (nextPageBtn) {
  nextPageBtn.addEventListener("click", function () {
    const totalPages = Math.max(1, Math.ceil(filteredLogsCache.length / ITEMS_PER_PAGE));
    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
    }
  });
}

if (closeBlockModalBtn) closeBlockModalBtn.addEventListener("click", closeBlockReasonModal);
if (cancelBlockBtn) cancelBlockBtn.addEventListener("click", closeBlockReasonModal);
if (confirmBlockBtn) confirmBlockBtn.addEventListener("click", confirmBlockUser);

initializeUserManagement();