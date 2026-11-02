// MCE Office — the desktop app: one window with the office walk-through (the web build in ./web, made by the
// `office-desktop` target of the frontend's angular.json). No server, no login, nothing loaded from the internet.
const { app, BrowserWindow, Menu, net, protocol, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, 'web', 'browser');

// MCE_TIMING_FILE=<file>: write when each start-up step happened (ms since 1970, one JSON line each) and quit once the
// office is ready — to see on a given laptop where the time goes between the double-click and the office.
const timingFile = process.env.MCE_TIMING_FILE || null;
const mark = (step) => timingFile && fs.appendFileSync(timingFile, `${JSON.stringify({ step, t: Date.now() })}\n`);
mark('main');

// --screenshot <file>: open without showing and save pictures — <file>-loading.png of the welcome screen while the
// office loads, <file>-arrived.png once it is ready, <file> a few seconds after "Let's go" — plus <file>.json with how
// long each step took; then quit. A check that runs without anyone looking at the screen.
const shotAt = process.argv.indexOf('--screenshot');
const shotFile = shotAt > 0 ? process.argv[shotAt + 1] : null;

// --progress-from=<0…0.9>: the portable exe's launcher showed the welcome screen while it unpacked; the app's own
// carries on from where its line stood (passed on to the page as #from=…).
const fromArg = process.argv.find((a) => a.startsWith('--progress-from='));
const progressFrom = fromArg ? Math.max(0, Math.min(0.9, Number(fromArg.slice('--progress-from='.length)) || 0)) : 0;

// The web build is served from app://office/ rather than file://, so its ES modules load like on a web server.
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

function serveApp() {
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    const wanted = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = path.normalize(path.join(ROOT, wanted));
    // Only files of the web build — never anything outside it.
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'MCE Office',
    // White like the welcome screen, which is the first thing the page shows.
    backgroundColor: '#ffffff',
    // Shown once the welcome screen is painted — straight away maximized, so it fills the screen from the first moment.
    show: false,
    // Pictures taken unseen (--screenshot) need the page to run at full speed although the window is hidden.
    // The welcome screen rings the lift's ding on its own — no click has happened yet.
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: !shotFile, autoplayPolicy: 'no-user-gesture-required' },
  });
  // The app never opens other pages: links to the web go to the default browser, everything else stays put.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('app://office/')) event.preventDefault();
  });
  if (!shotFile) {
    win.once('ready-to-show', () => {
      win.maximize();
      win.focus();
      void win.webContents.executeJavaScript('window.mceSplash && window.mceSplash.shown()').catch(() => null);
      mark('shown');
    });
  }
  mark('window');
  win.webContents.once('did-finish-load', () => mark('page'));
  void win.loadURL(`app://office/index.html${progressFrom ? `#from=${progressFrom}` : ''}`);
  if (timingFile && !shotFile) {
    const poll = async () => {
      const ready = await win.webContents.executeJavaScript('!!(window.mceSplash && window.mceSplash.isArrived())').catch(() => false);
      if (!ready) return setTimeout(poll, 100);
      mark('ready');
      setTimeout(() => app.quit(), 1500);
    };
    win.webContents.once('did-finish-load', () => poll());
  }

  if (shotFile) {
    const page = (js) => win.webContents.executeJavaScript(js).catch(() => null);
    const shoot = async (file) => fs.writeFileSync(file, (await win.webContents.capturePage()).toPNG());
    const base = shotFile.replace(/\.png$/i, '');
    const opened = Date.now();
    win.webContents.once('did-finish-load', () => {
      setTimeout(() => shoot(`${base}-loading.png`), 700);
      const waitForArrival = async () => {
        if (!(await page('!!(window.mceSplash && window.mceSplash.isArrived())')) && Date.now() - opened < 90000) {
          setTimeout(waitForArrival, 200);
          return;
        }
        const marks = await page('window.mceSplash ? window.mceSplash.marks : null');
        fs.writeFileSync(`${base}.json`, JSON.stringify({ windowOpenToArrivedMs: Date.now() - opened, marks }, null, 2));
        setTimeout(async () => {
          await shoot(`${base}-arrived.png`);
          await page("document.getElementById('mce-go') && document.getElementById('mce-go').click()");
          setTimeout(async () => {
            await shoot(shotFile);
            app.quit();
          }, 6000);
        }, 1200);
      };
      waitForArrival();
    });
  }
}

Menu.setApplicationMenu(null);
app.whenReady().then(() => {
  mark('electron-ready');
  serveApp();
  createWindow();
});
app.on('window-all-closed', () => app.quit());
