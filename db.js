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

export function makeBlockKey({ email = "", idNumber = "", name = "" }) {
  const normalizedEmail = normalizeText(email);
  const normalizedId = normalizeMeaningfulId(idNumber);
  const normalizedName = normalizeText(name);

  if (normalizedEmail) return `email:${normalizedEmail}`;
  if (normalizedId) return `id:${normalizedId}`;
  if (normalizedName) return `name:${normalizedName}`;
  return "";
}

function mapVisitorRow(row = {}) {
  return {
    id: row.id,
    logId: row.log_id || "",
    name: row.name || "",
    email: row.email || "",
    idNumber: row.id_number || "-",
    college: row.college_department || "-",
    role: row.role || "",
    purpose: row.purpose || "",
    status: row.status || "Checked In",
    checkInTime: row.check_in_time || null,
    checkOutTime: row.check_out_time || null
  };
}

function mapBlockedUserRow(row = {}) {
  return {
    id: row.id,
    log_id: row.log_id || "",
    user_name: row.user_name || "",
    user_email: row.user_email || "",
    id_number: row.id_number || "-",
    college_department: row.college_department || "-",
    role: row.role || "",
    purpose: row.purpose || "",
    status: row.status || "",
    reason: row.reason || "",
    blocked_by: row.blocked_by || "",
    blocked_at: row.blocked_at || null,
    block_key: row.block_key || ""
  };
}

/* =========================================
   AUTO CHECKOUT FOR STUDENTS AFTER 1 HOUR
========================================= */
export async function autoCheckoutExpiredStudents() {
  const { data, error } = await supabase
    .from("visitor_logs")
    .select("id, log_id, role, status, check_in_time, check_out_time")
    .eq("status", "Checked In");

  if (error) {
    console.error("Failed to fetch checked-in student logs:", error);
    return;
  }

  const now = Date.now();
  const oneHourMs = 60 * 60 * 1000;

  const expiredStudents = (data || []).filter((row) => {
    const role = String(row.role || "").trim().toLowerCase();
    const status = String(row.status || "").trim().toLowerCase();
    const checkInTime = row.check_in_time ? new Date(row.check_in_time).getTime() : NaN;

    if (status !== "checked in") return false;
    if (!role.includes("student")) return false;
    if (Number.isNaN(checkInTime)) return false;

    return now - checkInTime >= oneHourMs;
  });

  if (!expiredStudents.length) return;

  for (const student of expiredStudents) {
    const { error: updateError } = await supabase
      .from("visitor_logs")
      .update({
        status: "Checked Out",
        check_out_time: new Date().toISOString()
      })
      .eq("id", student.id);

    if (updateError) {
      console.error(`Failed to auto-checkout student ${student.log_id}:`, updateError);
    }
  }
}

/* =========================================
   VISITOR LOGS
========================================= */
export async function saveVisitorLog({
  logId = createLogId(),
  name = "",
  email = "",
  idNumber = "-",
  collegeDepartment = "-",
  role = "",
  purpose = "",
  status = "Checked In",
  checkInTime = new Date().toISOString(),
  checkOutTime = null
}) {
  const payload = {
    log_id: logId,
    name: name || "",
    email: email || "",
    id_number: idNumber && idNumber !== "" ? idNumber : "-",
    college_department: collegeDepartment || "-",
    role: role || "",
    purpose: purpose || "",
    status: status || "Checked In",
    check_in_time: checkInTime || new Date().toISOString(),
    check_out_time: checkOutTime
  };

  const { data, error } = await supabase
    .from("visitor_logs")
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error("Failed to save visitor log:", error);
    throw error;
  }

  return mapVisitorRow(data);
}

export async function getVisitorLogs() {
  await autoCheckoutExpiredStudents();

  const { data, error } = await supabase
    .from("visitor_logs")
    .select("*")
    .order("check_in_time", { ascending: false });

  if (error) {
    console.error("Failed to fetch visitor logs:", error);
    return [];
  }

  return (data || []).map(mapVisitorRow);
}

export async function updateVisitorStatus(logId, status = "Checked Out") {
  if (!logId) return null;

  const updatePayload = {
    status,
    check_out_time: status === "Checked Out" ? new Date().toISOString() : null
  };

  const { data, error } = await supabase
    .from("visitor_logs")
    .update(updatePayload)
    .eq("log_id", logId)
    .select()
    .single();

  if (error) {
    console.error("Failed to update visitor status:", error);
    throw error;
  }

  return mapVisitorRow(data);
}

/* =========================================
   ADMIN SESSION
========================================= */
export async function saveAdminSession({
  logId = createLogId(),
  name = "",
  email = "",
  idNumber = "-",
  collegeDepartment = "Admin",
  role = "Admin",
  purpose = "Admin Access",
  status = "Checked In",
  checkInTime = new Date().toISOString()
}) {
  return await saveVisitorLog({
    logId,
    name,
    email,
    idNumber,
    collegeDepartment,
    role,
    purpose,
    status,
    checkInTime,
    checkOutTime: null
  });
}

export async function logoutAdminSession(logId) {
  if (!logId) return null;

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("visitor_logs")
    .update({
      status: "Checked Out",
      check_out_time: now
    })
    .eq("log_id", logId)
    .select()
    .single();

  if (error) {
    console.error("Failed to log out admin session:", error);
    throw error;
  }

  return mapVisitorRow(data);
}

/* =========================================
   BLOCKED USERS
========================================= */
export async function getBlockedUsers() {
  const { data, error } = await supabase
    .from("blocked_users")
    .select("*")
    .order("blocked_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch blocked users:", error);
    return [];
  }

  return (data || []).map(mapBlockedUserRow);
}

export async function isUserBlocked({ email = "", idNumber = "", name = "" }) {
  const blockKey = makeBlockKey({ email, idNumber, name });

  if (!blockKey) return false;

  const { data, error } = await supabase
    .from("blocked_users")
    .select("id, block_key, user_email, id_number, user_name")
    .eq("block_key", blockKey)
    .limit(1);

  if (error) {
    console.error("Failed to check blocked user:", error);
    return false;
  }

  return Array.isArray(data) && data.length > 0;
}

export async function blockUser({
  logId = "",
  userName = "",
  userEmail = "",
  idNumber = "-",
  collegeDepartment = "-",
  role = "",
  purpose = "",
  status = "Checked In",
  reason = "",
  blockedBy = ""
}) {
  const blockKey = makeBlockKey({
    email: userEmail,
    idNumber,
    name: userName
  });

  const payload = {
    log_id: logId || "",
    user_name: userName || "",
    user_email: userEmail || "",
    id_number: idNumber && idNumber !== "" ? idNumber : "-",
    college_department: collegeDepartment || "-",
    role: role || "",
    purpose: purpose || "",
    status: status || "Checked In",
    reason: reason || "",
    blocked_by: blockedBy || "",
    blocked_at: new Date().toISOString(),
    block_key: blockKey
  };

  const { data, error } = await supabase
    .from("blocked_users")
    .upsert([payload], {
      onConflict: "block_key"
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to block user:", error);
    throw error;
  }

  return mapBlockedUserRow(data);
}

export async function unblockUser({ logId = "", email = "", idNumber = "", name = "" }) {
  let deleteQuery = supabase.from("blocked_users").delete();

  if (logId) {
    deleteQuery = deleteQuery.eq("log_id", logId);
  } else {
    const blockKey = makeBlockKey({ email, idNumber, name });

    if (!blockKey) {
      throw new Error("No valid identifier provided for unblocking.");
    }

    deleteQuery = deleteQuery.eq("block_key", blockKey);
  }

  const { error } = await deleteQuery;

  if (error) {
    console.error("Failed to unblock user:", error);
    throw error;
  }

  return true;
}

/* =========================================
   ADMIN ACTIVITY LOGS
========================================= */
export async function saveAdminActivityLog({
  adminEmail = "",
  adminName = "",
  action = "",
  targetLogId = "",
  targetName = "",
  details = ""
}) {
  const payload = {
    admin_email: adminEmail || "",
    admin_name: adminName || "",
    action: action || "",
    target_log_id: targetLogId || "",
    target_name: targetName || "",
    details: details || "",
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("admin_activity_logs")
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error("Failed to save admin activity log:", error);
    return null;
  }

  return data;
}

export async function getAdminActivityLogs() {
  const { data, error } = await supabase
    .from("admin_activity_logs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch admin activity logs:", error);
    return [];
  }

  return data || [];
}
