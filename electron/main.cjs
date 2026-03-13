/**
 * Sovereign Sanctuary Systems — Electron Desktop App
 * Wraps the web application in a native desktop window.
 * Supports: Windows, macOS, Linux
 * 
 * Usage:
 *   Development: npx electron electron/main.cjs
 *   Production:  npx electron-builder (see electron-builder.yml)
 */

const { app, BrowserWindow, Menu, shell, ipcMain, nativeTheme } = require('electron');
const path = require('path');

// Force dark mode to match Sovereign Obsidian theme
nativeTheme.themeSource = 'dark';

// Production URL — change to your deployed domain
const PRODUCTION_URL = 'https://sovereigna-sjdwyspm.manus.space';
const DEV_URL = 'http://localhost:3000';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Sovereign Sanctuary Systems',
    backgroundColor: '#0D0D0F', // Obsidian
    titleBarStyle: 'hiddenInset', // macOS native feel
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    show: false, // Show when ready to prevent flash
  });

  // Graceful show
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Load the app
  const url = app.isPackaged ? PRODUCTION_URL : DEV_URL;
  mainWindow.loadURL(url);

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://checkout.stripe.com') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Handle navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    const appUrl = new URL(url);
    if (parsedUrl.origin !== appUrl.origin) {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Application Menu
function createMenu() {
  const template = [
    {
      label: 'Sovereign',
      submenu: [
        { label: 'About Sovereign Sanctuary Systems', role: 'about' },
        { type: 'separator' },
        { label: 'Preferences...', accelerator: 'CmdOrCtrl+,', click: () => {} },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Navigate',
      submenu: [
        { label: 'Home', accelerator: 'CmdOrCtrl+1', click: () => mainWindow?.loadURL(`${app.isPackaged ? PRODUCTION_URL : DEV_URL}/`) },
        { label: 'Services', accelerator: 'CmdOrCtrl+2', click: () => mainWindow?.loadURL(`${app.isPackaged ? PRODUCTION_URL : DEV_URL}/services`) },
        { label: 'AI Audit', accelerator: 'CmdOrCtrl+3', click: () => mainWindow?.loadURL(`${app.isPackaged ? PRODUCTION_URL : DEV_URL}/audit`) },
        { label: 'Packs', accelerator: 'CmdOrCtrl+4', click: () => mainWindow?.loadURL(`${app.isPackaged ? PRODUCTION_URL : DEV_URL}/packs`) },
        { label: 'Team', accelerator: 'CmdOrCtrl+5', click: () => mainWindow?.loadURL(`${app.isPackaged ? PRODUCTION_URL : DEV_URL}/team`) },
        { label: 'Contact', accelerator: 'CmdOrCtrl+6', click: () => mainWindow?.loadURL(`${app.isPackaged ? PRODUCTION_URL : DEV_URL}/contact`) },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
