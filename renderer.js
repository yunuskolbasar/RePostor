const { ipcRenderer, remote } = require("electron");

const accountUrlInput = document.getElementById("accountUrl");
const bufferEmailInput = document.getElementById("bufferEmail");
const bufferPasswordInput = document.getElementById("bufferPassword");
const saveCredentialsCheckbox = document.getElementById("saveCredentials");
const startButton = document.getElementById("startBtn");
const statusLog = document.getElementById("statusLog");

const themeLightRadio = document.getElementById("theme-light");
const themeDarkRadio = document.getElementById("theme-dark");
const headlessModeCheckbox = document.getElementById("headless-mode");
const pageTimeoutInput = document.getElementById("page-timeout");
const elementTimeoutInput = document.getElementById("element-timeout");
const autoPublishCheckbox = document.getElementById("auto-publish");
const clearDataButton = document.getElementById("clearDataBtn");
const saveSettingsButton = document.getElementById("saveSettingsBtn");

const minimizeBtn = document.getElementById("minimizeBtn");
const closeBtn = document.getElementById("closeBtn");
const menuItems = document.querySelectorAll(".menu-item");
const pages = document.querySelectorAll(".page");

const defaultSettings = {
  theme: "light",
  headlessMode: false,
  pageTimeout: 30,
  elementTimeout: 10,
  autoPublish: false,
};

let currentSettings = { ...defaultSettings };

minimizeBtn.addEventListener("click", () => {
  ipcRenderer.send("minimize-window");
});

closeBtn.addEventListener("click", () => {
  ipcRenderer.send("close-window");
});

function navigateToPage(pageId) {
  pages.forEach((page) => {
    if (page.id === pageId + "-page") {
      page.classList.add("active");
    } else {
      page.classList.remove("active");
    }
  });

  menuItems.forEach((item) => {
    if (item.dataset.page === pageId) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });
}

menuItems.forEach((item) => {
  item.addEventListener("click", () => {
    const pageId = item.dataset.page;
    navigateToPage(pageId);
  });
});

document.addEventListener("DOMContentLoaded", () => {
  ipcRenderer.send("get-saved-credentials");

  ipcRenderer.send("get-settings");

  setTimeout(() => {
    accountUrlInput.focus();
  }, 300);
});

ipcRenderer.on("settings-loaded", (event, settings) => {
  if (settings) {
    currentSettings = { ...defaultSettings, ...settings };
    updateSettingsUI();
  }
});

function updateSettingsUI() {
  if (currentSettings.theme === "dark") {
    themeDarkRadio.checked = true;
  } else {
    themeLightRadio.checked = true;
  }

  headlessModeCheckbox.checked = currentSettings.headlessMode;
  pageTimeoutInput.value = currentSettings.pageTimeout;
  elementTimeoutInput.value = currentSettings.elementTimeout;
  autoPublishCheckbox.checked = currentSettings.autoPublish;
}

saveSettingsButton.addEventListener("click", () => {
  const theme = themeDarkRadio.checked ? "dark" : "light";
  const headlessMode = headlessModeCheckbox.checked;
  const pageTimeout = parseInt(pageTimeoutInput.value);
  const elementTimeout = parseInt(elementTimeoutInput.value);
  const autoPublish = autoPublishCheckbox.checked;

  const validPageTimeout = isNaN(pageTimeout)
    ? defaultSettings.pageTimeout
    : pageTimeout;
  const validElementTimeout = isNaN(elementTimeout)
    ? defaultSettings.elementTimeout
    : elementTimeout;

  const updatedSettings = {
    theme,
    headlessMode,
    pageTimeout: validPageTimeout,
    elementTimeout: validElementTimeout,
    autoPublish,
  };

  ipcRenderer.send("save-settings", updatedSettings);
  currentSettings = updatedSettings;

  applyTheme(theme);

  addStatusMessage("Ayarlar başarıyla kaydedildi", "success");
});

function applyTheme(theme) {}

clearDataButton.addEventListener("click", () => {
  if (
    confirm(
      "Tüm kaydedilmiş veriler silinecektir. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?"
    )
  ) {
    ipcRenderer.send("clear-all-data");

    navigateToPage("home");

    addStatusMessage("Tüm veriler başarıyla temizlendi", "success");
  }
});

ipcRenderer.on("saved-credentials", (event, data) => {
  if (data) {
    accountUrlInput.value = data.accountUrl || "";
    bufferEmailInput.value = data.bufferEmail || "";
    bufferPasswordInput.value = data.bufferPassword || "";
    saveCredentialsCheckbox.checked = true;
  }
});

// Durum güncellemesi ve buton durumu için tek bir fonksiyon
function handleStatusUpdate(message) {
  // Durum mesajını ekle
  const statusEntry = document.createElement("div");
  statusEntry.className = "status-entry";

  if (message.includes("Hata")) {
    statusEntry.classList.add("status-error");
  } else if (message.includes("tamamlandı") || message.includes("kaydedildi")) {
    statusEntry.classList.add("status-success");
  }

  const timestamp = new Date().toLocaleTimeString();
  statusEntry.textContent = `[${timestamp}] ${message}`;

  statusLog.appendChild(statusEntry);
  statusLog.scrollTop = statusLog.scrollHeight;

  // İşlem bittiğinde butonu etkinleştir
  if (
    message.includes("İşlem tamamlandı") ||
    message.includes("Hata oluştu") ||
    message.includes("işlem iptal edildi")
  ) {
    startButton.disabled = false;
    startButton.innerHTML = '<i class="fa-solid fa-play"></i> İşlemi Başlat';
    console.log("İşlem sonlandı, buton etkinleştirildi:", message);
  }
}

// Tek bir olay dinleyicisi ekle
ipcRenderer.on("update-status", (event, message) => {
  handleStatusUpdate(message);
});

const handleEnterKey = (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    startButton.click();
  }
};

accountUrlInput.addEventListener("keydown", handleEnterKey);
bufferEmailInput.addEventListener("keydown", handleEnterKey);
bufferPasswordInput.addEventListener("keydown", handleEnterKey);

startButton.addEventListener("click", () => {
  const accountUrl = accountUrlInput.value.trim();
  const bufferEmail = bufferEmailInput.value.trim();
  const bufferPassword = bufferPasswordInput.value.trim();
  const saveCredentials = saveCredentialsCheckbox.checked;

  if (!accountUrl) {
    addStatusMessage("Hata: Hesap URL'si boş olamaz!");
    accountUrlInput.focus();
    return;
  }

  if (!bufferEmail) {
    addStatusMessage("Hata: Buffer e-posta adresi boş olamaz!");
    bufferEmailInput.focus();
    return;
  }

  if (!bufferPassword) {
    addStatusMessage("Hata: Buffer şifresi boş olamaz!");
    bufferPasswordInput.focus();
    return;
  }

  statusLog.innerHTML = "";

  if (saveCredentials) {
    ipcRenderer.send("save-credentials", {
      accountUrl,
      bufferEmail,
      bufferPassword,
    });
  } else {
    ipcRenderer.send("clear-credentials");
  }

  ipcRenderer.send("start-process", {
    accountUrl,
    bufferEmail,
    bufferPassword,
    settings: currentSettings,
  });

  startButton.disabled = true;
  startButton.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> İşlem Devam Ediyor...';
});

function addStatusMessage(message, type = null) {
  const statusEntry = document.createElement("div");
  statusEntry.className = "status-entry";

  if (message.includes("Hata") || type === "error") {
    statusEntry.classList.add("status-error");
  } else if (type === "success") {
    statusEntry.classList.add("status-success");
  }

  const timestamp = new Date().toLocaleTimeString();
  statusEntry.textContent = `[${timestamp}] ${message}`;

  statusLog.appendChild(statusEntry);
  statusLog.scrollTop = statusLog.scrollHeight;
}
