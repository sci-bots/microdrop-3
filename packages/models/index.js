const path = require('path');
const url = require('url');

function initAsElectronProcesses() {
  const {BrowserWindow} = require('electron');

  let win;

  const options = {
    webPreferences: {
      webSecurity: false
    },
    show: true
  };

  win = new BrowserWindow(options);
  win.loadURL(url.format({
    pathname: path.resolve(__dirname, 'public/device.html')
  }));

  win = new BrowserWindow(options);
  win.loadURL(url.format({
    pathname: path.resolve(__dirname, 'public/electrodes.html')
  }));

  win = new BrowserWindow(options);
  win.loadURL(url.format({
    pathname: path.resolve(__dirname, 'public/routes.html')
  }));

}

module.exports = {initAsElectronProcesses}
