const { app, BrowserWindow, shell, Tray, Menu, nativeImage, ipcMain, dialog } = require("electron");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");
const { autoUpdater } = require("electron-updater");

let win;
let tray;

function getLocalIp() {
  const ifaces = Object.values(os.networkInterfaces()).flat();
  const found = ifaces.find((i) => i && i.family === "IPv4" && !i.internal);
  return found ? found.address : "localhost";
}

function ensureFirewall() {
  try {
    execSync('netsh advfirewall firewall show rule name="Admission CRM Port 3000"', { stdio: "ignore" });
  } catch {
    try {
      execSync('netsh advfirewall firewall add rule name="Admission CRM Port 3000" protocol=TCP dir=in localport=3000 action=allow profile=any', { stdio: "ignore" });
    } catch {}
  }
}

function startServer() {
  require("./server.js");
}

function createTray() {
  const ip = getLocalIp();
  const icon = nativeImage.createFromPath(path.join(__dirname, "icon.ico"));
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);

  const menu = Menu.buildFromTemplate([
    { label: "Open CRM", click: () => { win.show(); win.focus(); } },
    { type: "separator" },
    { label: `Staff Link: http://${ip}:3000`, enabled: false },
    { type: "separator" },
    { label: "Quit", click: () => { app.isQuiting = true; app.quit(); } }
  ]);

  tray.setToolTip(`Admission CRM running\nStaff: http://${ip}:3000`);
  tray.setContextMenu(menu);
  tray.on("double-click", () => { win.show(); win.focus(); });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Admission Follow-up CRM",
    icon: path.join(__dirname, "icon.ico"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    },
    autoHideMenuBar: true
  });

  win.loadURL("http://localhost:3000");

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://localhost")) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.on("close", (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      win.hide();
      tray.displayBalloon({
        title: "Admission CRM",
        content: "CRM is still running. Staff can connect. Right-click the tray icon to quit."
      });
    }
  });
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Private GitHub repo — authenticate so update checks and downloads work
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
  if (token) {
    autoUpdater.requestHeaders = { Authorization: `token ${token}` };
  }

  autoUpdater.on("checking-for-update", () => {
    win && win.webContents.send("update-status", { type: "checking" });
  });

  autoUpdater.on("update-available", (info) => {
    win && win.webContents.send("update-status", { type: "available", version: info.version });
  });

  autoUpdater.on("update-not-available", () => {
    win && win.webContents.send("update-status", { type: "not-available" });
  });

  autoUpdater.on("download-progress", (progress) => {
    win && win.webContents.send("update-status", { type: "downloading", percent: Math.round(progress.percent) });
  });

  autoUpdater.on("update-downloaded", (info) => {
    win && win.webContents.send("update-status", { type: "downloaded", version: info.version });
  });

  autoUpdater.on("error", (err) => {
    win && win.webContents.send("update-status", { type: "error", message: err.message });
  });

  ipcMain.on("check-for-updates", () => {
    try { autoUpdater.checkForUpdates(); } catch {}
  });

  ipcMain.on("install-update", () => {
    autoUpdater.quitAndInstall(false, true);
  });
}

app.whenReady().then(() => {
  process.env.CRM_DATA_DIR = app.getPath("userData");
  ensureFirewall();
  startServer();
  setTimeout(() => {
    createWindow();
    createTray();
    setupAutoUpdater();
    setTimeout(() => { try { autoUpdater.checkForUpdates(); } catch {} }, 5000);
  }, 1000);
});

app.on("window-all-closed", (event) => {
  if (!app.isQuiting) event.preventDefault();
});
