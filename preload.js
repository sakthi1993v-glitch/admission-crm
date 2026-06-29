const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  checkForUpdates: () => ipcRenderer.send("check-for-updates"),
  installUpdate: () => ipcRenderer.send("install-update"),
  onUpdateStatus: (callback) => {
    ipcRenderer.on("update-status", (_, message) => callback(message));
  }
});
