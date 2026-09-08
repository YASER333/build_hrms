const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let mainWindow;
let backendProcess;

function getBackendPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "HRMS_SERVER");
  }

  return path.join(__dirname, "HRMS_SERVER");
}

function getFrontendPath() {
  if (app.isPackaged) {
    return path.join(
      app.getAppPath(),
      "HRMSUI",
      "build",
      "index.html"
    );
  }

  return path.join(
    __dirname,
    "HRMSUI",
    "build",
    "index.html"
  );
}

function startBackend() {
  const backendPath = getBackendPath();

  console.log("Backend path:", backendPath);

  backendProcess = spawn(
    process.execPath,
    ["index.js"],
    {
      cwd: backendPath,

      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1"
      },

      stdio: "inherit",

      shell: false
    }
  );

  backendProcess.on("error", (error) => {
    console.error("Failed to start backend:", error);
  });

  backendProcess.on("exit", (code) => {
    console.log("Backend process exited with code:", code);
  });
}

function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
    backendProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,

    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const frontendPath = getFrontendPath();

  console.log("Frontend path:", frontendPath);

  mainWindow.loadFile(frontendPath);
}

app.whenReady().then(() => {

  startBackend();

  createWindow();

  app.on("activate", () => {

    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }

  });

});

app.on("window-all-closed", () => {

  if (process.platform !== "darwin") {
    app.quit();
  }

});

app.on("before-quit", () => {

  stopBackend();

});