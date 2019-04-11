'use strict'

import { app, BrowserWindow } from 'electron'
import { start } from './ipcBridge';
import './handlers';

let mainWindow;
const isDev = process.env.NODE_ENV !== 'production';
const appUrl = isDev ? 'http://localhost:3000/robit' : 'http://ilusr.com/robit';

function createMainWindow() {
  start();
  const window = new BrowserWindow();

  if (isDev) {
    window.webContents.openDevTools();
  }

  window.loadURL(appUrl);

  window.on('closed', () => {
    mainWindow = null;
  });

  window.webContents.on('devtools-opened', () => {
    window.focus();
    setImmediate(() => {
      window.focus();
    });
  });

  return window;
}

// quit application when all windows are closed
app.on('window-all-closed', () => {
  // on macOS it is common for applications to stay open until the user explicitly quits
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // on macOS it is common to re-create a window even after all windows have been closed
  if (mainWindow === null) {
    mainWindow = createMainWindow();
  }
});

// create main BrowserWindow when electron is ready
app.on('ready', () => {
  mainWindow = createMainWindow();
});