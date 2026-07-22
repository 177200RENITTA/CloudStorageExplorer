/* ==========================================================================
   Cloud Storage Explorer — script.js
   Vanilla JS, no framework. One file, split into small modules by feature.
   Adjust API_BASE and the ENDPOINTS map below to match your backend/main.py
   routes if they differ.
   ========================================================================== */

// UPDATED: Points directly to your FastAPI backend server port to prevent CORS issues
const API_BASE = "http://127.0.0.1:8000"; 

const ENDPOINTS = {
  register: "/auth/register",
  login: "/auth/login",
  me: "/auth/me",
  stats: "/files/stats",
  list: "/files",
  search: "/files/search",
  upload: "/files/upload",
  download: (id) => `/files/${id}/download`,
  remove: (id) => `/files/${id}`,
};

const TOKEN_KEY = "cse_token";

/* ---------------------------------------------------------------------- */
/* Auth helpers                                                           */
/* ---------------------------------------------------------------------- */

const auth = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  },
  isLoggedIn() {
    return Boolean(this.getToken());
  },
  logout() {
    this.clearToken();
    window.location.href = "login.html";
  },
  /** Redirect to login if there's no token. Call at the top of protected pages. */
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = "login.html";
    }
  },
};

/** Fetch wrapper that attaches the JWT and handles 401s uniformly. */
async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = auth.getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (response.status === 401) {
    auth.clearToken();
    window.location.href = "login.html";
    throw new Error("Session expired");
  }

  if (!response.ok) {
    let detail = "Something went wrong. Please try again.";
    try {
      const body = await response.json();
      
      // FIX: Check if the error detail is a standard error string
      if (body && typeof body.detail === "string") {
        detail = body.detail;
      } 
      // FIX: Check if the error detail is a FastAPI validation array (422 Unprocessable Entity)
      else if (body && Array.isArray(body.detail)) {
        detail = body.detail.map(err => {
          const field = err.loc ? err.loc.join('.') : 'field';
          return `${field}: ${err.msg}`;
        }).join(', ');
      }
    } catch (_) {
      /* response had no JSON body */
    }
    throw new Error(detail);
  }

  if (response.status === 204) return null;
  return response.json();
}

/* ---------------------------------------------------------------------- */
/* Toasts                                                                  */
/* ---------------------------------------------------------------------- */

function toast(message, kind = "success") {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }
  const el = document.createElement("div");
  el.className = `toast is-${kind}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* ---------------------------------------------------------------------- */
/* Formatting helpers                                                       */
/* ---------------------------------------------------------------------- */

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function fileKind(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  if (["pdf", "doc", "docx", "txt", "md"].includes(ext)) return "documents";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "images";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archives";
  return "other";
}

function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* ---------------------------------------------------------------------- */
/* Login page                                                               */
/* ---------------------------------------------------------------------- */

function initLoginPage() {
  const form = document.getElementById("login-form");
  if (!form) return;
  const errorBox = document.getElementById("form-error");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.remove("is-visible");

    const email = form.email.value.trim();
    const password = form.password.value;
    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;

    // UPDATED: Pack JSON properties down into URL-encoded form layout metrics
    const formData = new URLSearchParams();
    formData.append("username", email); // Form layout dependency demands key 'username'
    formData.append("password", password);

    try {
      const data = await apiFetch(ENDPOINTS.login, {
        method: "POST",
        headers: { 
          "Content-Type": "application/x-www-form-urlencoded" // MIME update matches form parsing
        },
        body: formData,
      });
      auth.setToken(data.access_token);
      window.location.href = "dashboard.html";
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.add("is-visible");
    } finally {
      submitBtn.disabled = false;
    }
  });
}

/* ---------------------------------------------------------------------- */
/* Register page                                                            */
/* ---------------------------------------------------------------------- */

function initRegisterPage() {
  const form = document.getElementById("register-form");
  if (!form) return;
  const errorBox = document.getElementById("form-error");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.remove("is-visible");

    // UPDATED: Reads only what exists in your simple HTML registration interface.
    // If your backend still expects a distinct 'username' parameter field, 
    // it defaults to safe handling using the provided email structure.
    const email = form.email.value.trim();
    const password = form.password.value;
    const username = form.username ? form.username.value.trim() : email; 

    // Handle password confirmation checking dynamically only if the element exists in HTML
    if (form.confirm_password) {
      const confirm = form.confirm_password.value;
      if (password !== confirm) {
        errorBox.textContent = "Passwords don't match.";
        errorBox.classList.add("is-visible");
        return;
      }
    }

    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;

    try {
      await apiFetch(ENDPOINTS.register, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      toast("Account created. Please log in.");
      window.location.href = "login.html";
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.add("is-visible");
    } finally {
      submitBtn.disabled = false;
    }
  });
}

/* ---------------------------------------------------------------------- */
/* Sidebar (shared across protected pages)                                  */
/* ---------------------------------------------------------------------- */

async function initSidebar() {
  const nameEl = document.getElementById("sidebar-user-name");
  const emailEl = document.getElementById("sidebar-user-email");
  const avatarEl = document.getElementById("sidebar-avatar");
  const logoutBtn = document.getElementById("logout-btn");

  if (logoutBtn) logoutBtn.addEventListener("click", () => auth.logout());
  if (!nameEl) return;

  try {
    const me = await apiFetch(ENDPOINTS.me);
    nameEl.textContent = me.username;
    emailEl.textContent = me.email;
    if (avatarEl && me.username) avatarEl.textContent = me.username.slice(0, 2).toUpperCase();
  } catch (_) {
    /* apiFetch already redirects on 401 */
  }
}

/* ---------------------------------------------------------------------- */
/* Dashboard page                                                           */
/* ---------------------------------------------------------------------- */

async function initDashboardPage() {
  const gauge = document.getElementById("storage-gauge");
  if (!gauge) return;

  try {
    const stats = await apiFetch(ENDPOINTS.stats);
    renderStorageGauge(stats);
    renderDashboardStats(stats);
    renderRecentFiles(stats.recent_files || []);
  } catch (err) {
    toast(err.message, "error");
  }
}

function renderDashboardStats(stats) {
  const totalFilesEl = document.getElementById("stat-total-files");
  const totalStorageEl = document.getElementById("stat-total-storage");
  if (totalFilesEl) totalFilesEl.textContent = stats.total_files ?? 0;
  if (totalStorageEl) totalStorageEl.textContent = formatBytes(stats.total_bytes ?? 0);
}

function renderStorageGauge(stats) {
  const track = document.getElementById("storage-gauge-track");
  const readout = document.getElementById("storage-gauge-readout");
  if (!track) return;

  const quota = stats.quota_bytes || 5 * 1024 * 1024 * 1024; 
  const breakdown = stats.breakdown_bytes || { documents: 0, images: 0, archives: 0, other: 0 };
  const used = Object.values(breakdown).reduce((a, b) => a + b, 0);

  track.innerHTML = "";
  ["documents", "images", "archives", "other"].forEach((kind) => {
    const seg = document.createElement("div");
    seg.className = "storage-gauge__segment";
    seg.dataset.kind = kind;
    const pct = quota > 0 ? (breakdown[kind] / quota) * 100 : 0;
    seg.style.width = `${pct}%`;
    track.appendChild(seg);
  });

  track.classList.toggle("is-near-full", used / quota > 0.85);

  if (readout) {
    readout.innerHTML = `<strong>${formatBytes(used)}</strong> of ${formatBytes(quota)} used`;
  }
}

function renderRecentFiles(files) {
  const list = document.getElementById("recent-files-list");
  if (!list) return;
  list.innerHTML = "";

  if (files.length === 0) {
    list.innerHTML = `<li class="empty-state"><p>No uploads yet — add your first file to see it here.</p></li>`;
    return;
  }

  files.forEach((file) => {
    const li = document.createElement("li");
    li.className = "upload-row";
    li.innerHTML = `
      <div class="upload-row__name">${escapeHtml(file.filename)}</div>
      <div class="upload-row__meta">${formatBytes(file.file_size)} · ${formatDate(file.upload_date)}</div>
    `;
    list.appendChild(li);
  });
}

/* ---------------------------------------------------------------------- */
/* Upload page                                                             */
/* ---------------------------------------------------------------------- */

function initUploadPage() {
  const dropzone = document.getElementById("dropzone");
  if (!dropzone) return;

  const input = document.getElementById("file-input");
  const queue = document.getElementById("upload-queue");

  dropzone.addEventListener("click", () => input.click());

  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add("is-dragover");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove("is-dragover");
    })
  );
  dropzone.addEventListener("drop", (e) => {
    handleFiles(e.dataTransfer.files, queue);
  });
  input.addEventListener("change", () => {
    handleFiles(input.files, queue);
    input.value = "";
  });
}

function handleFiles(fileList, queue) {
  Array.from(fileList).forEach((file) => uploadFile(file, queue));
}

/** Uses XMLHttpRequest instead of fetch so we get real upload progress events. */
function uploadFile(file, queue) {
  const row = document.createElement("div");
  row.className = "upload-row";
  row.innerHTML = `
    <div class="upload-row__name">${escapeHtml(file.name)}</div>
    <div class="upload-row__meta">${formatBytes(file.size)}</div>
    <div class="upload-row__bar"><div class="upload-row__bar-fill"></div></div>
    <div class="upload-row__status">Uploading…</div>
  `;
  queue.prepend(row);

  const fill = row.querySelector(".upload-row__bar-fill");
  const status = row.querySelector(".upload-row__status");

  const formData = new FormData();
  formData.append("file", file);

  const xhr = new XMLHttpRequest();
  xhr.open("POST", `${API_BASE}${ENDPOINTS.upload}`);
  const token = auth.getToken();
  if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

  xhr.upload.addEventListener("progress", (e) => {
    if (!e.lengthComputable) return;
    const pct = Math.round((e.loaded / e.total) * 100);
    fill.style.width = `${pct}%`;
    status.textContent = `${pct}%`;
  });

  xhr.addEventListener("load", () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      fill.style.width = "100%";
      fill.classList.add("is-done");
      status.textContent = "Done";
      toast(`${file.name} uploaded.`);
    } else {
      fill.classList.add("is-error");
      status.textContent = "Failed";
      let message = "Upload failed.";
      try {
        message = JSON.parse(xhr.responseText).detail || message;
      } catch (_) {}
      toast(message, "error");
      if (xhr.status === 401) auth.logout();
    }
  });

  xhr.addEventListener("error", () => {
    fill.classList.add("is-error");
    status.textContent = "Failed";
    toast("Network error during upload.", "error");
  });

  xhr.send(formData);
}

/* ---------------------------------------------------------------------- */
/* Files page                                                              */
/* ---------------------------------------------------------------------- */

function initFilesPage() {
  const tbody = document.getElementById("file-table-body");
  if (!tbody) return;

  const searchInput = document.getElementById("file-search");

  const load = async (query = "") => {
    tbody.innerHTML = `<tr><td colspan="4">Loading…</td></tr>`;
    try {
      const path = query ? `${ENDPOINTS.search}?q=${encodeURIComponent(query)}` : ENDPOINTS.list;
      const files = await apiFetch(path);
      renderFileTable(files, tbody);
    } catch (err) {
      toast(err.message, "error");
    }
  };

  load();

  if (searchInput) {
    searchInput.addEventListener("input", debounce((e) => load(e.target.value.trim()), 300));
  }

  tbody.addEventListener("click", async (e) => {
    const downloadBtn = e.target.closest(".row-actions__download");
    const deleteBtn = e.target.closest(".row-actions__delete");
    if (downloadBtn) {
      await downloadFile(downloadBtn.dataset.id, downloadBtn.dataset.filename);
    } else if (deleteBtn) {
      await deleteFile(deleteBtn.dataset.id, deleteBtn.closest("tr"));
    }
  });
}

function renderFileTable(files, tbody) {
  tbody.innerHTML = "";

  if (!files || files.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="4">
        <div class="empty-state">
          <h3>No files found</h3>
          <p>Try a different search, or upload a new file.</p>
        </div>
      </td></tr>`;
    return;
  }

  files.forEach((file) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="file-name">
          <span class="file-name__icon">${fileKind(file.filename).slice(0, 1).toUpperCase()}</span>
          ${escapeHtml(file.filename)}
        </div>
      </td>
      <td class="col-size">${formatBytes(file.file_size)}</td>
      <td class="col-date">${formatDate(file.upload_date)}</td>
      <td>
        <div class="row-actions">
          <button class="row-actions__download" data-id="${file.id}" data-filename="${escapeHtml(file.filename)}" title="Download">⭳</button>
          <button class="row-actions__delete" data-id="${file.id}" title="Delete">✕</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function downloadFile(id, filename) {
  try {
    const data = await apiFetch(ENDPOINTS.download(id));
    const link = document.createElement("a");
    link.href = data.url;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function deleteFile(id, row) {
  if (!confirm("Delete this file? This can't be undone.")) return;
  try {
    await apiFetch(ENDPOINTS.remove(id), { method: "DELETE" });
    row.remove();
    toast("File deleted.");
  } catch (err) {
    toast(err.message, "error");
  }
}

/* ---------------------------------------------------------------------- */
/* Utility                                                                  */
/* ---------------------------------------------------------------------- */

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------------------------------------------------------------------- */
/* Boot                                                                     */
/* ---------------------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  initLoginPage();
  initRegisterPage();

  const publicPages = ["login.html", "register.html", "index.html", ""];
  const currentPage = window.location.pathname.split("/").pop();
  if (!publicPages.includes(currentPage)) {
    auth.requireAuth();
  }

  initSidebar();
  initDashboardPage();
  initUploadPage();
  initFilesPage();
});