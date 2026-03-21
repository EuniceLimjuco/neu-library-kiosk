import {
  getBlockedUsers,
  unblockUser,
  saveAdminActivityLog,
  logoutAdminSession
} from "./db.js";

const logoutBtn = document.getElementById("logoutBtn");
const searchInput = document.getElementById("searchInput");
const collegeFilter = document.getElementById("collegeFilter");
const roleFilter = document.getElementById("roleFilter");
const dateFilter = document.getElementById("dateFilter");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const blockTableBody = document.getElementById("blockTableBody");
const resultsText = document.getElementById("resultsText");

const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageIndicator = document.getElementById("pageIndicator");

const ADMIN_SESSION_KEY = "currentAdminSession";
const ITEMS_PER_PAGE = 10;

let currentPage = 1;
let filteredBlockedUsersCache = [];
let blockedUsersCache = [];

function getAdminSession() {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY)) || {};
  } catch (error) {
    return {};
  }
}

function getStoredSessionLogId() {
  const session = getAdminSession();

  return (
    session.sessionLogId ||
    session.logId ||
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
  if (!name) return "NA";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getBadgeClass(index) {
  const badgeClasses = ["badge-blue", "badge-yellow", "badge-pink", "badge-purple"];
  return badgeClasses[index % badgeClasses.length];
}

function getRoleTagClass(role = "") {
  const value = role.toLowerCase();
  if (value.includes("student")) return "tag-student";
  if (value.includes("faculty")) return "tag-faculty";
  if (value.includes("employee")) return "tag-employee";
  return "tag-neutral";
}

function formatBlockedDate(dateString) {
  if (!dateString) return { time: "-", date: "-" };

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return { time: "-", date: "-" };

  return {
    time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    date: date.toISOString().split("T")[0]
  };
}

function sortNewestFirst(users) {
  return [...users].sort((a, b) => {
    const dateA = new Date(a.blocked_at || 0).getTime();
    const dateB = new Date(b.blocked_at || 0).getTime();
    return dateB - dateA;
  });
}

function getFilteredBlockedUsers() {
  const blockedUsers = sortNewestFirst(blockedUsersCache);

  const searchValue = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const collegeValue = collegeFilter ? collegeFilter.value.trim().toLowerCase() : "";
  const roleValue = roleFilter ? roleFilter.value.trim().toLowerCase() : "";
  const dateValue = dateFilter ? dateFilter.value : "";

  return blockedUsers.filter((user) => {
    const name = (user.user_name || "").toLowerCase();
    const email = (user.user_email || "").toLowerCase();
    const idNumber = (user.id_number || "").toLowerCase();
    const college = (user.college_department || "").toLowerCase();
    const role = (user.role || "").toLowerCase();
    const blockReason = (user.block_reason || "").toLowerCase();

    const matchesSearch =
      !searchValue ||
      name.includes(searchValue) ||
      email.includes(searchValue) ||
      idNumber.includes(searchValue) ||
      blockReason.includes(searchValue);

    const matchesCollege = !collegeValue || college.includes(collegeValue);
    const matchesRole = !roleValue || role.includes(roleValue);

    let matchesDate = true;
    if (dateValue && user.blocked_at) {
      const parsedDate = new Date(user.blocked_at);
      if (!Number.isNaN(parsedDate.getTime())) {
        matchesDate = parsedDate.toISOString().split("T")[0] === dateValue;
      }
    }

    return matchesSearch && matchesCollege && matchesRole && matchesDate;
  });
}

function renderTable() {
  if (!blockTableBody) return;

  filteredBlockedUsersCache = getFilteredBlockedUsers();

  const totalCount = filteredBlockedUsersCache.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = filteredBlockedUsersCache.slice(start, start + ITEMS_PER_PAGE);

  blockTableBody.innerHTML = "";

  if (!pageItems.length) {
    blockTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">No blocked users found.</td>
      </tr>
    `;
  } else {
    pageItems.forEach((user, index) => {
      const initials = getInitials(user.user_name);
      const badgeClass = getBadgeClass(start + index);
      const roleTagClass = getRoleTagClass(user.role);
      const blockedDate = formatBlockedDate(user.blocked_at);

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>
          <div class="table-user">
            <div class="user-badge ${badgeClass}">${escapeHtml(initials)}</div>
            <div class="user-meta">
              <p class="user-name" title="${escapeHtml(user.user_name || "-")}">${escapeHtml(user.user_name || "-")}</p>
              <p class="user-email" title="${escapeHtml(user.user_email || "-")}">${escapeHtml(user.user_email || "-")}</p>
            </div>
          </div>
        </td>
        <td class="body-text-muted">${escapeHtml(user.id_number || "-")}</td>
        <td>
          <span class="mini-tag tag-neutral">${escapeHtml(user.college_department || "-")}</span>
        </td>
        <td>
          <span class="mini-tag ${roleTagClass}">${escapeHtml(user.role || "-")}</span>
        </td>
        <td>
          <span class="mini-tag tag-block-reason">${escapeHtml(user.block_reason || "-")}</span>
        </td>
        <td class="time-main" data-datetime="${escapeHtml(user.blocked_at || "")}">
          ${escapeHtml(blockedDate.time)}<br />
          <span class="time-sub">${escapeHtml(blockedDate.date)}</span>
        </td>
        <td class="actions-cell">
          <button class="unblock-btn" data-log-id="${escapeHtml(user.log_id || "")}" data-name="${escapeHtml(user.user_name || "")}">
            <span class="material-symbols-outlined action-icon">check_circle</span>
            Unblock
          </button>
        </td>
      `;

      blockTableBody.appendChild(row);
    });
  }

  attachUnblockEvents();

  resultsText.textContent = `Showing ${totalCount === 0 ? 0 : start + 1}-${Math.min(start + ITEMS_PER_PAGE, totalCount)} of ${totalCount} blocked users • Page ${currentPage} of ${totalPages}`;
  pageIndicator.textContent = String(currentPage);
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage === totalPages;
}

function attachUnblockEvents() {
  document.querySelectorAll(".unblock-btn").forEach((button) => {
    button.addEventListener("click", async function () {
      const logId = this.getAttribute("data-log-id");
      const userName = this.getAttribute("data-name");
      const adminSession = getAdminSession();

      try {
        await unblockUser({ logId });

        await saveAdminActivityLog({
          adminEmail: adminSession.email || "",
          adminName: adminSession.name || "",
          action: "Unblock User",
          targetLogId: logId || "",
          targetName: userName || "",
          details: "User removed from block list."
        });

        alert("User has been removed from the block list.");
        await initializeBlockList();
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
  if (dateFilter) dateFilter.value = "";
  currentPage = 1;
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
  } finally {
    clearStoredAdminSession();
    window.location.href = "index.html";
  }
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", handleAdminLogout);
}

if (clearFiltersBtn) {
  clearFiltersBtn.addEventListener("click", clearAllFilters);
}

if (searchInput) {
  searchInput.addEventListener("input", () => {
    currentPage = 1;
    renderTable();
  });
}

if (collegeFilter) {
  collegeFilter.addEventListener("change", () => {
    currentPage = 1;
    renderTable();
  });
}

if (roleFilter) {
  roleFilter.addEventListener("change", () => {
    currentPage = 1;
    renderTable();
  });
}

if (dateFilter) {
  dateFilter.addEventListener("change", () => {
    currentPage = 1;
    renderTable();
  });
}

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
    const totalPages = Math.max(1, Math.ceil(filteredBlockedUsersCache.length / ITEMS_PER_PAGE));
    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
    }
  });
}

async function initializeBlockList() {
  loadAdminProfile();
  blockedUsersCache = await getBlockedUsers();
  renderTable();
}

initializeBlockList();