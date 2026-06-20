const { app, BrowserWindow, shell, Tray, Menu, nativeImage } = require("electron");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

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
      contextIsolation: true
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

app.whenReady().then(() => {
  process.env.CRM_DATA_DIR = app.getPath("userData");
  ensureFirewall();
  startServer();
  setTimeout(() => {
    createWindow();
    createTray();
  }, 1000);
});

app.on("window-all-closed", (event) => {
  if (!app.isQuiting) event.preventDefault();
});
