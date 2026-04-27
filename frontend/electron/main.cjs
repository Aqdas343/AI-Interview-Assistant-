const { app, BrowserWindow, globalShortcut, ipcMain, session } = require('electron');
const isDev = require('electron-is-dev');
const path  = require('path');
const os    = require('os');

// ── Must be before app ready ──────────────────────────────────────
app.setPath('userData', path.join(os.tmpdir(), 'ai-assistant-electron'));

// Disable GPU features that cause errors on this machine
// NOTE: do NOT call app.disableHardwareAcceleration() — it breaks transparent windows
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-rasterization');
app.commandLine.appendSwitch('disable-gpu-memory-buffer-video-frames');
app.commandLine.appendSwitch('disable-d3d11');
app.commandLine.appendSwitch('disable-direct-composition');
app.commandLine.appendSwitch('in-process-gpu');
app.commandLine.appendSwitch('enable-speech-input');
app.commandLine.appendSwitch('enable-features', 'SpeechRecognition,SpeechSynthesis');
app.commandLine.appendSwitch('allow-file-access-from-files');
app.commandLine.appendSwitch('disable-web-security');
// Fix media encoder errors
app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor,HardwareMediaKeyHandling');
app.commandLine.appendSwitch('disable-gpu-video-decode');
app.commandLine.appendSwitch('disable-accelerated-video-encode');
app.commandLine.appendSwitch('disable-accelerated-video-decode');

let mainWindow;

function createWindow() {
  const { screen } = require('electron');
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;

  const W = 420, H = 520;

  mainWindow = new BrowserWindow({
    width:           W,
    height:          H,
    x:               Math.floor((screenWidth - W) / 2),
    y:               20,
    frame:           false,
    transparent:     true,
    backgroundColor: '#00000000',
    alwaysOnTop:     true,
    resizable:       false,
    movable:         true,
    skipTaskbar:     true,   // hide from taskbar — less visible
    show:            false,
    webPreferences: {
      nodeIntegration:             true,
      contextIsolation:            false,
      webSecurity:                 false,
      allowRunningInsecureContent: true,
      devTools:                    isDev,
    },
  });

  // ── Content protection BEFORE show — makes window black in any screen capture ──
  mainWindow.setContentProtection(true);

  // ── Allow all outbound requests (fixes chunked_data_pipe errors) ─
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
    { urls: ['http://localhost:*/*', 'ws://localhost:*/*'] },
    (details, callback) => {
      callback({ requestHeaders: { ...details.requestHeaders, Origin: 'http://localhost' } });
    }
  );

  mainWindow.webContents.session.webRequest.onHeadersReceived(
    { urls: ['http://localhost:*/*'] },
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Access-Control-Allow-Origin': ['*'],
        },
      });
    }
  );

  // ── Auto-grant microphone + screen capture ───────────────────────
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    const allowed = ['media', 'microphone', 'audioCapture', 'geolocation', 'display-capture', 'screen'];
    callback(allowed.includes(permission));
  });

  // ── Load the built app ────────────────────────────────────────────
  const url = `file://${path.join(__dirname, '../dist/index.html')}#/desktop-mini`;
  console.log('[Electron] Loading:', url);
  mainWindow.loadURL(url);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    console.log('[Electron] Window visible ✓ (screen capture protected)');
  });

  mainWindow.on('blur',   () => mainWindow.setAlwaysOnTop(true, 'screen-saver'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Shortcuts ─────────────────────────────────────────────────────
function registerShortcuts() {
  const toggle = () => {
    if (!mainWindow) return createWindow();
    mainWindow.isVisible() ? mainWindow.hide() : (mainWindow.show(), mainWindow.focus());
  };
  globalShortcut.register('CommandOrControl+Shift+K', toggle);
  globalShortcut.register('CommandOrControl+K',       toggle);
}

// ── IPC ───────────────────────────────────────────────────────────
ipcMain.on('close-mini', () => mainWindow?.hide());

ipcMain.on('minimize-mini', () => {
  if (!mainWindow) return;
  const [x, y] = mainWindow.getPosition();
  mainWindow.setSize(320, 64);
  mainWindow.setPosition(x, y);
});

ipcMain.on('maximize-mini', () => {
  if (!mainWindow) return;
  const { screen } = require('electron');
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const W = 420, H = 560;
  mainWindow.setSize(W, H);
  mainWindow.setPosition(Math.floor((sw - W) / 2), Math.min(20, sh - H - 40));
});

ipcMain.on('resize-window', (_e, { width, height }) => {
  if (!mainWindow) return;
  const { screen } = require('electron');
  const { width: sw } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow.setSize(width, height);
  mainWindow.setPosition(Math.floor((sw - width) / 2), 20);
});

// ── Get desktop audio sources for interview mode ──────────────────
ipcMain.handle('get-audio-sources', async () => {
  const { desktopCapturer } = require('electron');
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 150, height: 100 },
    });
    return sources.map(s => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail.toDataURL(),
    }));
  } catch (err) {
    console.error('[desktopCapturer] Error:', err.message);
    return [];
  }
});

// ── App lifecycle ─────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  registerShortcuts();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
