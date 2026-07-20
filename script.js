// ============================================
// IRMANUFA QR ABSENSI - SCRIPT UTAMA
// VERSI STABIL UNTUK HOSTING
// KABINET GOLDEN GENERATION 2027-2029
// ============================================

const CONFIG = {
  STORAGE_KEYS: {
    AUTH: "irmanufa_auth",
    AUTH_USER: "irmanufa_auth_user",
    MEMBERS: "irmanufa_members",
    ATTENDANCE: "irmanufa_attendance",
    KEGIATAN: "irmanufa_kegiatan",
  },
  USERS: {
    admin: {
      username: "admin",
      password: "admin123",
      name: "Admin IRMANUFA",
      role: "Super Admin",
      avatar: "admin.png",
    },
    tasya: {
      username: "tasya",
      password: "tasya123",
      name: "Tasya Amelia Putri",
      role: "Sekretaris I",
      avatar: "tasya.png",
    },
    lidya: {
      username: "lidya",
      password: "lidya123",
      name: "Lidya Febrianti",
      role: "Sekretaris II",
      avatar: "lidya.png",
    },
  },
};

const CHART_COLORS = [
  "#2B6CB0", "#4299E1", "#63B3ED", "#90CDF4", "#BEE3F8",
  "#276749", "#48BB78", "#68D391", "#9AE6B4", "#C6F6D5"
];

let AppState = {
  members: [],
  attendance: [],
  activeSection: "dashboard",
  qrScanner: null,
  attendanceChart: null,
  divisionChart: null,
  currentQRMember: null,
  currentQRCanvas: null,
  lastScanTime: 0,
  currentFlashStatus: false,
  currentKegiatan: "",
  currentUser: null,
  isScanning: false,
};

// ==================== SOUND PLAYER ====================
let audioCache = {};

function preloadSounds() {
  const sounds = ["berhasil.mp3", "sudah.mp3", "takkenal.mp3"];
  sounds.forEach((sound) => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.src = sound;
    audioCache[sound] = audio;
  });
}

function playSound(soundName) {
  try {
    if (audioCache[soundName]) {
      audioCache[soundName].currentTime = 0;
      audioCache[soundName].play().catch(() => {});
    } else {
      const audio = new Audio(soundName);
      audio.volume = 0.8;
      audio.play().catch(() => {});
    }
  } catch (e) {}
}

function playBeepSound(type) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioContext.currentTime;
    const masterGain = audioContext.createGain();
    masterGain.connect(audioContext.destination);
    masterGain.gain.value = 0.5;

    let frequencies = [];
    let durations = [];
    let delays = [];

    switch(type) {
      case "berhasil":
        frequencies = [523, 659, 784, 1047];
        durations = [0.12, 0.12, 0.12, 0.15];
        delays = [0, 0.14, 0.28, 0.42];
        masterGain.gain.value = 0.6;
        break;
      case "sudah":
        frequencies = [440, 440];
        durations = [0.15, 0.15];
        delays = [0, 0.20];
        masterGain.gain.value = 0.5;
        break;
      case "takkenal":
        frequencies = [659, 587, 523];
        durations = [0.12, 0.12, 0.15];
        delays = [0, 0.16, 0.32];
        masterGain.gain.value = 0.4;
        break;
      default:
        frequencies = [800, 800, 500];
        durations = [0.06, 0.06, 0.15];
        delays = [0, 0.10, 0.20];
        masterGain.gain.value = 0.3;
    }

    frequencies.forEach((freq, i) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(masterGain);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + delays[i]);
      gain.gain.linearRampToValueAtTime(1, now + delays[i] + 0.01);
      gain.gain.linearRampToValueAtTime(0, now + delays[i] + durations[i]);
      osc.start(now + delays[i]);
      osc.stop(now + delays[i] + durations[i]);
    });

    setTimeout(() => {
      audioContext.close().catch(() => {});
    }, 1000);
  } catch (e) {
    playSound("berhasil.mp3");
  }
}

// ==================== TOAST ====================
const Toast = {
  container: null,
  init() {
    if (this.container) return;
    this.container = document.createElement("div");
    this.container.className = "toast-container";
    document.body.appendChild(this.container);
  },
  show(message, type = "info", title = "") {
    this.init();
    const titles = {
      success: "✓ Berhasil!",
      error: "✗ Gagal!",
      warning: "⚠ Peringatan!",
      info: "ℹ Informasi",
    };
    const icons = {
      success: "fa-check-circle",
      error: "fa-exclamation-circle",
      warning: "fa-exclamation-triangle",
      info: "fa-info-circle",
    };
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas ${icons[type]}"></i><div class="toast-content"><div class="toast-title">${title || titles[type]}</div><div class="toast-message">${message}</div></div><button class="toast-close">&times;</button>`;
    toast.querySelector(".toast-close").onclick = () => toast.remove();
    this.container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  },
  success(msg, title = "") { this.show(msg, "success", title); },
  error(msg, title = "") { this.show(msg, "error", title); },
  warning(msg, title = "") { this.show(msg, "warning", title); },
  info(msg, title = "") { this.show(msg, "info", title); },
};

// ==================== LOAD DATA ====================
function loadData(forceReload = false) {
  if (forceReload) {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.MEMBERS);
  }

  let storedMembers = localStorage.getItem(CONFIG.STORAGE_KEYS.MEMBERS);
  const isValidData = storedMembers && storedMembers !== "[]" && storedMembers !== "null";
  
  if (!isValidData || forceReload) {
    if (typeof IRMANUFA_DATA !== "undefined" && IRMANUFA_DATA.members) {
      AppState.members = IRMANUFA_DATA.members.map((m, idx) => ({
        id: String(idx + 1),
        code: m.code,
        name: m.name,
        gender: m.gender,
        position: m.position || "Anggota",
        division: m.division,
        status: m.status,
      }));
      localStorage.setItem(CONFIG.STORAGE_KEYS.MEMBERS, JSON.stringify(AppState.members));
    } else {
      AppState.members = [];
    }
  } else {
    try {
      const parsed = JSON.parse(storedMembers);
      if (Array.isArray(parsed) && parsed.length > 0) {
        AppState.members = parsed;
      } else {
        loadData(true);
      }
    } catch (e) {
      loadData(true);
    }
  }

  let storedAttendance = localStorage.getItem(CONFIG.STORAGE_KEYS.ATTENDANCE);
  AppState.attendance = storedAttendance ? JSON.parse(storedAttendance) : [];

  const savedKegiatan = localStorage.getItem(CONFIG.STORAGE_KEYS.KEGIATAN);
  AppState.currentKegiatan = savedKegiatan || "Rapat Koordinasi IRMANUFA";
}

function saveMembers() {
  localStorage.setItem(CONFIG.STORAGE_KEYS.MEMBERS, JSON.stringify(AppState.members));
}

function saveAttendance() {
  localStorage.setItem(CONFIG.STORAGE_KEYS.ATTENDANCE, JSON.stringify(AppState.attendance));
}

function saveKegiatan(kegiatan) {
  AppState.currentKegiatan = kegiatan;
  localStorage.setItem(CONFIG.STORAGE_KEYS.KEGIATAN, kegiatan);
}

// ==================== HELPER FUNCTIONS ====================
function formatDate(date = new Date()) {
  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateShort(date = new Date()) {
  return date.toLocaleDateString("id-ID", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getMemberById(id) {
  return AppState.members.find((m) => m.id === id);
}

function getMemberByCode(code) {
  return AppState.members.find((m) => m.code === code);
}

function isAlreadyAttended(memberId) {
  const today = new Date().toDateString();
  return AppState.attendance.some(
    (a) => a.memberId === memberId && new Date(a.timestamp).toDateString() === today
  );
}

function getGenderText(gender) {
  return gender === "L" ? "Laki-laki" : "Perempuan";
}

function getStats() {
  const activeMembers = AppState.members.filter((m) => m.status === "active").length;
  const passiveMembers = AppState.members.filter((m) => m.status === "passive").length;
  const todayCount = getTodayAttendance().length;
  const totalAttendance = AppState.attendance.length;

  const count = {};
  AppState.attendance.forEach((a) => {
    count[a.memberName] = (count[a.memberName] || 0) + 1;
  });
  const topMembers = Object.entries(count)
    .map(([n, c]) => ({
      name: n,
      count: c,
      division: AppState.attendance.find((a) => a.memberName === n)?.division || "-",
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const divStats = {};
  AppState.members.forEach((m) => {
    if (m.status === "active") {
      if (!divStats[m.division]) divStats[m.division] = { total: 0, attended: 0 };
      divStats[m.division].total++;
    }
  });
  getTodayAttendance().forEach((a) => {
    if (divStats[a.division]) divStats[a.division].attended++;
  });

  return { activeMembers, passiveMembers, todayCount, totalAttendance, topMembers, divisionStats };
}

function getTodayAttendance() {
  const today = new Date().toDateString();
  return AppState.attendance.filter(
    (a) => new Date(a.timestamp).toDateString() === today
  );
}

// ==================== ATTENDANCE ====================
function recordAttendance(memberId, method = "qr") {
  const member = getMemberById(memberId);
  if (!member) {
    Toast.error("Anggota tidak ditemukan!");
    playBeepSound("takkenal");
    return false;
  }
  if (member.status !== "active") {
    Toast.warning(`${member.name} adalah anggota PASIF!`);
    playBeepSound("takkenal");
    return false;
  }
  if (isAlreadyAttended(memberId)) {
    Toast.warning(`${member.name} sudah absen hari ini!`);
    playBeepSound("sudah");
    return false;
  }

  const attendance = {
    id: Date.now() + Math.random() * 1000,
    memberId: member.id,
    memberCode: member.code,
    memberName: member.name,
    memberGender: member.gender,
    division: member.division,
    position: member.position,
    timestamp: new Date().toISOString(),
    date: formatDate(),
    dateShort: formatDateShort(),
    time: formatTime(),
    method: method,
    kegiatan: AppState.currentKegiatan,
  };
  AppState.attendance.push(attendance);
  saveAttendance();
  updateAllDisplays();
  playBeepSound("berhasil");
  Toast.success(`${member.name} berhasil absen!`, "Absensi Berhasil");
  renderTodayScanHistory();
  return true;
}

// ==================== QR SCANNER ====================
async function startScanner() {
  const container = document.getElementById("reader");
  if (!container) return;

  if (window.location.protocol === "file:") {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p style="font-size: 16px; font-weight: 600;">⚠️ PERLU LIVE SERVER!</p>
        <p style="font-size: 13px; color: #718096; margin-top: 8px;">
          Jalankan dengan Live Server atau hosting
        </p>
      </div>
    `;
    Toast.error("Jalankan dengan Live Server!");
    return;
  }

  container.innerHTML = `
    <div class="empty-state">
      <i class="fas fa-spinner fa-spin"></i>
      <p>Mengakses kamera...</p>
    </div>
  `;

  // Coba akses kamera dengan berbagai konfigurasi
  let cameraWorked = false;
  const configs = [
    { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
    { facingMode: "environment" },
    { facingMode: "user" },
    { width: { ideal: 640 }, height: { ideal: 480 } },
    { video: true }
  ];

  for (const config of configs) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: config });
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        cameraWorked = true;
        break;
      }
    } catch (e) {}
  }

  if (!cameraWorked) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p style="font-size: 16px; font-weight: 600;">Izin Kamera Diperlukan!</p>
        <button class="btn btn-primary" onclick="startScanner()" style="margin-top: 12px; padding: 12px 24px;">
          <i class="fas fa-camera"></i> Minta Izin Kamera
        </button>
      </div>
    `;
    Toast.error("Gagal akses kamera!");
    return;
  }

  if (AppState.qrScanner) {
    try {
      await AppState.qrScanner.stop();
      AppState.qrScanner = null;
      AppState.isScanning = false;
    } catch (e) {}
  }

  try {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Memulai scanner...</p>
      </div>
    `;

    const html5QrCode = new Html5Qrcode("reader");
    AppState.qrScanner = html5QrCode;
    AppState.isScanning = true;

    await html5QrCode.start(
      { facingMode: "environment" },
      {
        fps: 15,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1.0
      },
      (decodedText) => {
        const now = Date.now();
        if (now - AppState.lastScanTime < 1000) return;
        AppState.lastScanTime = now;

        let member = null;
        let detectedFormat = "QR Code";

        try {
          const qrData = JSON.parse(decodedText);
          member = getMemberByCode(qrData.code);
          if (member) detectedFormat = "JSON QR Code";
        } catch (e) {
          member = getMemberByCode(decodedText);
          if (member) detectedFormat = "QR Code";
        }

        if (member) {
          if (member.status === "active") {
            if (!isAlreadyAttended(member.id)) {
              recordAttendance(member.id, "qr");
              showScanResult(member, "success", detectedFormat);
            } else {
              Toast.warning(`${member.name} sudah absen hari ini!`);
              showScanResult(member, "warning", "Sudah Absen", detectedFormat);
              playBeepSound("sudah");
            }
          } else {
            Toast.warning(`${member.name} adalah anggota PASIF!`);
            showScanResult(member, "error", "Anggota Pasif", detectedFormat);
            playBeepSound("takkenal");
          }
        } else {
          let preview = decodedText.length > 50 ? decodedText.substring(0, 50) + "..." : decodedText;
          Toast.info(`QR Terdeteksi: ${preview}`);
          showQRDetectedResult(decodedText, detectedFormat);
          playBeepSound("unknown");
        }
      },
      () => {}
    );
    
    Toast.success("Scanner siap! Arahkan ke QR Code.");
  } catch (err) {
    console.error("Scanner error:", err);
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Gagal memulai scanner!</p>
        <button class="btn btn-primary" onclick="startScanner()" style="margin-top: 12px;">Coba Lagi</button>
      </div>
    `;
    Toast.error("Gagal memulai scanner!");
  }
}

function stopScanner() {
  if (AppState.qrScanner) {
    AppState.qrScanner.stop();
    AppState.qrScanner = null;
    AppState.isScanning = false;
    AppState.currentFlashStatus = false;
    document.getElementById("reader").innerHTML = `
      <div class="empty-state">
        <i class="fas fa-qrcode" style="font-size: 48px;"></i>
        <p>Scanner dihentikan</p>
        <button class="btn btn-primary" onclick="startScanner()">Mulai Scan</button>
      </div>
    `;
    const btn = document.getElementById("flashToggleBtn");
    if (btn) {
      btn.classList.remove("active");
      btn.innerHTML = `<i class="fas fa-lightbulb"></i> Flash OFF`;
    }
    Toast.info("Scanner dihentikan");
  }
}

function showQRDetectedResult(decodedText, format = "QR Code") {
  const resultDiv = document.getElementById("scanResult");
  if (!resultDiv) return;

  let preview = decodedText.length > 100 ? decodedText.substring(0, 100) + "..." : decodedText;

  resultDiv.className = "scan-result warning";
  resultDiv.style.display = "block";
  resultDiv.innerHTML = `
    <div class="member-name-large" style="font-size: 18px; color: #975a16;">
      <i class="fas fa-qrcode"></i> QR Terdeteksi!
    </div>
    <div style="text-align: center; margin: 12px 0;">
      <span class="info-badge" style="background: #fef3c7; color: #975a16;">
        <i class="fas fa-tag"></i> ${format}
      </span>
    </div>
    <div style="background: #f7fafc; padding: 12px; border-radius: 10px; margin: 10px 0; word-break: break-all; font-size: 12px; font-family: monospace;">
      ${preview}
    </div>
    <div style="text-align: center; font-size: 13px; color: #975a16;">
      ⚠️ QR Code tidak terdaftar di sistem IRMANUFA
    </div>
  `;
  setTimeout(() => { resultDiv.style.display = "none"; }, 4000);
}

function showScanResult(member, type, format = "QR Code") {
  const resultDiv = document.getElementById("scanResult");
  if (!resultDiv) return;

  resultDiv.className = `scan-result ${type}`;
  resultDiv.style.display = "block";

  let icon = "✅";
  let statusText = "";
  let statusColor = "";

  if (type === "success") {
    icon = "✅";
    statusText = "Berhasil Absen!";
    statusColor = "#276749";
  } else if (type === "warning") {
    icon = "⚠️";
    statusText = "Sudah Absen";
    statusColor = "#975a16";
  } else if (type === "error") {
    icon = "❌";
    statusText = "Anggota Pasif";
    statusColor = "#c53030";
  }

  if (member) {
    resultDiv.innerHTML = `
      <div class="member-name-large" style="color: ${statusColor};">${icon} ${member.name}</div>
      <div class="member-info-grid">
        <span class="info-badge"><i class="fas fa-id-card"></i> ${member.code}</span>
        <span class="info-badge"><i class="fas fa-users"></i> ${member.division}</span>
        <span class="info-badge"><i class="fas fa-user-tag"></i> ${member.position || "Anggota"}</span>
        <span class="info-badge"><i class="fas fa-venus-mars"></i> ${getGenderText(member.gender)}</span>
        <span class="info-badge" style="background: ${type === 'success' ? '#f0fff4' : type === 'warning' ? '#fffff0' : '#fff5f5'}; color: ${statusColor};">
          <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'warning' ? 'fa-clock' : 'fa-times-circle'}"></i> ${statusText}
        </span>
      </div>
      <div style="text-align: center; font-size: 11px; color: #718096; margin-top: 8px;">
        <i class="fas fa-qrcode"></i> Format: ${format}
      </div>
    `;
  }
  setTimeout(() => { resultDiv.style.display = "none"; }, 4000);
}

async function toggleFlash() {
  if (!AppState.qrScanner || !AppState.isScanning) {
    Toast.warning("Scanner belum dimulai!");
    return;
  }

  try {
    const video = document.querySelector("#reader video");
    if (!video) { Toast.warning("Kamera belum aktif!"); return; }

    const stream = video.srcObject;
    if (stream) {
      const track = stream.getVideoTracks()[0];
      if (track && track.getCapabilities && track.getCapabilities().torch) {
        const newState = !AppState.currentFlashStatus;
        await track.applyConstraints({ advanced: [{ torch: newState }] });
        AppState.currentFlashStatus = newState;
        const btn = document.getElementById("flashToggleBtn");
        if (btn) {
          btn.classList.toggle("active", newState);
          btn.innerHTML = `<i class="fas fa-lightbulb"></i> Flash ${newState ? "ON" : "OFF"}`;
        }
        Toast.info(`Flash ${newState ? "ON" : "OFF"}`);
      } else {
        Toast.warning("Device tidak support flash!");
      }
    }
  } catch (e) {
    Toast.warning("Gagal flash!");
  }
}

// ==================== QR GENERATOR ====================
function updateMemberSelect() {
  const select = document.getElementById("memberSelect");
  if (select) {
    const active = AppState.members.filter((m) => m.status === "active");
    select.innerHTML = '<option value="">✨-- Pilih Anggota Aktif --✨</option>' +
      active.map(m => `<option value="${m.id}">${m.code} - ${m.name} (${m.division})</option>`).join('');
  }
}

function generateMemberQR() {
  const member = getMemberById(document.getElementById("memberSelect")?.value);
  if (!member) { Toast.warning("Pilih anggota dulu!"); return; }
  if (member.status !== "active") { Toast.warning(`Anggota ${member.name} PASIF!`); return; }

  const qrContainer = document.getElementById("qrCodeDisplay");
  const infoContainer = document.getElementById("memberInfoDisplay");
  if (!qrContainer) return;

  qrContainer.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Membuat QR...</p></div>';

  try {
    // Bersihkan container dan buat div baru untuk QR
    qrContainer.innerHTML = "";
    const qrDiv = document.createElement("div");
    qrDiv.id = "qrcode-container";
    qrContainer.appendChild(qrDiv);
    
    // Generate QR menggunakan QRCode.js
    new QRCode(qrDiv, {
      text: JSON.stringify({
        code: member.code,
        name: member.name,
        gender: member.gender,
        position: member.position,
        division: member.division,
        status: member.status,
      }),
      width: 200,
      height: 200,
      colorDark: "#1a365d",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
    
    AppState.currentQRMember = member;
    const canvas = qrDiv.querySelector("canvas");
    if (canvas) {
      AppState.currentQRCanvas = canvas;
    }
    
    if (infoContainer) {
      infoContainer.innerHTML = `
        <div class="member-info-card">
          <h4><i class="fas fa-id-card"></i> DATA DIRI</h4>
          <p><strong>Nama:</strong> ${member.name}</p>
          <p><strong>JK:</strong> ${getGenderText(member.gender)}</p>
          <p><strong>Kode:</strong> ${member.code}</p>
          <p><strong>Jabatan:</strong> ${member.position || "Anggota"}</p>
          <p><strong>Divisi:</strong> ${member.division}</p>
          <p><strong>Status:</strong> <span class="status-badge status-active">AKTIF</span></p>
        </div>
      `;
    }
    Toast.success(`QR untuk ${member.name} berhasil!`);
  } catch (e) {
    console.error("QR Error:", e);
    qrContainer.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Gagal buat QR!</p>
        <p style="font-size: 12px; color: #718096;">${e.message || "Coba refresh halaman"}</p>
      </div>
    `;
    Toast.error("Gagal buat QR!");
  }
}

// ==================== DOWNLOAD QR ====================
function downloadQRAsPNG() {
  if (!AppState.currentQRCanvas || !AppState.currentQRMember) {
    Toast.warning("Generate QR dulu!");
    return;
  }

  const member = AppState.currentQRMember;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const qrSize = 500;
  const padding = 50;
  const width = qrSize + padding * 2;
  const height = qrSize + 450;

  canvas.width = width;
  canvas.height = height;

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "#f7fafc");
  grad.addColorStop(1, "#edf2f7");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#2b6cb0";
  ctx.lineWidth = 4;
  ctx.strokeRect(12, 12, width - 24, height - 24);

  ctx.fillStyle = "#1a365d";
  ctx.fillRect(0, 0, width, 75);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("IRMANUFA QR CODE", width / 2, 48);

  ctx.drawImage(AppState.currentQRCanvas, padding, 90, qrSize, qrSize);

  ctx.fillStyle = "#1a365d";
  ctx.font = "bold 22px Inter, sans-serif";
  ctx.fillText("DATA DIRI ANGGOTA", width / 2, qrSize + 145);

  ctx.beginPath();
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  ctx.moveTo(padding + 15, qrSize + 170);
  ctx.lineTo(width - padding - 15, qrSize + 170);
  ctx.stroke();

  ctx.font = "15px Inter, sans-serif";
  ctx.fillStyle = "#2d3748";
  ctx.textAlign = "left";
  let y = qrSize + 205;
  const lineH = 35;

  ctx.fillText(`Nama Lengkap      : ${member.name}`, padding + 35, y);
  ctx.fillText(`Jenis Kelamin     : ${getGenderText(member.gender)}`, padding + 35, y + lineH);
  ctx.fillText(`Kode Member       : ${member.code}`, padding + 35, y + lineH * 2);
  ctx.fillText(`Jabatan           : ${member.position || "Anggota"}`, padding + 35, y + lineH * 3);
  ctx.fillText(`Divisi            : ${member.division}`, padding + 35, y + lineH * 4);
  ctx.fillText(`Status            : AKTIF`, padding + 35, y + lineH * 5);

  ctx.fillStyle = "#a0aec0";
  ctx.font = "12px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`Dicetak: ${formatDate()}`, width / 2, height - 45);
  ctx.font = "11px Inter, sans-serif";
  ctx.fillText("Sistem Absensi Digital IRMANUFA - Kabinet Golden Generation 2027-2029", width / 2, height - 22);

  const link = document.createElement("a");
  link.download = `QR_${member.name.replace(/\s/g, "_")}_${member.code}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  Toast.success("QR Code berhasil diunduh!");
}

function downloadQRAsPDF() {
  if (!AppState.currentQRCanvas || !AppState.currentQRMember) {
    Toast.warning("Generate QR dulu!");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const member = AppState.currentQRMember;

  doc.setFillColor(26, 54, 93);
  doc.rect(0, 0, 210, 45, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("IRMANUFA QR ABSENSI", 105, 25, { align: "center" });
  doc.setFontSize(10);
  doc.text("Ikatan Remaja Masjid Jami Nurul Falah", 105, 36, { align: "center" });

  const qrUrl = AppState.currentQRCanvas.toDataURL();
  doc.addImage(qrUrl, "PNG", 55, 55, 100, 100);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("DATA DIRI ANGGOTA", 105, 175, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  let y = 195;
  doc.text(`Nama Lengkap      : ${member.name}`, 25, y);
  doc.text(`Jenis Kelamin     : ${getGenderText(member.gender)}`, 25, y + 9);
  doc.text(`Kode Member       : ${member.code}`, 25, y + 18);
  doc.text(`Jabatan           : ${member.position || "Anggota"}`, 25, y + 27);
  doc.text(`Divisi            : ${member.division}`, 25, y + 36);
  doc.text(`Status            : AKTIF`, 25, y + 45);

  doc.setFillColor(26, 54, 93);
  doc.rect(0, 270, 210, 27, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(`Dicetak: ${formatDate()}`, 105, 282, { align: "center" });
  doc.text("Sistem Absensi Digital IRMANUFA - Kabinet Golden Generation 2027-2029", 105, 290, { align: "center" });

  doc.save(`QR_${member.name.replace(/\s/g, "_")}_${member.code}.pdf`);
  Toast.success("PDF berhasil diunduh!");
}

// ==================== CRUD MEMBERS ====================
function showAddMemberModal() {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3><i class="fas fa-user-plus"></i> Tambah Anggota</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="input-group"><label>Kode Member</label><input type="text" id="memberCode" placeholder="26.09.001"></div>
      <div class="input-group"><label>Nama Lengkap</label><input type="text" id="memberName"></div>
      <div class="input-group"><label>Jenis Kelamin</label><select id="memberGender"><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></div>
      <div class="input-group"><label>Jabatan</label><input type="text" id="memberPosition" placeholder="Anggota Divisi ..."></div>
      <div class="input-group"><label>Divisi</label><input type="text" id="memberDivision"></div>
      <div class="input-group"><label>Status</label><select id="memberStatus"><option value="active">Aktif</option><option value="passive">Pasif</option></select></div>
      <div class="modal-buttons">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Batal</button>
        <button class="btn btn-primary" onclick="saveNewMember()">Simpan</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function saveNewMember() {
  const code = document.getElementById("memberCode")?.value.trim();
  const name = document.getElementById("memberName")?.value.trim();
  const gender = document.getElementById("memberGender")?.value;
  const position = document.getElementById("memberPosition")?.value.trim();
  const division = document.getElementById("memberDivision")?.value.trim();
  const status = document.getElementById("memberStatus")?.value;

  if (!code || !name) { Toast.warning("Kode dan Nama harus diisi!"); return; }
  if (AppState.members.some((m) => m.code === code)) { Toast.warning("Kode sudah ada!"); return; }

  const maxId = AppState.members.length > 0 ? Math.max(...AppState.members.map((m) => parseInt(m.id))) : 0;
  const newId = String(maxId + 1);

  AppState.members.push({ id: newId, code, name, gender, position: position || "Anggota", division: division || "Divisi Baru", status });
  saveMembers();
  updateAllDisplays();
  updateMemberSelect();
  document.querySelector(".modal-overlay")?.remove();
  Toast.success(`Anggota ${name} ditambahkan!`);
}

function showEditMemberModal(id) {
  const member = getMemberById(id);
  if (!member) return;

  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3><i class="fas fa-user-edit"></i> Edit Anggota</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="input-group"><label>Kode Member</label><input type="text" id="memberCode" value="${member.code}"></div>
      <div class="input-group"><label>Nama Lengkap</label><input type="text" id="memberName" value="${member.name.replace(/"/g, "&quot;")}"></div>
      <div class="input-group"><label>Jenis Kelamin</label><select id="memberGender"><option value="L" ${member.gender === "L" ? "selected" : ""}>Laki-laki</option><option value="P" ${member.gender === "P" ? "selected" : ""}>Perempuan</option></select></div>
      <div class="input-group"><label>Jabatan</label><input type="text" id="memberPosition" value="${member.position || ""}"></div>
      <div class="input-group"><label>Divisi</label><input type="text" id="memberDivision" value="${member.division || ""}"></div>
      <div class="input-group"><label>Status</label><select id="memberStatus"><option value="active" ${member.status === "active" ? "selected" : ""}>Aktif</option><option value="passive" ${member.status === "passive" ? "selected" : ""}>Pasif</option></select></div>
      <div class="modal-buttons">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Batal</button>
        <button class="btn btn-primary" onclick="updateExistingMember('${id}')">Simpan</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function updateExistingMember(id) {
  const code = document.getElementById("memberCode")?.value.trim();
  const name = document.getElementById("memberName")?.value.trim();
  const gender = document.getElementById("memberGender")?.value;
  const position = document.getElementById("memberPosition")?.value.trim();
  const division = document.getElementById("memberDivision")?.value.trim();
  const status = document.getElementById("memberStatus")?.value;

  if (!code || !name) { Toast.warning("Kode dan Nama harus diisi!"); return; }
  if (AppState.members.some((m) => m.id !== id && m.code === code)) { Toast.warning("Kode sudah dipakai!"); return; }

  const idx = AppState.members.findIndex((m) => m.id === id);
  if (idx !== -1) {
    AppState.members[idx] = { ...AppState.members[idx], code, name, gender, position: position || "Anggota", division: division || "Divisi Baru", status };
    saveMembers();
    updateAllDisplays();
    updateMemberSelect();
    Toast.success("Data anggota diupdate!");
  }
  document.querySelector(".modal-overlay")?.remove();
}

function showDeleteConfirmModal(id) {
  const member = getMemberById(id);
  if (!member) return;

  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal" style="max-width: 400px;">
      <div class="modal-header" style="background: #fff5f5;">
        <h3 style="color: #c53030;"><i class="fas fa-trash-alt"></i> Hapus Anggota</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div style="text-align: center; padding: 20px 0;">
        <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #d69e2e;"></i>
        <p style="margin-top: 10px;">Hapus <strong>${member.name}</strong>?</p>
      </div>
      <div class="modal-buttons">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Batal</button>
        <button class="btn btn-danger" onclick="confirmDeleteMember('${id}')">Hapus</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function confirmDeleteMember(id) {
  AppState.members = AppState.members.filter((m) => m.id !== id);
  saveMembers();
  updateAllDisplays();
  updateMemberSelect();
  document.querySelector(".modal-overlay")?.remove();
  Toast.success("Anggota dihapus!");
}

// ==================== RENDER FUNCTIONS ====================
function renderTodayScanHistory() {
  const container = document.getElementById("todayScanHistory");
  if (!container) return;

  const today = new Date().toDateString();
  const todayAttendance = AppState.attendance.filter(
    (a) => new Date(a.timestamp).toDateString() === today
  );

  if (todayAttendance.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-clipboard-list"></i><p>Belum ada scan hari ini</p></div>';
    return;
  }

  container.innerHTML = `
    <div style="overflow-x: auto;">
      <table class="data-table">
        <thead><tr><th>No</th><th>Nama</th><th>Divisi</th><th>Waktu</th><th>Aksi</th></tr></thead>
        <tbody>
          ${todayAttendance.map((a, i) => `
            <tr>
              <td>${i + 1}</td>
              <td><strong>${a.memberName}</strong></td>
              <td>${a.division}</td>
              <td>${a.time}</td>
              <td>
                <button class="btn btn-warning btn-sm" onclick="editAttendanceById(${a.id})" style="padding: 4px 8px; margin-right: 5px;"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-sm" onclick="deleteAttendanceById(${a.id})" style="padding: 4px 8px;"><i class="fas fa-trash"></i></button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function editAttendanceById(attendanceId) {
  const attendance = AppState.attendance.find((a) => a.id == attendanceId);
  if (!attendance) return;

  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3><i class="fas fa-edit"></i> Edit Data Absensi</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="input-group"><label>Nama</label><input type="text" value="${attendance.memberName}" disabled></div>
      <div class="input-group"><label>Waktu</label><input type="time" id="editTime" value="${attendance.time}"></div>
      <div class="input-group"><label>Tanggal</label><input type="date" id="editDate" value="${attendance.dateShort.split("/").reverse().join("-")}"></div>
      <div class="input-group"><label>Kegiatan</label><input type="text" id="editKegiatan" value="${attendance.kegiatan || AppState.currentKegiatan}"></div>
      <div class="modal-buttons">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Batal</button>
        <button class="btn btn-primary" onclick="saveEditAttendance(${attendance.id})">Simpan</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function saveEditAttendance(id) {
  const newTime = document.getElementById("editTime")?.value;
  const newDate = document.getElementById("editDate")?.value;
  const newKegiatan = document.getElementById("editKegiatan")?.value;
  const index = AppState.attendance.findIndex((a) => a.id == id);
  if (index !== -1) {
    if (newDate) {
      const d = new Date(newDate);
      AppState.attendance[index].date = formatDate(d);
      AppState.attendance[index].dateShort = formatDateShort(d);
      AppState.attendance[index].timestamp = d.toISOString();
    }
    if (newTime) AppState.attendance[index].time = newTime;
    if (newKegiatan) AppState.attendance[index].kegiatan = newKegiatan;
    saveAttendance();
    updateAllDisplays();
    renderTodayScanHistory();
    Toast.success("Data diupdate!");
  }
  document.querySelector(".modal-overlay")?.remove();
}

function deleteAttendanceById(id) {
  showConfirmModal("Hapus Data", "Yakin hapus data ini?", () => {
    AppState.attendance = AppState.attendance.filter((a) => a.id != id);
    saveAttendance();
    updateAllDisplays();
    renderTodayScanHistory();
    Toast.success("Data dihapus!");
  });
}

function showConfirmModal(title, msg, onConfirm) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal" style="max-width: 400px;">
      <div class="modal-header" style="background: #fffff0;">
        <h3><i class="fas fa-exclamation-triangle" style="color:#d69e2e;"></i> ${title}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div style="text-align:center;padding:20px;">
        <i class="fas fa-question-circle" style="font-size:48px;color:#d69e2e;"></i>
        <p>${msg}</p>
      </div>
      <div class="modal-buttons">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Batal</button>
        <button class="btn btn-danger" id="confirmBtn">Ya</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById("confirmBtn").onclick = () => {
    modal.remove();
    onConfirm();
  };
}

function updateAllDisplays() {
  renderMemberTable();
  renderTopMembers();
  renderRecentAttendance();
  updateCharts();
  updateStatsCards();
}

function renderMemberTable(search = "") {
  const container = document.getElementById("memberTableBody");
  if (!container) return;

  let members = [...AppState.members];
  if (search) {
    members = members.filter(m => 
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.code.includes(search) ||
      m.division.toLowerCase().includes(search.toLowerCase())
    );
  }

  if (members.length === 0) {
    container.innerHTML = '<tr><td colspan="7" class="empty-state">Tidak ada anggota</td></tr>';
    return;
  }

  const todayAttended = getTodayAttendance().map((a) => a.memberId);

  container.innerHTML = members.map(m => `
    <tr>
      <td><strong>${m.code}</strong></td>
      <td><strong>${m.name}</strong><br><small>${getGenderText(m.gender)}</small></td>
      <td>${m.division}</td>
      <td>${m.position || "Anggota"}</td>
      <td><span class="status-badge ${m.status === "active" ? "status-active" : "status-passive"}">${m.status === "active" ? "Aktif" : "Pasif"}</span></td>
      <td><span class="status-badge ${todayAttended.includes(m.id) ? "status-hadir" : "status-belum"}">${todayAttended.includes(m.id) ? "Hadir" : "Belum"}</span></td>
      <td>
        <button class="btn btn-warning btn-sm" onclick="showEditMemberModal('${m.id}')" style="margin-right: 5px;"><i class="fas fa-edit"></i></button>
        <button class="btn btn-danger btn-sm" onclick="showDeleteConfirmModal('${m.id}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

function renderTopMembers() {
  const stats = getStats();
  const container = document.getElementById("topMembersList");
  if (!container) return;

  if (stats.topMembers.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-trophy"></i><p>Belum ada data absensi</p></div>';
    return;
  }

  container.innerHTML = stats.topMembers.map((m, i) => `
    <div class="ranking-item">
      <div class="rank-number" style="background: ${i === 0 ? "#d69e2e" : i === 1 ? "#a0aec0" : i === 2 ? "#ed8936" : "#2b6cb0"};">${i + 1}</div>
      <div class="rank-info">
        <h4>${m.name}</h4>
        <div class="rank-stats">
          <span><i class="fas fa-check-circle" style="color:#276749;"></i> ${m.count} kali</span>
          <span><i class="fas fa-users"></i> ${m.division}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function renderRecentAttendance() {
  const container = document.getElementById("recentAttendanceList");
  if (!container) return;

  const recent = [...AppState.attendance].reverse().slice(0, 10);

  if (recent.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-clipboard-list"></i><p>Belum ada absensi</p></div>';
    return;
  }

  container.innerHTML = recent.map(a => `
    <div class="ranking-item">
      <div class="rank-number" style="background: #276749;">✓</div>
      <div class="rank-info">
        <h4>${a.memberName}</h4>
        <div class="rank-stats">
          <span><i class="fas fa-clock"></i> ${a.time}</span>
          <span><i class="fas fa-calendar"></i> ${a.date.split(",")[0]}</span>
          <span><i class="fas fa-tag"></i> ${a.kegiatan ? a.kegiatan.substring(0, 25) : AppState.currentKegiatan.substring(0, 25)}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function updateCharts() {
  const stats = getStats();

  const ctx1 = document.getElementById("attendanceChart");
  if (ctx1) {
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return {
        date: d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
        count: AppState.attendance.filter(a => new Date(a.timestamp).toDateString() === d.toDateString()).length,
      };
    });

    if (AppState.attendanceChart) AppState.attendanceChart.destroy();
    AppState.attendanceChart = new Chart(ctx1, {
      type: "line",
      data: {
        labels: last7.map((d) => d.date),
        datasets: [{
          label: "Jumlah Absensi",
          data: last7.map((d) => d.count),
          borderColor: "#2b6cb0",
          backgroundColor: "rgba(43, 108, 176, 0.1)",
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#2b6cb0",
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true }, x: { grid: { display: false } } },
        plugins: { legend: { display: false } },
      },
    });
  }

  const ctx2 = document.getElementById("divisionChart");
  if (ctx2 && Object.keys(stats.divisionStats).length > 0) {
    const names = Object.keys(stats.divisionStats);
    const rates = names.map(d => (stats.divisionStats[d].attended / stats.divisionStats[d].total) * 100);
    const colors = names.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

    if (AppState.divisionChart) AppState.divisionChart.destroy();
    AppState.divisionChart = new Chart(ctx2, {
      type: "bar",
      data: {
        labels: names,
        datasets: [{
          label: "Kehadiran (%)",
          data: rates,
          backgroundColor: colors,
          borderRadius: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + "%" } },
          x: { ticks: { rotation: 45 } },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `${ctx.raw.toFixed(1)}%` } },
        },
      },
    });
  }
}

function updateStatsCards() {
  const s = getStats();
  document.getElementById("activeMembers").textContent = s.activeMembers;
  document.getElementById("todayCount").textContent = s.todayCount;
  document.getElementById("totalAttendance").textContent = s.totalAttendance;

  const passiveCount = AppState.members.filter(m => m.status === "passive").length;
  const navStats = document.querySelector(".nav-stats");
  if (navStats) {
    navStats.innerHTML = `
      <span class="stat-badge blue"><i class="fas fa-users"></i> ${s.activeMembers} Aktif</span>
      <span class="stat-badge green"><i class="fas fa-calendar-check"></i> ${s.todayCount} Hadir</span>
      <span class="stat-badge red"><i class="fas fa-user-clock"></i> ${passiveCount} Pasif</span>
    `;
  }
}

// ==================== LAPORAN LENGKAP ====================
function filterAttendanceByPeriod(period) {
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date();

  switch(period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      break;
    case 'week':
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(now.getFullYear(), now.getMonth(), diff);
      endDate = new Date(now.getFullYear(), now.getMonth(), diff + 6, 23, 59, 59);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      break;
    case 'all':
    default:
      startDate = new Date(2000, 0, 1);
      endDate = new Date(2100, 11, 31, 23, 59, 59);
      break;
  }

  return AppState.attendance.filter(a => {
    const aDate = new Date(a.timestamp);
    return aDate >= startDate && aDate <= endDate;
  });
}

function generateDetailedReport() {
  const periodSelect = document.getElementById("reportPeriod");
  const period = periodSelect ? periodSelect.value : 'all';
  
  const filteredAttendance = filterAttendanceByPeriod(period);
  
  const memberStats = {};
  const allMembers = AppState.members.filter(m => m.status === 'active');
  
  allMembers.forEach(m => {
    memberStats[m.id] = {
      name: m.name,
      code: m.code,
      division: m.division,
      position: m.position,
      gender: m.gender,
      totalHadir: 0,
      totalTidakHadir: 0,
      kegiatan: [],
    };
  });

  filteredAttendance.forEach(a => {
    if (memberStats[a.memberId]) {
      memberStats[a.memberId].totalHadir++;
      if (a.kegiatan && !memberStats[a.memberId].kegiatan.includes(a.kegiatan)) {
        memberStats[a.memberId].kegiatan.push(a.kegiatan);
      }
    }
  });

  let totalDays = 0;
  const now = new Date();
  switch(period) {
    case 'today': totalDays = 1; break;
    case 'week': totalDays = 7; break;
    case 'month': totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); break;
    case 'year': totalDays = (now.getFullYear() % 4 === 0 && now.getFullYear() % 100 !== 0) || now.getFullYear() % 400 === 0 ? 366 : 365; break;
    case 'all': totalDays = '∞'; break;
  }

  Object.keys(memberStats).forEach(id => {
    const stats = memberStats[id];
    stats.totalTidakHadir = totalDays !== '∞' ? totalDays - stats.totalHadir : 0;
  });

  const reportData = Object.values(memberStats);
  
  const periodLabels = {
    'today': 'HARI INI',
    'week': 'MINGGU INI',
    'month': 'BULAN INI',
    'year': 'TAHUN INI',
    'all': 'LENGKAP'
  };

  return {
    period: periodLabels[period] || 'LENGKAP',
    data: reportData,
    totalHadir: filteredAttendance.length,
    totalAnggota: allMembers.length,
  };
}

function renderReport() {
  const resultContainer = document.getElementById("reportResult");
  if (!resultContainer) return;

  const report = generateDetailedReport();
  
  if (report.data.length === 0 || report.totalHadir === 0) {
    resultContainer.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-file-alt" style="font-size: 48px;"></i>
        <p>Belum ada data absensi untuk periode ini</p>
      </div>
    `;
    return;
  }

  const sortedData = [...report.data].sort((a, b) => b.totalHadir - a.totalHadir);

  resultContainer.innerHTML = `
    <div style="background: linear-gradient(135deg, #1a365d, #2b6cb0); color: white; padding: 16px; border-radius: 14px; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
        <div>
          <h3 style="font-size: 18px;"><i class="fas fa-calendar-alt"></i> LAPORAN ${report.period}</h3>
          <p style="font-size: 13px; opacity: 0.9;">${report.totalAnggota} Anggota Aktif | ${report.totalHadir} Total Absensi</p>
        </div>
        <div style="text-align: right;">
          <p style="font-size: 13px; opacity: 0.9;">Kegiatan: ${AppState.currentKegiatan}</p>
          <p style="font-size: 11px; opacity: 0.7;">Dicetak: ${formatDate()}</p>
        </div>
      </div>
    </div>

    <div style="overflow-x: auto;">
      <table class="data-table">
        <thead>
          <tr>
            <th>No</th>
            <th>Kode</th>
            <th>Nama</th>
            <th>Divisi</th>
            <th>Jabatan</th>
            <th>Hadir</th>
            <th>Tidak Hadir</th>
            <th>Kegiatan</th>
          </tr>
        </thead>
        <tbody>
          ${sortedData.map((item, index) => `
            <tr>
              <td>${index + 1}</td>
              <td><strong>${item.code}</strong></td>
              <td><strong>${item.name}</strong></td>
              <td>${item.division}</td>
              <td>${item.position || 'Anggota'}</td>
              <td><span class="status-badge status-active">${item.totalHadir} hari</span></td>
              <td><span class="status-badge ${item.totalTidakHadir > 0 ? 'status-passive' : 'status-active'}">${item.totalTidakHadir} hari</span></td>
              <td style="font-size: 11px;">${item.kegiatan.length > 0 ? item.kegiatan.join(', ') : '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div style="margin-top: 20px; display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; padding: 16px; background: #f7fafc; border-radius: 14px; border: 2px solid #e2e8f0;">
      <button class="btn btn-primary" onclick="exportReportPDF()" style="padding: 12px 28px; font-size: 14px; border-radius: 12px; min-width: 140px;">
        <i class="fas fa-file-pdf"></i> PDF
      </button>
      <button class="btn btn-success" onclick="exportReportExcel()" style="padding: 12px 28px; font-size: 14px; border-radius: 12px; min-width: 140px;">
        <i class="fas fa-file-excel"></i> Excel
      </button>
      <button class="btn" onclick="showWhatsAppModal()" style="padding: 12px 28px; font-size: 14px; border-radius: 12px; min-width: 140px; background: #25D366; color: white; border: none; cursor: pointer;">
        <i class="fab fa-whatsapp"></i> WhatsApp
      </button>
    </div>
  `;
}

// ==================== EXPORT LAPORAN ====================
function exportReportPDF() {
  const report = generateDetailedReport();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  
  doc.setFillColor(26, 54, 93);
  doc.rect(0, 0, 210, 45, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text('LAPORAN ABSENSI IRMANUFA', 105, 25, { align: 'center' });
  doc.setFontSize(11);
  doc.text(`Periode: ${report.period}`, 105, 35, { align: 'center' });
  doc.text(`Kegiatan: ${AppState.currentKegiatan}`, 105, 43, { align: 'center' });

  let y = 60;
  doc.setFillColor(43, 108, 176);
  doc.rect(10, y, 190, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  const headers = ['No', 'Kode', 'Nama', 'Divisi', 'Hadir', 'Tdk Hadir'];
  const positions = [15, 35, 65, 110, 150, 175];
  headers.forEach((h, i) => doc.text(h, positions[i], y + 5));

  y += 8;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(7);

  const sortedData = [...report.data].sort((a, b) => b.totalHadir - a.totalHadir);
  sortedData.forEach((item, i) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
      doc.setFillColor(43, 108, 176);
      doc.rect(10, y, 190, 8, 'F');
      doc.setTextColor(255, 255, 255);
      headers.forEach((h, j) => doc.text(h, positions[j], y + 5));
      y += 8;
      doc.setTextColor(0, 0, 0);
    }
    doc.text(`${i + 1}`, positions[0], y + 4);
    doc.text(item.code, positions[1], y + 4);
    doc.text(item.name.substring(0, 20), positions[2], y + 4);
    doc.text(item.division.substring(0, 15), positions[3], y + 4);
    doc.text(`${item.totalHadir}`, positions[4], y + 4);
    doc.text(`${item.totalTidakHadir}`, positions[5], y + 4);
    y += 6;
  });

  doc.setFillColor(26, 54, 93);
  doc.rect(0, 280, 210, 17, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.text(`Total: ${report.totalHadir} absensi | Dicetak: ${formatDate()}`, 105, 289, { align: 'center' });
  
  doc.save(`Laporan_${report.period}_${Date.now()}.pdf`);
  Toast.success('PDF laporan berhasil diunduh!');
}

function exportReportExcel() {
  const report = generateDetailedReport();
  const sortedData = [...report.data].sort((a, b) => b.totalHadir - a.totalHadir);
  
  const data = sortedData.map(item => ({
    Kode: item.code,
    Nama: item.name,
    Divisi: item.division,
    Jabatan: item.position || 'Anggota',
    Hadir: item.totalHadir,
    'Tidak Hadir': item.totalTidakHadir,
    Kegiatan: item.kegiatan.join(', ') || '-'
  }));

  if (data.length === 0) {
    Toast.warning('Tidak ada data untuk diexport!');
    return;
  }

  try {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, `Laporan ${report.period}`);
    XLSX.writeFile(wb, `Laporan_${report.period}_${Date.now()}.xlsx`);
    Toast.success('Excel laporan berhasil diunduh!');
  } catch (e) {
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(obj => headers.map(h => JSON.stringify(obj[h] || '')).join(','))
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_${report.period}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.success('CSV laporan berhasil diunduh!');
  }
}

// ==================== WHATSAPP ====================
function showWhatsAppModal() {
  const modal = document.createElement("div");
  modal.className = "modal-overlay whatsapp-modal";
  modal.innerHTML = `
    <div class="modal" style="max-width: 450px;">
      <div class="modal-header">
        <h3><i class="fab fa-whatsapp" style="color:#25D366;"></i> Kirim Laporan WA</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="input-group">
        <label>Nomor WhatsApp</label>
        <input type="tel" id="waNumber" placeholder="6281234567890">
        <small>Contoh: 6281234567890</small>
      </div>
      <div class="modal-buttons">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Batal</button>
        <button class="btn btn-success" onclick="sendWhatsAppReport()" style="background: #25D366; color: white;"><i class="fab fa-whatsapp"></i> Kirim</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function sendWhatsAppReport() {
  let phone = document.getElementById("waNumber")?.value.trim();
  if (!phone) { Toast.warning("Masukkan nomor WhatsApp!"); return; }

  phone = phone.replace(/[^0-9]/g, "");
  if (phone.startsWith("0")) phone = "62" + phone.substring(1);
  if (!phone.startsWith("62")) phone = "62" + phone;

  const report = generateDetailedReport();
  const sortedData = [...report.data].sort((a, b) => b.totalHadir - a.totalHadir);

  let msg = `📊 *LAPORAN ABSENSI IRMANUFA* 📊\n\n`;
  msg += `📅 *Periode:* ${report.period}\n`;
  msg += `📌 *Kegiatan:* ${AppState.currentKegiatan}\n`;
  msg += `👥 *Total Anggota:* ${report.totalAnggota}\n`;
  msg += `✅ *Total Absensi:* ${report.totalHadir}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `*DETAIL KEHADIRAN:*\n\n`;

  sortedData.forEach((item, i) => {
    const status = item.totalHadir > 0 ? '✅' : '❌';
    msg += `${i + 1}. ${status} *${item.name}*\n`;
    msg += `   📍 Divisi: ${item.division}\n`;
    msg += `   📊 Hadir: ${item.totalHadir} hari | Tidak: ${item.totalTidakHadir} hari\n`;
    if (item.kegiatan.length > 0) {
      msg += `   📌 Kegiatan: ${item.kegiatan.join(', ')}\n`;
    }
    msg += `\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `_Dikirim dari Sistem Absensi IRMANUFA_`;

  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  document.querySelector(".modal-overlay")?.remove();
  Toast.success("Membuka WhatsApp...");
}

// ==================== RESET ====================
function resetAllData() {
  showConfirmModal("Reset Data", "Hapus semua data absensi?", () => {
    AppState.attendance = [];
    saveAttendance();
    updateAllDisplays();
    renderTodayScanHistory();
    renderReport();
    Toast.success("Data absensi direset!");
  });
}

function resetMembersToDefault() {
  showConfirmModal("Reset Anggota", "Reset ke data default?", () => {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.MEMBERS);
    loadData(true);
    updateAllDisplays();
    updateMemberSelect();
    renderReport();
    Toast.success("Data anggota direset!");
  });
}

// ==================== NAVIGATION ====================
function toggleMenu() {
  document.querySelector(".sidebar")?.classList.toggle("active");
  document.querySelector(".sidebar-overlay")?.classList.toggle("active");
}

function closeMenu() {
  document.querySelector(".sidebar")?.classList.remove("active");
  document.querySelector(".sidebar-overlay")?.classList.remove("active");
}

function showSection(section) {
  AppState.activeSection = section;

  document.querySelectorAll(".menu-item").forEach((i) => {
    i.classList.remove("active");
    if (i.dataset.section === section) i.classList.add("active");
  });

  document.querySelectorAll(".content-section").forEach((s) => s.classList.remove("active"));
  document.getElementById(section + "Section")?.classList.add("active");

  if (section === "dashboard") {
    setTimeout(() => { updateCharts(); renderRecentAttendance(); renderTopMembers(); }, 100);
  }

  if (section === "members") {
    renderMemberTable();
  }

  if (section === "scanner") {
    renderTodayScanHistory();
    const r = document.getElementById("scanResult");
    if (r) r.style.display = "none";
    setTimeout(() => startScanner(), 500);
  }

  if (section === "reports") {
    const ki = document.getElementById("kegiatanName");
    if (ki) {
      ki.value = AppState.currentKegiatan;
      ki.addEventListener("change", (e) => saveKegiatan(e.target.value));
    }
    setTimeout(() => renderReport(), 200);
  }

  if (section === "generator") {
    updateMemberSelect();
    const qc = document.getElementById("qrCodeDisplay");
    if (qc) {
      qc.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-qrcode" style="font-size:80px;color:#a0aec0;"></i>
          <p>Pilih anggota dan klik Generate</p>
        </div>
      `;
    }
    const ic = document.getElementById("memberInfoDisplay");
    if (ic) {
      ic.innerHTML = `
        <div class="member-info-card">
          <h4>Informasi</h4>
          <p style="text-align:center;">Pilih anggota dan klik "Generate QR Code"</p>
        </div>
      `;
    }
  }

  closeMenu();
}

function logout() {
  showConfirmModal("Keluar", "Yakin ingin keluar?", () => {
    if (AppState.qrScanner) {
      AppState.qrScanner.stop();
      AppState.qrScanner = null;
    }
    localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_USER);
    location.reload();
  });
}

// ==================== LOGIN ====================
let selectedUser = "admin";

function selectUser(userId) {
  selectedUser = userId;
  document.querySelectorAll(".user-option").forEach((opt) => opt.classList.remove("active"));
  document.getElementById(`user-${userId}`).classList.add("active");
}

function handleLogin(e) {
  e.preventDefault();
  const pwd = document.getElementById("password").value;
  const user = CONFIG.USERS[selectedUser];

  if (user && pwd === user.password) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH, "true");
    localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_USER, JSON.stringify({ id: selectedUser, ...user }));
    renderDashboard();
    Toast.success(`Login berhasil! Selamat datang ${user.name}.`);
  } else {
    Toast.error("Password salah!");
  }
  return false;
}

function togglePassword() {
  const inp = document.getElementById("password");
  const icon = document.querySelector(".toggle-password i");
  if (inp.type === "password") {
    inp.type = "text";
    icon.classList.replace("fa-eye", "fa-eye-slash");
  } else {
    inp.type = "password";
    icon.classList.replace("fa-eye-slash", "fa-eye");
  }
}

// ==================== RENDER DASHBOARD ====================
function renderDashboard() {
  loadData(false);

  const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_USER);
  AppState.currentUser = stored ? JSON.parse(stored) : CONFIG.USERS.admin;

  const stats = getStats();
  const activeCount = AppState.members.filter(m => m.status === "active").length;
  const passiveCount = AppState.members.filter(m => m.status === "passive").length;
  const avatarFile = AppState.currentUser.avatar || "admin.png";

  document.getElementById("app").innerHTML = `
    <div class="dashboard">
      <nav class="navbar">
        <div class="nav-content">
          <div class="nav-brand">
            <div class="logo-icon">
              <img src="logo.png" alt="Logo" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
              <i class="fas fa-mosque" style="display:none;"></i>
            </div>
            <div>
              <h1>IRMANUFA QR Absensi</h1>
              <small>Kabinet Golden Generation 2027-2029</small>
            </div>
          </div>
          <div class="nav-stats">
            <span class="stat-badge blue"><i class="fas fa-users"></i> ${activeCount} Aktif</span>
            <span class="stat-badge green"><i class="fas fa-calendar-check"></i> ${stats.todayCount} Hadir</span>
            <span class="stat-badge red"><i class="fas fa-user-clock"></i> ${passiveCount} Pasif</span>
          </div>
          <button class="hamburger-btn" onclick="toggleMenu()"><i class="fas fa-bars"></i></button>
        </div>
      </nav>

      <div class="sidebar">
        <div class="sidebar-header">
          <div class="user-avatar">
            <img src="${avatarFile}" alt="${AppState.currentUser.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
            <i class="fas fa-user-circle" style="display:none;"></i>
          </div>
          <div class="user-info">
            <h3>${AppState.currentUser.name}</h3>
            <p>${AppState.currentUser.role}</p>
            <div class="user-badge"><i class="fas fa-shield-alt"></i> ${AppState.currentUser.role === "Super Admin" ? "Super Admin" : "Sekretariat"}</div>
          </div>
        </div>
        <div class="sidebar-menu">
          <a href="#" class="menu-item active" data-section="dashboard" onclick="showSection('dashboard')"><i class="fas fa-home"></i><span>Dashboard</span></a>
          <a href="#" class="menu-item" data-section="scanner" onclick="showSection('scanner')"><i class="fas fa-qrcode"></i><span>Scan QR Code</span><span class="menu-badge">Live</span></a>
          <a href="#" class="menu-item" data-section="generator" onclick="showSection('generator')"><i class="fas fa-print"></i><span>Cetak QR Code</span></a>
          <a href="#" class="menu-item" data-section="members" onclick="showSection('members')"><i class="fas fa-users"></i><span>Data Anggota</span></a>
          <a href="#" class="menu-item" data-section="reports" onclick="showSection('reports')"><i class="fas fa-chart-line"></i><span>Laporan</span></a>
          <a href="#" class="menu-item" onclick="logout()"><i class="fas fa-sign-out-alt"></i><span>Keluar</span></a>
        </div>
      </div>
      <div class="sidebar-overlay" onclick="closeMenu()"></div>

      <div class="main-content">
        <div class="welcome-card">
          <div class="welcome-text">
            <h2>Selamat Datang, ${AppState.currentUser.name.split(" ")[0]}!</h2>
            <p>Sistem Absensi Digital IRMANUFA</p>
            <small><i class="fas fa-qrcode"></i> Scan QR Code | <i class="fas fa-check-circle"></i> Hanya anggota AKTIF</small>
          </div>
          <div class="date-info">
            <div class="time" id="currentTime">${formatTime()}</div>
            <div class="date" id="currentDate">${formatDate()}</div>
          </div>
        </div>

        <section id="dashboardSection" class="content-section active">
          <div class="stats-grid">
            <div class="stat-card" onclick="showStatsDetail('active')" style="cursor: pointer;">
              <div class="stat-icon"><i class="fas fa-users"></i></div>
              <div class="stat-number" id="activeMembers">${stats.activeMembers}</div>
              <div class="stat-label">Anggota Aktif <i class="fas fa-chevron-right" style="font-size: 10px; color: #2b6cb0;"></i></div>
            </div>
            <div class="stat-card" onclick="showStatsDetail('today')" style="cursor: pointer;">
              <div class="stat-icon"><i class="fas fa-calendar-day"></i></div>
              <div class="stat-number" id="todayCount">${stats.todayCount}</div>
              <div class="stat-label">Hadir Hari Ini <i class="fas fa-chevron-right" style="font-size: 10px; color: #276749;"></i></div>
            </div>
            <div class="stat-card" onclick="showStatsDetail('passive')" style="cursor: pointer;">
              <div class="stat-icon"><i class="fas fa-user-clock"></i></div>
              <div class="stat-number">${passiveCount}</div>
              <div class="stat-label">Anggota Pasif <i class="fas fa-chevron-right" style="font-size: 10px; color: #c53030;"></i></div>
            </div>
            <div class="stat-card" onclick="showStatsDetail('total')" style="cursor: pointer;">
              <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
              <div class="stat-number" id="totalAttendance">${stats.totalAttendance}</div>
              <div class="stat-label">Total Absensi <i class="fas fa-chevron-right" style="font-size: 10px; color: #1a365d;"></i></div>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><i class="fas fa-chart-line"></i><h3>Tren Absensi 7 Hari</h3></div>
            <div class="chart-wrapper"><canvas id="attendanceChart"></canvas></div>
          </div>

          <div class="card">
            <div class="card-header"><i class="fas fa-chart-pie"></i><h3>Kehadiran per Divisi</h3><small>(Persentase hari ini)</small></div>
            <div class="chart-wrapper"><canvas id="divisionChart"></canvas></div>
          </div>

          <div class="card">
            <div class="card-header"><i class="fas fa-trophy"></i><h3>Top 5 Terrajin</h3></div>
            <div id="topMembersList" class="ranking-list"></div>
          </div>

          <div class="card">
            <div class="card-header"><i class="fas fa-history"></i><h3>Absensi Terbaru</h3></div>
            <div id="recentAttendanceList" class="ranking-list"></div>
          </div>
        </section>

        <section id="scannerSection" class="content-section">
          <div class="card">
            <div class="card-header">
              <i class="fas fa-qrcode"></i>
              <h3>Scan QR Code</h3>
              <small>Arahkan kamera ke QR Code anggota</small>
            </div>
            <div class="scanner-header">
              <button id="flashToggleBtn" class="flash-btn" onclick="toggleFlash()"><i class="fas fa-lightbulb"></i> Flash OFF</button>
            </div>
            <div class="scanner-container">
              <div id="reader" class="empty-state">
                <i class="fas fa-camera" style="font-size:48px;"></i>
                <p>Scanner siap. Klik "Mulai Scan"</p>
                <button class="btn btn-primary" onclick="startScanner()">Mulai Scan</button>
              </div>
            </div>
            <div id="scanResult" class="scan-result" style="display:none;"></div>
            <div class="action-buttons">
              <button class="btn btn-primary" onclick="startScanner()"><i class="fas fa-play"></i> Mulai Scan</button>
              <button class="btn btn-danger" onclick="stopScanner()"><i class="fas fa-stop"></i> Hentikan</button>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <i class="fas fa-table"></i>
              <h3>Hasil Scan Hari Ini</h3>
              <small>Klik Edit/Hapus untuk mengubah data</small>
            </div>
            <div id="todayScanHistory"></div>
          </div>

          <div class="info-card">
            <i class="fas fa-info-circle"></i> <strong>Cara Penggunaan:</strong>
            <ol>
              <li>Klik "Mulai Scan" → Izin kamera otomatis</li>
              <li>Arahkan kamera ke QR Code anggota</li>
              <li>Suara unik untuk setiap status</li>
              <li>Edit/Hapus data di tabel hasil scan</li>
            </ol>
          </div>
        </section>

        <section id="generatorSection" class="content-section">
          <div class="card">
            <div class="card-header">
              <i class="fas fa-print"></i>
              <h3>Cetak QR Code</h3>
              <small>Pilih anggota aktif untuk generate QR Code HD</small>
            </div>
            <div class="qr-generator-grid">
              <div>
                <div class="qr-display" id="qrCodeDisplay">
                  <i class="fas fa-qrcode" style="font-size:80px;color:#a0aec0;"></i>
                  <p>Pilih anggota dan klik Generate</p>
                </div>
                <div class="download-buttons">
                  <button class="btn btn-primary" onclick="downloadQRAsPNG()"><i class="fas fa-image"></i> PNG HD</button>
                  <button class="btn btn-success" onclick="downloadQRAsPDF()"><i class="fas fa-file-pdf"></i> PDF</button>
                </div>
              </div>
              <div>
                <select id="memberSelect" style="width:100%;padding:14px;border-radius:14px;border:2px solid #e2e8f0;">
                  <option value="">✨-- Pilih Anggota Aktif --✨</option>
                </select>
                <button class="btn btn-primary" style="width:100%;margin-top:16px;" onclick="generateMemberQR()">
                  <i class="fas fa-qrcode"></i> Generate QR Code
                </button>
                <div id="memberInfoDisplay" class="member-info-card" style="margin-top:16px;">
                  <h4><i class="fas fa-info-circle"></i> Informasi</h4>
                  <p style="text-align:center;">Pilih anggota dan klik "Generate QR Code"</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="membersSection" class="content-section">
          <div class="card">
            <div class="card-header">
              <i class="fas fa-users"></i>
              <h3>Data Anggota</h3>
              <small>Total: ${AppState.members.length} (${activeCount} Aktif, ${passiveCount} Pasif)</small>
              <div style="margin-left:auto;display:flex;gap:8px;">
                <button class="btn btn-secondary btn-sm" onclick="resetMembersToDefault()"><i class="fas fa-undo"></i> Reset</button>
                <button class="btn btn-primary btn-sm" onclick="showAddMemberModal()"><i class="fas fa-plus"></i> Tambah</button>
              </div>
            </div>
            <div class="search-box">
              <input type="text" id="memberSearch" placeholder="Cari nama / kode / divisi..." onkeyup="renderMemberTable(this.value)">
            </div>
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Nama</th>
                    <th>Divisi</th>
                    <th>Jabatan</th>
                    <th>Status</th>
                    <th>Hari Ini</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody id="memberTableBody"></tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="reportsSection" class="content-section">
          <div class="card">
            <div class="card-header">
              <i class="fas fa-chart-line"></i>
              <h3>Laporan Absensi</h3>
            </div>
            <div class="kegiatan-input">
              <label><i class="fas fa-tag"></i> Nama Kegiatan</label>
              <input type="text" id="kegiatanName" value="${AppState.currentKegiatan}">
            </div>
            <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
              <select id="reportPeriod" style="padding: 10px 14px; border-radius: 12px; border: 2px solid #e2e8f0; font-family: inherit; flex: 1; min-width: 150px;" onchange="renderReport()">
                <option value="today">📅 Hari Ini</option>
                <option value="week">📅 Minggu Ini</option>
                <option value="month">📅 Bulan Ini</option>
                <option value="year">📅 Tahun Ini</option>
                <option value="all" selected>📅 Lengkap</option>
              </select>
            </div>
            <div id="reportResult"></div>
            <div class="action-buttons">
              <button class="btn btn-danger" onclick="resetAllData()"><i class="fas fa-trash"></i> Reset Absensi</button>
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon"><i class="fas fa-database"></i></div>
              <div class="stat-number">${AppState.attendance.length}</div>
              <div class="stat-label">Total Data Absensi</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon"><i class="fas fa-qrcode"></i></div>
              <div class="stat-number">${AppState.attendance.filter((a) => a.method === "qr").length}</div>
              <div class="stat-label">Scan QR Code</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon"><i class="fas fa-user-check"></i></div>
              <div class="stat-number">${new Set(AppState.attendance.map((a) => a.memberId)).size}</div>
              <div class="stat-label">Anggota Pernah Absen</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;

  updateAllDisplays();
  updateMemberSelect();
  renderTodayScanHistory();
  renderReport();

  const ki = document.getElementById("kegiatanName");
  if (ki) {
    ki.value = AppState.currentKegiatan;
    ki.addEventListener("change", (e) => saveKegiatan(e.target.value));
  }

  setInterval(() => {
    const t = document.getElementById("currentTime");
    const d = document.getElementById("currentDate");
    if (t) t.textContent = formatTime();
    if (d) d.textContent = formatDate();
  }, 1000);

  setTimeout(() => {
    const scannerSection = document.getElementById("scannerSection");
    if (scannerSection && scannerSection.classList.contains("active")) {
      startScanner();
    }
  }, 1000);
}

// ==================== LOGIN PAGE ====================
function renderLoginPage() {
  document.getElementById("app").innerHTML = `
    <div class="login-container">
      <div class="login-card">
        <div class="login-logo">
          <div class="logo-icon">
            <img src="logo.png" alt="Logo IRMANUFA" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
            <i class="fas fa-mosque" style="display:none;"></i>
          </div>
          <h1>IRMANUFA QR Absensi</h1>
          <p>Sistem Absensi Digital Berbasis QR Code</p>
        </div>

        <div class="user-selector">
          <div id="user-admin" class="user-option active" onclick="selectUser('admin')">
            <img src="admin.png" class="user-photo" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27100%27 height=%27100%27%3E%3Crect width=%27100%27 height=%27100%27 fill=%27%232b6cb0%27/%3E%3Ctext x=%2750%27 y=%2765%27 text-anchor=%27middle%27 fill=%27white%27 font-size=%2745%27%3E👤%3C/text%3E%3C/svg%3E'">
            <div class="user-name">Admin</div>
            <div class="user-role">Super Admin</div>
          </div>
          <div id="user-tasya" class="user-option" onclick="selectUser('tasya')">
            <img src="tasya.png" class="user-photo" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27100%27 height=%27100%27%3E%3Crect width=%27100%27 height=%27100%27 fill=%27%232b6cb0%27/%3E%3Ctext x=%2750%27 y=%2765%27 text-anchor=%27middle%27 fill=%27white%27 font-size=%2745%27%3E👩%3C/text%3E%3C/svg%3E'">
            <div class="user-name">Tasya</div>
            <div class="user-role">Sekretaris I</div>
          </div>
          <div id="user-lidya" class="user-option" onclick="selectUser('lidya')">
            <img src="lidya.png" class="user-photo" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27100%27 height=%27100%27%3E%3Crect width=%27100%27 height=%27100%27 fill=%27%232b6cb0%27/%3E%3Ctext x=%2750%27 y=%2765%27 text-anchor=%27middle%27 fill=%27white%27 font-size=%2745%27%3E👩%3C/text%3E%3C/svg%3E'">
            <div class="user-name">Lidya</div>
            <div class="user-role">Sekretaris II</div>
          </div>
        </div>

        <form onsubmit="return handleLogin(event)">
          <div class="input-group">
            <label><i class="fas fa-lock"></i> Password</label>
            <div class="password-container">
              <input type="password" id="password" placeholder="Masukkan password" required>
              <button type="button" class="toggle-password" onclick="togglePassword()"><i class="fas fa-eye"></i></button>
            </div>
          </div>

          <div class="features">
            <div class="feature"><i class="fas fa-qrcode"></i><span>Scan QR Code</span></div>
            <div class="feature"><i class="fas fa-chart-line"></i><span>Real-time Update</span></div>
            <div class="feature"><i class="fas fa-trophy"></i><span>Ranking Anggota</span></div>
            <div class="feature"><i class="fas fa-file-pdf"></i><span>Laporan PDF/Excel/WA</span></div>
          </div>

          <button type="submit" class="login-btn">
            <i class="fas fa-sign-in-alt"></i> MASUK
          </button>
        </form>

        <div class="login-footer">
          <p>IRMANUFA Kabinet Golden Generation 2027-2029</p>
          <p style="font-size:10px;margin-top:8px;color:#718096;">Password: admin123 | tasya123 | lidya123</p>
        </div>
      </div>
    </div>
  `;
}

// ==================== STATS DETAIL POPUP ====================
function showStatsDetail(type) {
  const stats = getStats();
  const activeMembers = AppState.members.filter(m => m.status === "active");
  const passiveMembers = AppState.members.filter(m => m.status === "passive");
  const todayAttendance = getTodayAttendance();
  
  let title = "";
  let icon = "";
  let content = "";
  let color = "";
  
  switch(type) {
    case 'active':
      title = "📋 Daftar Anggota Aktif";
      icon = "fa-users";
      color = "#2b6cb0";
      content = `
        <div style="margin-bottom: 12px;">
          <span style="font-size: 14px; color: #4a5568;">Total: <strong style="color: #2b6cb0; font-size: 18px;">${activeMembers.length}</strong> anggota</span>
        </div>
        <div style="max-height: 350px; overflow-y: auto;">
          ${activeMembers.map((m, i) => `
            <div style="display: flex; align-items: center; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; gap: 10px;">
              <span style="background: #2b6cb0; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; flex-shrink: 0;">${i + 1}</span>
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; font-size: 13px; color: #1a365d;">${m.name}</div>
                <div style="font-size: 11px; color: #4a5568;">${m.code} • ${m.division}</div>
              </div>
              <span style="font-size: 10px; background: #f0fff4; color: #276749; padding: 2px 10px; border-radius: 20px; flex-shrink: 0;">${m.position || 'Anggota'}</span>
            </div>
          `).join('')}
        </div>
      `;
      break;
      
    case 'today':
      title = "📊 Kehadiran Hari Ini";
      icon = "fa-calendar-check";
      color = "#276749";
      const totalActive = activeMembers.length;
      const hadirCount = todayAttendance.length;
      const persentase = totalActive > 0 ? Math.round((hadirCount / totalActive) * 100) : 0;
      const belumHadir = activeMembers.filter(m => !todayAttendance.some(a => a.memberId === m.id));
      
      content = `
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 16px;">
          <div style="background: #f0fff4; padding: 12px; border-radius: 12px; text-align: center;">
            <div style="font-size: 20px; font-weight: 700; color: #276749;">${hadirCount}</div>
            <div style="font-size: 10px; color: #4a5568;">✅ Hadir</div>
          </div>
          <div style="background: #fff5f5; padding: 12px; border-radius: 12px; text-align: center;">
            <div style="font-size: 20px; font-weight: 700; color: #c53030;">${belumHadir.length}</div>
            <div style="font-size: 10px; color: #4a5568;">❌ Belum</div>
          </div>
          <div style="background: #ebf8ff; padding: 12px; border-radius: 12px; text-align: center;">
            <div style="font-size: 20px; font-weight: 700; color: #2b6cb0;">${persentase}%</div>
            <div style="font-size: 10px; color: #4a5568;">📈 Persentase</div>
          </div>
        </div>
        <div style="max-height: 250px; overflow-y: auto;">
          <div style="font-weight: 600; font-size: 12px; color: #4a5568; margin-bottom: 8px;">📌 Daftar Hadir:</div>
          ${todayAttendance.length > 0 ? todayAttendance.map((a, i) => `
            <div style="display: flex; align-items: center; padding: 6px 12px; border-bottom: 1px solid #e2e8f0; gap: 10px;">
              <span style="background: #276749; color: white; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0;">${i + 1}</span>
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 500; font-size: 13px; color: #1a365d;">${a.memberName}</div>
                <div style="font-size: 10px; color: #4a5568;">${a.division} • ${a.time}</div>
              </div>
              <span style="font-size: 10px; background: #f0fff4; color: #276749; padding: 2px 8px; border-radius: 20px; flex-shrink: 0;">✓</span>
            </div>
          `).join('') : '<div style="text-align: center; padding: 20px; color: #4a5568;">Belum ada yang absen hari ini</div>'}
        </div>
        ${belumHadir.length > 0 ? `
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
            <div style="font-weight: 600; font-size: 12px; color: #c53030;">⚠️ Belum Absen (${belumHadir.length}):</div>
            <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">
              ${belumHadir.map(m => `<span style="font-size: 10px; background: #fff5f5; color: #c53030; padding: 2px 8px; border-radius: 12px;">${m.name}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      `;
      break;
      
    case 'passive':
      title = "📋 Daftar Anggota Pasif";
      icon = "fa-user-clock";
      color = "#c53030";
      content = `
        <div style="margin-bottom: 12px;">
          <span style="font-size: 14px; color: #4a5568;">Total: <strong style="color: #c53030; font-size: 18px;">${passiveMembers.length}</strong> anggota</span>
          <span style="font-size: 11px; color: #718096; margin-left: 8px;">(Tidak dapat melakukan absensi)</span>
        </div>
        <div style="max-height: 350px; overflow-y: auto;">
          ${passiveMembers.map((m, i) => `
            <div style="display: flex; align-items: center; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; gap: 10px;">
              <span style="background: #c53030; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; flex-shrink: 0;">${i + 1}</span>
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; font-size: 13px; color: #1a365d;">${m.name}</div>
                <div style="font-size: 11px; color: #4a5568;">${m.code} • ${m.division}</div>
              </div>
              <span style="font-size: 10px; background: #fff5f5; color: #c53030; padding: 2px 10px; border-radius: 20px; flex-shrink: 0;">${m.position || 'Anggota'}</span>
            </div>
          `).join('')}
        </div>
      `;
      break;
      
    case 'total':
      title = "📊 Total Keseluruhan";
      icon = "fa-chart-line";
      color = "#1a365d";
      const totalAnggota = AppState.members.length;
      const hadirPernah = new Set(AppState.attendance.map(a => a.memberId)).size;
      
      content = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
          <div style="background: #ebf8ff; padding: 14px; border-radius: 12px; text-align: center;">
            <div style="font-size: 22px; font-weight: 700; color: #2b6cb0;">${totalAnggota}</div>
            <div style="font-size: 10px; color: #4a5568;">Total Anggota</div>
          </div>
          <div style="background: #f0fff4; padding: 14px; border-radius: 12px; text-align: center;">
            <div style="font-size: 22px; font-weight: 700; color: #276749;">${stats.activeMembers}</div>
            <div style="font-size: 10px; color: #4a5568;">✅ Aktif</div>
          </div>
          <div style="background: #fff5f5; padding: 14px; border-radius: 12px; text-align: center;">
            <div style="font-size: 22px; font-weight: 700; color: #c53030;">${stats.passiveMembers}</div>
            <div style="font-size: 10px; color: #4a5568;">❌ Pasif</div>
          </div>
          <div style="background: #fef3c7; padding: 14px; border-radius: 12px; text-align: center;">
            <div style="font-size: 22px; font-weight: 700; color: #d69e2e;">${stats.totalAttendance}</div>
            <div style="font-size: 10px; color: #4a5568;">Total Absensi</div>
          </div>
        </div>
        <div style="background: #f7fafc; padding: 12px; border-radius: 12px;">
          <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; border-bottom: 1px solid #e2e8f0;">
            <span>📅 Pernah Absen</span>
            <span><strong>${hadirPernah}</strong> anggota</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; border-bottom: 1px solid #e2e8f0;">
            <span>📌 Hari Ini</span>
            <span><strong>${stats.todayCount}</strong> orang</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0;">
            <span>📊 Rata-rata per hari</span>
            <span><strong>${stats.totalAttendance > 0 ? Math.round(stats.totalAttendance / new Set(AppState.attendance.map(a => a.dateShort)).size) : 0}</strong> orang</span>
          </div>
        </div>
      `;
      break;
  }

  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.zIndex = "9999";
  modal.innerHTML = `
    <div class="modal" style="max-width: 500px; width: 92%; max-height: 85vh; padding: 20px; border-radius: 20px; animation: fadeIn 0.3s ease; background: white; overflow: hidden; display: flex; flex-direction: column;">
      <div class="modal-header" style="border-bottom: 2px solid ${color}; padding-bottom: 12px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
        <h3 style="font-size: 18px; color: ${color}; margin: 0;">
          <i class="fas ${icon}" style="margin-right: 10px;"></i> ${title}
        </h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #4a5568;">&times;</button>
      </div>
      <div style="flex: 1; overflow-y: auto; padding: 4px 0; margin-top: 12px;">
        ${content}
      </div>
      <div class="modal-buttons" style="border-top: 1px solid #e2e8f0; padding-top: 12px; flex-shrink: 0; display: flex; justify-content: flex-end;">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="padding: 8px 20px;">Tutup</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// ==================== EXPOSE GLOBALS ====================
window.startScanner = startScanner;
window.stopScanner = stopScanner;
window.toggleFlash = toggleFlash;
window.generateMemberQR = generateMemberQR;
window.downloadQRAsPNG = downloadQRAsPNG;
window.downloadQRAsPDF = downloadQRAsPDF;
window.showAddMemberModal = showAddMemberModal;
window.showEditMemberModal = showEditMemberModal;
window.updateExistingMember = updateExistingMember;
window.saveNewMember = saveNewMember;
window.showDeleteConfirmModal = showDeleteConfirmModal;
window.confirmDeleteMember = confirmDeleteMember;
window.renderReport = renderReport;
window.exportReportPDF = exportReportPDF;
window.exportReportExcel = exportReportExcel;
window.showWhatsAppModal = showWhatsAppModal;
window.sendWhatsAppReport = sendWhatsAppReport;
window.resetAllData = resetAllData;
window.resetMembersToDefault = resetMembersToDefault;
window.showStatsDetail = showStatsDetail;
window.toggleMenu = toggleMenu;
window.closeMenu = closeMenu;
window.showSection = showSection;
window.logout = logout;
window.handleLogin = handleLogin;
window.togglePassword = togglePassword;
window.selectUser = selectUser;
window.renderMemberTable = renderMemberTable;
window.editAttendanceById = editAttendanceById;
window.deleteAttendanceById = deleteAttendanceById;
window.recordAttendance = recordAttendance;

// ==================== INIT ====================
document.addEventListener("DOMContentLoaded", () => {
  preloadSounds();

  const isLoggedIn = localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH) === "true";
  if (!isLoggedIn) {
    renderLoginPage();
  } else {
    renderDashboard();
  }
});