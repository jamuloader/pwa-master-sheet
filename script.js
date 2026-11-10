const URL_APPS_SCRIPT = "https://script.google.com/macros/s/AKfycbxqyb5Bvkj2POUUrMhZzXW1uVD-qq580ND0L78xN1ah4NIgCezcqRSHT1mW710w93eriw/exec";

let PIN = localStorage.getItem("pin") || "";
let currentPage = 1;

// Fungsi pengganti google.script.run menggunakan fetch
async function callApi(payload) {
  const data = Object.assign({ pin: PIN }, payload);
  
  try {
    const response = await fetch(URL_APPS_SCRIPT, {
      method: "POST",
      // KUNCI UTAMA: Gunakan text/plain agar browser tidak mengirim preflight request
      headers: {
        "Content-Type": "text/plain;charset=utf-8" 
      },
      // Kirim data sebagai string JSON
      body: JSON.stringify(data)
    });
    
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("Respons Google:", text);
      return { ok: false, error: "Format respons server salah. Pastikan akses Deploy = Anyone." };
    }

  } catch (err) {
    return { ok: false, error: "Gagal terhubung ke server. Periksa koneksi internet." };
  }
}

function show(id){ document.getElementById(id).style.display = ""; }
function hide(id){ document.getElementById(id).style.display = "none"; }
function setMsg(id, text, ok){
  const el = document.getElementById(id);
  el.textContent = text || "";
  el.className = "msg " + (ok ? "ok" : "err");
}

/* ===== LOGIN ===== */
document.getElementById("loginBtn").onclick = async () => {
  const pin = document.getElementById("pinInput").value.trim();
  if (!pin) return setMsg("loginMsg","PIN wajib diisi",false);
  
  const btn = document.getElementById("loginBtn");
  btn.textContent = "Memuat..."; btn.disabled = true;
  
  const res = await callApi({ action:"login", pin });
  
  btn.textContent = "Masuk"; btn.disabled = false;
  
  if (res.ok) {
    PIN = pin;
    localStorage.setItem("pin", pin);
    hide("loginView"); show("appView");
    loadList(1);
  } else {
    setMsg("loginMsg", res.error || "Gagal", false);
  }
};

async function autoLogin(){
  if (PIN) {
    const res = await callApi({ action:"login" });
    if (res.ok) { hide("loginView"); show("appView"); loadList(1); }
    else { localStorage.removeItem("pin"); PIN=""; }
  }
}

document.getElementById("logoutBtn").onclick = () => {
  localStorage.removeItem("pin"); PIN="";
  hide("appView"); show("loginView");
  document.getElementById("pinInput").value="";
};

/* ===== TABS ===== */
document.querySelectorAll(".tab").forEach(t => {
  t.onclick = () => {
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    t.classList.add("active");
    const tab = t.dataset.tab;
    hide("tab-input"); hide("tab-list");
    show("tab-" + tab);
    if (tab === "list") loadList(currentPage);
  };
});

/* ===== ADD ===== */
document.getElementById("addBtn").onclick = async () => {
  const email = document.getElementById("addEmail").value.trim();
  const status = document.getElementById("addStatus").value;
  setMsg("addMsg","Menyimpan...", true);
  
  const res = await callApi({ action:"add", email, status });
  if (res.ok) {
    setMsg("addMsg","✅ Berhasil disimpan", true);
    document.getElementById("addEmail").value = "";
    document.getElementById("addStatus").value = "active";
  } else {
    setMsg("addMsg", res.error || "Gagal", false);
  }
};

/* ===== LIST ===== */
async function loadList(page){
  const body = document.getElementById("listBody");
  body.innerHTML = '<tr><td colspan="5" class="muted" style="text-align:center">Memuat data...</td></tr>';
  
  const res = await callApi({ action:"list", page });
  if (!res.ok) { alert(res.error); return; }
  
  currentPage = res.page;
  body.innerHTML = "";
  
  if (!res.rows.length) {
    body.innerHTML = '<tr><td colspan="5" class="muted" style="text-align:center">Belum ada data</td></tr>';
  } else {
    res.rows.forEach((r, i) => {
      const tr = document.createElement("tr");
      const badge = r.status === "active"
        ? '<span class="badge active">active</span>'
        : '<span class="badge non">non active</span>';
      tr.innerHTML = `
        <td>${(res.page-1)*10 + i + 1}</td>
        <td>${escapeHtml(r.email)}</td>
        <td>${badge}</td>
        <td>${escapeHtml(r.spreadsheet_id || "")}</td>
        <td class="actions">
          <button class="btn-edit" data-row="${r.row}" data-email="${escapeAttr(r.email)}" data-status="${r.status}">Edit</button>
          <button class="btn-del" data-row="${r.row}">Hapus</button>
        </td>`;
      body.appendChild(tr);
    });
  }
  
  document.getElementById("pageInfo").textContent = `Hal ${res.page} / ${res.totalPages} (${res.total} data)`;
  document.getElementById("prevBtn").disabled = res.page <= 1;
  document.getElementById("nextBtn").disabled = res.page >= res.totalPages;

  body.querySelectorAll(".btn-edit").forEach(b => b.onclick = () => openEdit(b.dataset));
  body.querySelectorAll(".btn-del").forEach(b => b.onclick = () => onDelete(Number(b.dataset.row)));
}

document.getElementById("prevBtn").onclick = () => loadList(currentPage - 1);
document.getElementById("nextBtn").onclick = () => loadList(currentPage + 1);

/* ===== EDIT ===== */
let editingRow = null;
function openEdit(ds){
  editingRow = Number(ds.row);
  document.getElementById("editEmail").value = ds.email;
  document.getElementById("editStatus").value = ds.status;
  setMsg("editMsg","",true);
  show("editModal");
}
document.getElementById("editCancel").onclick = () => hide("editModal");
document.getElementById("editSave").onclick = async () => {
  const email = document.getElementById("editEmail").value.trim();
  const status = document.getElementById("editStatus").value;
  setMsg("editMsg","Menyimpan...", true);
  
  const res = await callApi({ action:"update", row: editingRow, email, status });
  if (res.ok) {
    hide("editModal");
    loadList(currentPage);
  } else {
    setMsg("editMsg", res.error || "Gagal", false);
  }
};

/* ===== DELETE ===== */
async function onDelete(row){
  if (!confirm("Yakin hapus data ini?")) return;
  const res = await callApi({ action:"delete", row });
  if (res.ok) loadList(currentPage);
  else alert(res.error);
}

/* ===== Utils ===== */
function escapeHtml(s){
  return String(s==null?"":s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
function escapeAttr(s){ return escapeHtml(s).replace(/"/g,"&quot;"); }

/* ===== INIT ===== */
autoLogin();

// Daftarkan Service Worker untuk PWA
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}
