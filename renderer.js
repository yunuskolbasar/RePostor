const { ipcRenderer, remote } = require("electron");
const translations = require("./src/translations");

const accountUrlInput = document.getElementById("accountUrl");
const bufferEmailInput = document.getElementById("bufferEmail");
const bufferPasswordInput = document.getElementById("bufferPassword");
const saveCredentialsCheckbox = document.getElementById("saveCredentials");
const translateSelect = document.getElementById("translateOption");
// Paylaşım seçenekleri için radio buttonlar
const publishOptionDraftRadio = document.getElementById("publish-option-draft");
const publishOptionDirectRadio = document.getElementById("publish-option-direct");
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

// Dil değiştirme düğmeleri
const langTrBtn = document.getElementById("langTr");
const langEnBtn = document.getElementById("langEn");

const defaultSettings = {
  theme: "light",
  headlessMode: false,
  pageTimeout: 30,
  elementTimeout: 10,
  autoPublish: false,
  language: "tr",  // Varsayılan dil Türkçe
  translateTo: "none" // Varsayılan olarak çeviri yapılmaz
};

let currentSettings = { ...defaultSettings };
let currentLanguage = "tr"; // Varsayılan dil

// Dil değiştirme butonları için olay dinleyicileri
langTrBtn.addEventListener("click", () => {
  changeLanguage("tr");
});

langEnBtn.addEventListener("click", () => {
  changeLanguage("en");
});

// Dil değiştirme fonksiyonu
function changeLanguage(lang) {
  currentLanguage = lang;
  
  // Dil butonları durumunu güncelle
  langTrBtn.classList.toggle("active", lang === "tr");
  langEnBtn.classList.toggle("active", lang === "en");
  
  // Sayfa dilini güncelle
  updatePageLanguage();
  
  // Ayarları güncelle ve kaydet
  currentSettings.language = lang;
  ipcRenderer.send("save-settings", currentSettings);
}

// Sayfa dilini güncelleme fonksiyonu
function updatePageLanguage() {
  const elements = document.querySelectorAll("[data-i18n]");
  const placeholders = document.querySelectorAll("[data-i18n-placeholder]");
  
  // Metin içeriği olan elementleri güncelle
  elements.forEach(element => {
    const key = element.getAttribute("data-i18n");
    if (translations[currentLanguage][key]) {
      element.textContent = translations[currentLanguage][key];
    }
  });
  
  // Placeholder özelliği olan elementleri güncelle
  placeholders.forEach(element => {
    const key = element.getAttribute("data-i18n-placeholder");
    if (translations[currentLanguage][key]) {
      element.placeholder = translations[currentLanguage][key];
    }
  });
  
  // Belge başlığını güncelle
  document.title = translations[currentLanguage].appTitle;
}

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

  // Çeviri seçeneği değiştiğinde ayarları güncelle
  translateSelect.addEventListener("change", () => {
    currentSettings.translateTo = translateSelect.value;
    ipcRenderer.send("save-settings", currentSettings);
  });

  // Paylaşım seçeneği değiştiğinde ayarları güncelle
  publishOptionDraftRadio.addEventListener("change", () => {
    if (publishOptionDraftRadio.checked) {
      currentSettings.autoPublish = false;
      autoPublishCheckbox.checked = false;
      ipcRenderer.send("save-settings", currentSettings);
    }
  });

  publishOptionDirectRadio.addEventListener("change", () => {
    if (publishOptionDirectRadio.checked) {
      currentSettings.autoPublish = true;
      autoPublishCheckbox.checked = true;
      ipcRenderer.send("save-settings", currentSettings);
    }
  });

  // Ayarlar sayfasındaki otomatik paylaşım checkboxu değiştiğinde 
  // ana sayfadaki paylaşım seçeneği radio butonlarını güncelle
  autoPublishCheckbox.addEventListener("change", () => {
    currentSettings.autoPublish = autoPublishCheckbox.checked;
    publishOptionDirectRadio.checked = autoPublishCheckbox.checked;
    publishOptionDraftRadio.checked = !autoPublishCheckbox.checked;
    ipcRenderer.send("save-settings", currentSettings);
  });

  themeLightRadio.addEventListener("change", () => {
    if (themeLightRadio.checked) {
      applyTheme("light");
    }
  });

  themeDarkRadio.addEventListener("change", () => {
    if (themeDarkRadio.checked) {
      applyTheme("dark");
    }
  });

  setTimeout(() => {
    accountUrlInput.focus();
  }, 300);

  // İlk önce localStorage'dan tema tercihi kontrol et
  const savedTheme = localStorage.getItem('theme') || currentSettings.theme || 'light';
  
  // Tema radio butonlarının durumunu güncelle
  if (savedTheme === 'dark') {
    themeDarkRadio.checked = true;
  } else {
    themeLightRadio.checked = true;
  }
  
  // Temayı uygula
  applyTheme(savedTheme);

  // İstatistik sekmelerini yönetmek için olay dinleyicileri
  const statsTabs = document.querySelectorAll(".stats-tab");
  if (statsTabs.length > 0) {
    statsTabs.forEach(tab => {
      tab.addEventListener("click", () => {
        // Aktif sekmeyi güncelle
        statsTabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        
        // İstatistik verilerini seçilen zaman dilimine göre güncelle
        updateStatsForPeriod(tab.dataset.period);
      });
    });
    
    // Varsayılan olarak bugünün verilerini göster
    updateStatsForPeriod("today");
  }
  
  // Hesap istatistiklerini tabloya ekle
  renderAccountStats();
  
  // Platform istatistiklerini tabloya ekle
  renderPlatformStats();
});

ipcRenderer.on("settings-loaded", (event, settings) => {
  if (settings) {
    currentSettings = { ...defaultSettings, ...settings };
    updateSettingsUI();
    
    // Dil ayarını uygula
    if (currentSettings.language) {
      currentLanguage = currentSettings.language;
      langTrBtn.classList.toggle("active", currentLanguage === "tr");
      langEnBtn.classList.toggle("active", currentLanguage === "en");
      updatePageLanguage();
    }
    
    // Çeviri seçeneğini ayarla
    if (currentSettings.translateTo) {
      translateSelect.value = currentSettings.translateTo;
    }
    
    // Paylaşım seçeneği radio butonlarını ayarla
    publishOptionDirectRadio.checked = currentSettings.autoPublish;
    publishOptionDraftRadio.checked = !currentSettings.autoPublish;
    
    // Temayı uygula
    applyTheme(currentSettings.theme || 'light');
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
    language: currentLanguage,
    translateTo: currentSettings.translateTo
  };

  ipcRenderer.send("save-settings", updatedSettings);
  currentSettings = updatedSettings;

  // Ana sayfadaki paylaşım seçeneği radio butonlarını da güncelle
  publishOptionDirectRadio.checked = autoPublish;
  publishOptionDraftRadio.checked = !autoPublish;

  applyTheme(theme);

  addStatusMessage(translations[currentLanguage].settingsSaved, "success");
});

// Tema değiştirme fonksiyonu
function applyTheme(theme) {
  // HTML root elementine tema sınıfı ekleyerek CSS değişkenlerini aktifleştir
  document.documentElement.classList.remove('theme-light', 'theme-dark');
  document.documentElement.classList.add(`theme-${theme}`);
  
  // Body'ye de tema sınıfını ekle, bazı eski stillerin doğru çalışmasını sağlar
  document.body.classList.remove('theme-light', 'theme-dark');
  document.body.classList.add(`theme-${theme}`);
  
  // Tema önizleme tablosunu güncelle
  const currentThemeValue = document.getElementById('current-theme-value');
  if (currentThemeValue) {
    currentThemeValue.textContent = theme === 'dark' ? 'Koyu' : 'Açık';
  }
  
  // Çalışan temanın doğru uygulandığını kontrol etmek için logla
  console.log(`Tema değiştirildi: ${theme}`);
  console.log(`HTML Root sınıfları: ${document.documentElement.classList}`);
  console.log(`Body sınıfları: ${document.body.classList}`);
  
  // Temayı localStorage'da sakla
  localStorage.setItem('theme', theme);
  
  // Tema değişikliğini anında görmek için bir css yeniden hesaplatma tetikle
  setTimeout(() => {
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
      table.style.display = 'none';
      // Stil yeniden hesaplaması için zorla
      void table.offsetHeight;
      table.style.display = '';
    });
    
    // Ayarları güncelle (sadece ayarlar yüklenmişse)
    if (currentSettings) {
      currentSettings.theme = theme;
      ipcRenderer.send("save-settings", currentSettings);
    }
  }, 50);
}

clearDataButton.addEventListener("click", () => {
  if (
    confirm(translations[currentLanguage].clearConfirm)
  ) {
    ipcRenderer.send("clear-all-data");

    navigateToPage("home");

    addStatusMessage(translations[currentLanguage].dataCleared, "success");
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

// Çeviri durum mesajları için yardımcı fonksiyon
function formatTranslationMessage(message, param) {
  return message.replace("{0}", param);
}

// Durum güncellemesi ve buton durumu için tek bir fonksiyon
function handleStatusUpdate(message) {
  // Durum mesajını ekle
  const statusEntry = document.createElement("div");
  statusEntry.className = "status-entry";

  if (message.includes("Hata")) {
    statusEntry.classList.add("status-error");
  } else if (message.includes("tamamlandı") || message.includes("kaydedildi") || message.includes("çevrildi")) {
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
    
    // Dil ayarına göre metin güncelle
    const startText = translations[currentLanguage].startButton;
    startButton.innerHTML = `<i class="fa-solid fa-play"></i> <span data-i18n="startButton">${startText}</span>`;
    console.log("İşlem sonlandı, buton etkinleştirildi:", message);
  }
}

// Tek bir olay dinleyicisi ekle
ipcRenderer.on("update-status", (event, message) => {
  handleStatusUpdate(message);
});

// Çeviri durum mesajları için olay dinleyici
ipcRenderer.on("translation-status", (event, data) => {
  if (data.status === "translating") {
    const message = formatTranslationMessage(translations[currentLanguage].translatingStatus, data.text);
    handleStatusUpdate(message);
  } else if (data.status === "translated") {
    const message = formatTranslationMessage(translations[currentLanguage].translatedStatus, data.text);
    handleStatusUpdate(message);
  }
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
  const translateTo = translateSelect.value; // Çeviri seçeneğini al
  const autoPublish = publishOptionDirectRadio.checked; // Direkt paylaşım değerini radio butondan al

  if (!accountUrl || !bufferEmail || !bufferPassword) {
    addStatusMessage("Tüm alanları doldurun!", "error");
    return;
  }

  const saveCredentials = saveCredentialsCheckbox.checked;

  const credentials = {
    accountUrl,
    bufferEmail,
    bufferPassword,
    saveCredentials,
  };

  // Çeviri seçeneğini ayarlara ekle
  currentSettings.translateTo = translateTo;
  currentSettings.autoPublish = autoPublish;
  
  ipcRenderer.send("start-process", credentials, currentSettings);

  startButton.disabled = true;
  // Dil ayarına göre metin güncelle
  const stopText = translations[currentLanguage].stopButton;
  startButton.innerHTML = `<i class="fa-solid fa-stop"></i> <span data-i18n="stopButton">${stopText}</span>`;

  addStatusMessage(`İşlem başlatılıyor: ${accountUrl}`);
});

function addStatusMessage(message, type = null) {
  const statusEntry = document.createElement("div");
  statusEntry.className = "status-entry";

  if (type === "error") {
    statusEntry.classList.add("status-error");
  } else if (type === "success") {
    statusEntry.classList.add("status-success");
  }

  const timestamp = new Date().toLocaleTimeString();
  statusEntry.textContent = `[${timestamp}] ${message}`;

  statusLog.appendChild(statusEntry);
  statusLog.scrollTop = statusLog.scrollHeight;
}

// Örnek istatistik verisi - gerçek uygulamada localStorage veya veritabanı kullanılabilir
let statsData = {
  tweets: {
    total: 42,
    success: 38,
    failed: 4
  },
  accounts: [
    { name: "@elonmusk", count: 15, lastDate: "2023-10-15 14:32" },
    { name: "@jack", count: 8, lastDate: "2023-10-12 09:15" },
    { name: "@twitter", count: 19, lastDate: "2023-10-16 18:45" }
  ],
  platforms: [
    { name: "Buffer", shares: 38, lastDate: "2023-10-16 18:45" }
  ]
};

// Seçilen zaman dilimine göre istatistikleri güncelle
function updateStatsForPeriod(period) {
  // Gerçek uygulamada, farklı zaman dilimlerine göre verileri filtreleyeceğiz
  // Şimdilik, örnek verileri gösteriyoruz
  
  let displayData = { ...statsData.tweets };
  
  // Zaman dilimine göre verileri değiştir
  switch(period) {
    case "today":
      displayData.total = Math.floor(displayData.total * 0.2);
      displayData.success = Math.floor(displayData.success * 0.2);
      displayData.failed = Math.floor(displayData.failed * 0.2);
      break;
    case "week":
      displayData.total = Math.floor(displayData.total * 0.5);
      displayData.success = Math.floor(displayData.success * 0.5);
      displayData.failed = Math.floor(displayData.failed * 0.5);
      break;
    case "month":
      displayData.total = Math.floor(displayData.total * 0.8);
      displayData.success = Math.floor(displayData.success * 0.8);
      displayData.failed = Math.floor(displayData.failed * 0.8);
      break;
    case "all":
      // Tüm veriler olduğu gibi kalır
      break;
  }
  
  // Sayaçları güncelle
  document.getElementById("tweets-count").textContent = displayData.total;
  document.getElementById("tweets-success").textContent = displayData.success;
  document.getElementById("tweets-failed").textContent = displayData.failed;
}

// Hesap istatistiklerini tabloya ekle
function renderAccountStats() {
  const tableBody = document.getElementById("account-stats-body");
  if (!tableBody) return;
  
  tableBody.innerHTML = "";
  
  statsData.accounts.forEach(account => {
    const row = document.createElement("tr");
    
    const nameCell = document.createElement("td");
    nameCell.textContent = account.name;
    row.appendChild(nameCell);
    
    const countCell = document.createElement("td");
    countCell.textContent = account.count;
    row.appendChild(countCell);
    
    const dateCell = document.createElement("td");
    dateCell.textContent = account.lastDate;
    row.appendChild(dateCell);
    
    tableBody.appendChild(row);
  });
}

// Platform istatistiklerini tabloya ekle
function renderPlatformStats() {
  const tableBody = document.getElementById("platform-stats-body");
  if (!tableBody) return;
  
  tableBody.innerHTML = "";
  
  statsData.platforms.forEach(platform => {
    const row = document.createElement("tr");
    
    const nameCell = document.createElement("td");
    nameCell.textContent = platform.name;
    row.appendChild(nameCell);
    
    const sharesCell = document.createElement("td");
    sharesCell.textContent = platform.shares;
    row.appendChild(sharesCell);
    
    const dateCell = document.createElement("td");
    dateCell.textContent = platform.lastDate;
    row.appendChild(dateCell);
    
    tableBody.appendChild(row);
  });
}
