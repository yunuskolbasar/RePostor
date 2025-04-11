const Store = require("electron-store");
require("dotenv").config();

// Store yapılandırması
const store = new Store({
  encryptionKey: "buffer-app-secure-key",
});

// Varsayılan ayarlar
const defaultSettings = {
  theme: "light",
  headlessMode: false,
  pageTimeout: 30,
  elementTimeout: 10,
  autoPublish: false,
};

// Modülden dışa aktarılan değişkenler
module.exports = {
  store,
  defaultSettings,
};
