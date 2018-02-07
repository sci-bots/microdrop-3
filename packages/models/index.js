const path = require('path');
const url = require('url');

function initAsElectronProcesses(electron) {
  const {BrowserWindow, ipcMain} = electron;

  let win;

  const options = {
    webPreferences: {
      webSecurity: false
    },
    show: false
  };
  win = new BrowserWindow(options);
  win.loadURL(url.format({
    pathname: path.resolve(__dirname, 'public/device.html'),
    protocol: 'file:',
    slashes: true
  }));

  win = new BrowserWindow(options);
  win.loadURL(url.format({
    pathname: path.resolve(__dirname, 'public/electrodes.html'),
    protocol: 'file:',
    slashes: true
  }));

  win = new BrowserWindow(options);
  win.loadURL(url.format({
    pathname: path.resolve(__dirname, 'public/routes.html'),
    protocol: 'file:',
    slashes: true
  }));

}

module.exports = {initAsElectronProcesses}
