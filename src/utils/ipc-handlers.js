const { ipcMain } = require("electron");
const { store, defaultSettings } = require("../config");
const { getMainWindow } = require("../window");
const tweetProcessor = require("../services/tweet-processor");

/**
 * IPC olay dinleyicilerini kaydet
 */
function registerIpcHandlers() {
  // Pencere kontrolleri
  ipcMain.on("minimize-window", () => {
    const win = getMainWindow();
    if (win) win.minimize();
  });

  ipcMain.on("close-window", () => {
    const win = getMainWindow();
    if (win) win.close();
  });

  // Yapılandırma ve ayarlar
  ipcMain.on("get-saved-credentials", (event) => {
    const credentials = store.get("credentials");
    event.reply("saved-credentials", credentials);
  });

  ipcMain.on("save-credentials", (event, data) => {
    store.set("credentials", data);
  });

  ipcMain.on("clear-credentials", () => {
    store.delete("credentials");
  });

  ipcMain.on("get-settings", (event) => {
    const settings = store.get("settings") || defaultSettings;
    event.reply("settings-loaded", settings);
  });

  ipcMain.on("save-settings", (event, settings) => {
    store.set("settings", settings);
  });

  ipcMain.on("clear-all-data", () => {
    store.clear();
  });

  // Ana işlem
  ipcMain.on("start-process", tweetProcessor.startProcess);
}

module.exports = {
  registerIpcHandlers,
};
