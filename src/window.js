const { BrowserWindow } = require("electron");
const path = require("path");

// Ana pencere referansı
let mainWindow = null;

/**
 * Ana pencereyi oluşturur
 * @returns {BrowserWindow} Oluşturulan pencere nesnesi
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    frame: false,
    transparent: false,
    backgroundColor: "#f5f8fa",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, "../assets/icon.png"),
  });

  mainWindow.loadFile("index.html");

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

/**
 * Ana pencereyi döndürür, yoksa null döner
 * @returns {BrowserWindow|null}
 */
function getMainWindow() {
  return mainWindow;
}

module.exports = {
  createWindow,
  getMainWindow,
};
