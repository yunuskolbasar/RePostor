const { app, BrowserWindow } = require("electron");
const { createWindow } = require("./src/window");
const { registerIpcHandlers } = require("./src/utils/ipc-handlers");

// Uygulama başladığında
app.whenReady().then(() => {
  // Ana pencereyi oluştur
  createWindow();

  // IPC olay dinleyicilerini kaydet
  registerIpcHandlers();
});

// Tüm pencereler kapatıldığında
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Uygulama aktif hale geldiğinde
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
