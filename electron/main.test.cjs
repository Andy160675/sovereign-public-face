const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

async function boot() {
  const opened = [], windows = [];
  class BrowserWindow {
    constructor() {
      this.events = {};
      this.webContents = {
        setWindowOpenHandler: callback => { this.popup = callback; },
        on: (name, callback) => { this.events[name] = callback; },
      };
      windows.push(this);
    }
    loadURL(url) { this.url = url; }
    once() {}
    on() {}
    static getAllWindows() { return windows; }
  }
  const electron = {
    app: { isPackaged: true, whenReady: () => Promise.resolve(), on() {}, quit() {} },
    BrowserWindow, Menu: { buildFromTemplate: x => x, setApplicationMenu() {} },
    shell: { openExternal: url => { opened.push(url); return Promise.resolve(); } },
    ipcMain: {}, nativeTheme: {},
  };
  vm.runInNewContext(readFileSync(join(__dirname, 'main.cjs'), 'utf8'), {
    require: name => name === 'electron' ? electron : require(name),
    __dirname, process: { env: {}, platform: 'win32' }, URL, console,
  });
  await Promise.resolve();
  return { window: windows[0], opened };
}

for (const url of ['file:///C:/Windows/system32/notepad.exe', 'ms-settings:privacy', 'javascript:alert(1)', 'data:text/html,hello', 'not a URL']) {
  test(`navigation refuses OS/local/invalid URL: ${url.split(':')[0]}`, async () => {
    const { window, opened } = await boot(); let prevented = false;
    assert.doesNotThrow(() => window.events['will-navigate']({ preventDefault() { prevented = true; } }, url));
    assert.equal(prevented, true); assert.deepEqual(opened, []);
  });
  test(`popup refuses OS/local/invalid URL: ${url.split(':')[0]}`, async () => {
    const { window, opened } = await boot();
    assert.equal(window.popup({ url }).action, 'deny'); assert.deepEqual(opened, []);
  });
}
test('same-origin navigation stays inside the existing window', async () => {
  const { window, opened } = await boot(); let prevented = false;
  window.events['will-navigate']({ preventDefault() { prevented = true; } }, window.url + '/audit');
  assert.equal(prevented, false); assert.deepEqual(opened, []);
});
for (const url of ['https://checkout.stripe.com/c/test', 'http://example.test/help', 'mailto:help@example.test']) {
  test(`permitted external ${url.split(':')[0]} navigation opens externally`, async () => {
    const { window, opened } = await boot(); let prevented = false;
    window.events['will-navigate']({ preventDefault() { prevented = true; } }, url);
    assert.equal(prevented, true); assert.deepEqual(opened, [url]);
  });
}
test('HTTPS popup opens in the browser without creating a renderer window', async () => {
  const { window, opened } = await boot();
  assert.equal(window.popup({ url: 'https://example.test/' }).action, 'deny');
  assert.deepEqual(opened, ['https://example.test/']);
});
