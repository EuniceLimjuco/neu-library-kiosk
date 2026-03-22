import {
  getVisitorLogs,
  getBlockedUsers,
  logoutAdminSession,
  saveAdminActivityLog
} from "./db.js";

const logoutBtn = document.getElementById("logoutBtn");
const searchInput = document.getElementById("searchInput");
const collegeFilter = document.getElementById("collegeFilter");
const roleFilter = document.getElementById("roleFilter");
const purposeFilter = document.getElementById("purposeFilter");
const statusFilter = document.getElementById("statusFilter");
const dateFilter = document.getElementById("dateFilter");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const activityTableBody = document.getElementById("activityTableBody");
const resultsText = document.getElementById("resultsText");

const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageIndicator = document.getElementById("pageIndicator");

const blockedUsersCount = document.getElementById("blockedUsersCount");
const totalVisitors = document.getElementById("totalVisitors");
const checkedInCount = document.getElementById("checkedInCount");
const topPurpose = document.getElementById("topPurpose");

const peakDayInsight = document.getElementById("peakDayInsight");
const busyTimeInsight = document.getElementById("busyTimeInsight");
const topCollegeInsight = document.getElementById("topCollegeInsight");
const attentionInsight = document.getElementById("attentionInsight");

const ADMIN_SESSION_KEY = "currentAdminSession";
const ITEMS_PER_PAGE = 10;
const AUTO_REFRESH_INTERVAL = 4000;

let currentPage = 1;
let filteredLogsCache = [];
let visitorLogsCache = [];
let blockedUsersCache = [];
let autoRefreshTimer = null;
let isRefreshing = false;

function loadAdminProfile() {
  const profileName = document.querySelector(".profile-name");
  const profileRole = document.querySelector(".profile-role");

  try {
    const session = JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY));
    if (!session) return;

    if (profileName && session.name) {
      profileName.textContent = session.name;
    }

    if (profileRole && session.role) {
      profileRole.textContent = session.role;
    }
  } catch (error) {
    console.error(error);
  }
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

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDateTime(dateString) {
  if (!dateString) {
    return { time: "N/A", date: "N/A" };
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return { time: "N/A", date: "N/A" };
  }

  return {
    time: date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    }),
    date: date.toISOString().split("T")[0]
  };
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

function getBadgeClass(index) {
  const badgeClasses = ["badge-blue", "badge-yellow", "badge-pink", "badge-purple"];
  return badgeClasses[index % badgeClasses.length];
}

function sortLogsNewestFirst(logs) {
  return [...logs].sort((a, b) => {
    const dateA = new Date(a.checkInTime || 0).getTime();
    const dateB = new Date(b.checkInTime || 0).getTime();
    return dateB - dateA;
  });
}

function isToday(dateString) {
  if (!dateString) return false;

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function updateBlockedUsersCount() {
  if (blockedUsersCount) {
    blockedUsersCount.textContent = blockedUsersCache.length;
  }
}

function updateDashboardStats() {
  const todayLogs = visitorLogsCache.filter((log) => isToday(log.checkInTime));

  if (totalVisitors) {
    totalVisitors.textContent = todayLogs.length;
  }

  if (checkedInCount) {
    checkedInCount.textContent = todayLogs.filter(
      (log) => (log.status || "").toLowerCase() === "checked in"
    ).length;
  }

  if (topPurpose) {
    const counts = {};
    todayLogs.forEach((log) => {
      const purpose = (log.purpose || "").trim();
      if (purpose) counts[purpose] = (counts[purpose] || 0) + 1;
    });

    let top = "N/A";
    let max = 0;

    Object.keys(counts).forEach((key) => {
      if (counts[key] > max) {
        max = counts[key];
        top = key;
      }
    });

    topPurpose.textContent = top;
  }
}

function updateWeeklyChart() {
  const bars = {
    1: document.getElementById("barMon"),
    2: document.getElementById("barTue"),
    3: document.getElementById("barWed"),
    4: document.getElementById("barThu"),
    5: document.getElementById("barFri"),
    6: document.getElementById("barSat"),
    0: document.getElementById("barSun")
  };

  const counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

  visitorLogsCache.forEach((log) => {
    const date = new Date(log.checkInTime);
    if (!Number.isNaN(date.getTime())) {
      counts[date.getDay()]++;
    }
  });

  const maxCount = Math.max(...Object.values(counts), 1);

  Object.keys(bars).forEach((dayIndex) => {
    const bar = bars[dayIndex];
    if (!bar) return;

    const count = counts[dayIndex];
    const percent = count === 0 ? 10 : Math.max((count / maxCount) * 100, 10);

    bar.style.height = `${percent}%`;
    bar.title = `${count} visitor(s)`;
  });
}

function getMostCommonValue(logs, key) {
  const counts = {};
  let topValue = "";
  let topCount = 0;

  logs.forEach((log) => {
    const value = (log[key] || "").trim();
    if (!value) return;
    counts[value] = (counts[value] || 0) + 1;

    if (counts[value] > topCount) {
      topCount = counts[value];
      topValue = value;
    }
  });

  return topValue;
}

function updateInsights() {
  if (!visitorLogsCache.length) {
    if (peakDayInsight) peakDayInsight.textContent = "No visitor data yet.";
    if (busyTimeInsight) busyTimeInsight.textContent = "No visitor data yet.";
    if (topCollegeInsight) topCollegeInsight.textContent = "No visitor data yet.";
    if (attentionInsight) attentionInsight.textContent = "No current alerts.";
    return;
  }

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  const hourCounts = {};

  visitorLogsCache.forEach((log) => {
    const date = new Date(log.checkInTime);
    if (!Number.isNaN(date.getTime())) {
      dayCounts[date.getDay()]++;
      const hour = date.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }
  });

  const highestDayCount = Math.max(...dayCounts);
  const peakDayIndex = dayCounts.indexOf(highestDayCount);
  const peakDay = dayNames[peakDayIndex];

  let busiestHour = null;
  let busiestHourCount = 0;

  Object.keys(hourCounts).forEach((hour) => {
    if (hourCounts[hour] > busiestHourCount) {
      busiestHourCount = hourCounts[hour];
      busiestHour = Number(hour);
    }
  });

  const topCollege = getMostCommonValue(visitorLogsCache, "college");
  const blockedCount = blockedUsersCache.length;

  if (peakDayInsight) {
    peakDayInsight.textContent = `${peakDay} currently has the highest activity.`;
  }

  if (busyTimeInsight) {
    if (busiestHour === null) {
      busyTimeInsight.textContent = "No visitor data yet.";
    } else {
      const startHour = new Date();
      startHour.setHours(busiestHour, 0, 0, 0);

      const endHour = new Date();
      endHour.setHours(busiestHour + 1, 0, 0, 0);

      busyTimeInsight.textContent = `Most visits happen between ${startHour.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
      })} and ${endHour.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
      })}.`;
    }
  }

  if (topCollegeInsight) {
    topCollegeInsight.textContent = topCollege
      ? `${topCollege} has the highest number of visits.`
      : "No college data yet.";
  }

  if (attentionInsight) {
    attentionInsight.textContent =
      blockedCount > 0
        ? `${blockedCount} blocked user(s) are still listed in the system.`
        : "No blocked users at the moment.";
  }
}

function getFilteredLogs() {
  const logs = sortLogsNewestFirst(visitorLogsCache);

  const searchValue = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const collegeValue = collegeFilter ? collegeFilter.value.trim().toLowerCase() : "";
  const roleValue = roleFilter ? roleFilter.value.trim().toLowerCase() : "";
  const purposeValue = purposeFilter ? purposeFilter.value.trim().toLowerCase() : "";
  const statusValue = statusFilter ? statusFilter.value.trim().toLowerCase() : "";
  const dateValue = dateFilter ? dateFilter.value : "";

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

    return (
      matchesSearch &&
      matchesCollege &&
      matchesRole &&
      matchesPurpose &&
      matchesStatus &&
      matchesDate
    );
  });
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
        <td colspan="7" style="text-align:center; padding: 24px; color: #64748b;">
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

        return `
          <tr>
            <td>
              <div class="table-user">
                <div class="user-badge ${getBadgeClass(start + index)}">${escapeHtml(getInitials(name))}</div>
                <div>
                  <p class="user-name">${escapeHtml(name)}</p>
                  <p class="user-email">${escapeHtml(email)}</p>
                </div>
              </div>
            </td>
            <td class="body-text-muted">${escapeHtml(idNumber)}</td>
            <td><span class="mini-tag tag-neutral">${escapeHtml(college)}</span></td>
            <td><span class="mini-tag ${getRoleClass(role)}">${escapeHtml(role)}</span></td>
            <td class="body-text">${escapeHtml(purpose)}</td>
            <td class="time-main">
              ${escapeHtml(formatted.time)}<br />
              <span class="time-sub">${escapeHtml(formatted.date)}</span>
            </td>
            <td>
              <span class="status-pill ${getStatusClass(status)}">
                <span class="status-dot ${getStatusDotClass(status)}"></span>
                ${escapeHtml(status)}
              </span>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  if (resultsText) {
    resultsText.textContent = `Showing ${
      totalCount === 0 ? 0 : start + 1
    }-${Math.min(start + ITEMS_PER_PAGE, totalCount)} of ${totalCount} logs • Page ${currentPage} of ${totalPages}`;
  }

  if (pageIndicator) pageIndicator.textContent = String(currentPage);
  if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
  if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages;
}

async function markCurrentAdminSessionLoggedOut() {
  try {
    const session = JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY));
    if (!session || !session.logId) return;

    await logoutAdminSession(session.logId);

    await saveAdminActivityLog({
      adminEmail: session.email || "",
      adminName: session.name || "",
      action: "Admin Logout",
      targetLogId: session.logId,
      targetName: session.name || "",
      details: "Admin logged out from the portal."
    });

    localStorage.removeItem(ADMIN_SESSION_KEY);
  } catch (error) {
    console.error(error);
    localStorage.removeItem(ADMIN_SESSION_KEY);
  }
}

function clearAllFilters() {
  if (searchInput) searchInput.value = "";
  if (collegeFilter) collegeFilter.value = "";
  if (roleFilter) roleFilter.value = "";
  if (purposeFilter) purposeFilter.value = "";
  if (statusFilter) statusFilter.value = "";
  if (dateFilter) dateFilter.value = "";
  currentPage = 1;
  renderTable();
}

function hasDataChanged(newLogs = [], newBlockedUsers = []) {
  return JSON.stringify(newLogs) !== JSON.stringify(visitorLogsCache) ||
         JSON.stringify(newBlockedUsers) !== JSON.stringify(blockedUsersCache);
}

async function refreshDashboardData(forceRender = false) {
  if (isRefreshing) return;

  isRefreshing = true;

  try {
    const [newVisitorLogs, newBlockedUsers] = await Promise.all([
      getVisitorLogs(),
      getBlockedUsers()
    ]);

    const changed = hasDataChanged(newVisitorLogs, newBlockedUsers);

    if (changed || forceRender) {
      visitorLogsCache = Array.isArray(newVisitorLogs) ? newVisitorLogs : [];
      blockedUsersCache = Array.isArray(newBlockedUsers) ? newBlockedUsers : [];

      updateBlockedUsersCount();
      updateDashboardStats();
      updateWeeklyChart();
      updateInsights();
      renderTable();
    }
  } catch (error) {
    console.error("Auto-refresh failed:", error);
  } finally {
    isRefreshing = false;
  }
}

function startAutoRefresh() {
  stopAutoRefresh();
  autoRefreshTimer = setInterval(() => {
    if (!document.hidden) {
      refreshDashboardData();
    }
  }, AUTO_REFRESH_INTERVAL);
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

async function initializeDashboard() {
  loadAdminProfile();
  await refreshDashboardData(true);
  startAutoRefresh();
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async function () {
    stopAutoRefresh();
    await markCurrentAdminSessionLoggedOut();
    window.location.href = "index.html";
  });
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

if (purposeFilter) {
  purposeFilter.addEventListener("change", () => {
    currentPage = 1;
    renderTable();
  });
}

if (statusFilter) {
  statusFilter.addEventListener("change", () => {
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
    const totalPages = Math.max(1, Math.ceil(filteredLogsCache.length / ITEMS_PER_PAGE));
    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
    }
  });
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopAutoRefresh();
  } else {
    refreshDashboardData(true);
    startAutoRefresh();
  }
});

window.addEventListener("beforeunload", stopAutoRefresh);

initializeDashboard();
