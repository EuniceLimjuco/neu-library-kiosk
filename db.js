import { supabase } from "./supabase.js";

export function createLogId() {
  return `log_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeText(value = "") {
  return String(value).trim().toLowerCase();
}

export function normalizeMeaningfulId(value = "") {
  const cleaned = String(value).trim();
  return cleaned && cleaned !== "-" ? cleaned.toLowerCase() : "";
}

export function makeBlockKey({ email = "", idNumber = "", name = "", role = "" }) {
  const normalizedEmail = normalizeText(email);
  const normalizedId = normalizeMeaningfulId(idNumber);
  const normalizedName = normalizeText(name);
  const normalizedRole = normalizeText(role) || "unknown";

  if (normalizedEmail) return `role:${normalizedRole}|email:${normalizedEmail}`;
  if (normalizedId) return `role:${normalizedRole}|id:${normalizedId}`;
  if (normalizedName) return `role:${normalizedRole}|name:${normalizedName}`;
  return "";
}

export async function getVisitorLogs() {
  const { data, error } = await supabase
    .from("visitor_logs")
    .select("*")
    .order("check_in_time", { ascending: false });

  if (error) {
    console.error("Error fetching visitor logs:", error);
    return [];
  }

  return (data || []).map((row) => ({
    logId: row.log_id,
    name: row.name,
    email: row.email,
    idNumber: row.id_number,
    college: row.college,
    role: row.role,
    purpose: row.purpose,
    loginMethod: row.login_method,
    checkInTime: row.check_in_time,
    checkOutTime: row.check_out_time,
    status: row.status
  }));
}

export async function saveVisitorLog(visitorData) {
  const payload = {
    log_id: visitorData.logId || createLogId(),
    name: visitorData.name || "Unknown User",
    email: visitorData.email || "",
    id_number: visitorData.idNumber || "-",
    college: visitorData.college || "-",
    role: visitorData.role || "Student",
    purpose: visitorData.purpose || "-",
    login_method: visitorData.loginMethod || "",
    check_in_time: visitorData.checkInTime || new Date().toISOString(),
    check_out_time: visitorData.checkOutTime || null,
    status: visitorData.status || "Checked In"
  };

  const { data, error } = await supabase
    .from("visitor_logs")
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateVisitorLogStatus(logId, status, checkOutTime = null) {
  const updateData = { status };

  if (checkOutTime) {
    updateData.check_out_time = checkOutTime;
  }

  const { error } = await supabase
    .from("visitor_logs")
    .update(updateData)
    .eq("log_id", logId);

  if (error) throw error;
}

export async function getBlockedUsers() {
  const { data, error } = await supabase
    .from("blocked_users")
    .select("*")
    .order("blocked_at", { ascending: false });

  if (error) {
    console.error("Error fetching blocked users:", error);
    return [];
  }

  return data || [];
}

export async function isUserBlocked(user = {}) {
  const blockKey = makeBlockKey({
    email: user.email,
    idNumber: user.idNumber,
    name: user.name,
    role: user.role
  });

  if (!blockKey) return false;

  const { data, error } = await supabase
    .from("blocked_users")
    .select("id")
    .eq("block_key", blockKey)
    .limit(1);

  if (error) {
    console.error("Error checking blocked user:", error);
    return false;
  }

  return Array.isArray(data) && data.length > 0;
}

export async function saveBlockedUser(user, reason, blockedBy = "") {
  const blockKey = makeBlockKey({
    email: user.userEmail,
    idNumber: user.idNumber,
    name: user.userName,
    role: user.role
  });

  if (!blockKey) {
    throw new Error("Cannot block user without email, meaningful ID number, or name.");
  }

  const { data: existing, error: checkError } = await supabase
    .from("blocked_users")
    .select("id")
    .eq("block_key", blockKey)
    .limit(1);

  if (checkError) throw checkError;

  if (existing && existing.length > 0) {
    return existing[0];
  }

  const { data, error } = await supabase
    .from("blocked_users")
    .insert([
      {
        log_id: user.logId || "",
        block_key: blockKey,
        user_name: user.userName || "",
        user_email: user.userEmail || "",
        id_number: user.idNumber || "-",
        college_department: user.collegeDepartment || "-",
        role: user.role || "-",
        purpose: user.purpose || "-",
        status: user.status || "Checked In",
        block_reason: reason,
        blocked_by: blockedBy
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeBlockedUser(logId) {
  const { error } = await supabase
    .from("blocked_users")
    .delete()
    .eq("log_id", logId);

  if (error) throw error;
}

export async function blockUser({
  logId = "",
  userName = "",
  userEmail = "",
  idNumber = "-",
  collegeDepartment = "-",
  role = "-",
  purpose = "-",
  status = "Checked In",
  reason = "",
  blockedBy = ""
}) {
  return await saveBlockedUser(
    {
      logId,
      userName,
      userEmail,
      idNumber,
      collegeDepartment,
      role,
      purpose,
      status
    },
    reason,
    blockedBy
  );
}

export async function unblockUser(user) {
  const logId = user?.logId || "";
  if (!logId) {
    throw new Error("Missing logId for unblockUser.");
  }

  return await removeBlockedUser(logId);
}

export async function saveAdminSession(adminUser, sessionLogId, loginMethod) {
  const { error } = await supabase
    .from("admin_sessions")
    .insert([
      {
        session_log_id: sessionLogId,
        admin_name: adminUser.name,
        admin_email: adminUser.email,
        admin_role: adminUser.role || "Employee",
        login_method: loginMethod || "Email Password",
        status: "Checked In"
      }
    ]);

  if (error) throw error;
}

export async function logoutAdminSession(sessionLogId) {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("admin_sessions")
    .update({
      logout_time: now,
      status: "Checked Out"
    })
    .eq("session_log_id", sessionLogId);

  if (error) throw error;

  await updateVisitorLogStatus(sessionLogId, "Checked Out", now);
}

export async function saveAdminActivityLog({
  adminEmail,
  adminName,
  action,
  targetLogId = "",
  targetName = "",
  details = ""
}) {
  const { error } = await supabase
    .from("admin_activity_logs")
    .insert([
      {
        admin_email: adminEmail,
        admin_name: adminName,
        action,
        target_log_id: targetLogId,
        target_name: targetName,
        details
      }
    ]);

  if (error) throw error;
}