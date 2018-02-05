const path = require('path');

function initAsElectronProcesses() {
  const {BrowerWindow} = require('electron');
  let win;

  const options = {
    webPreferences: {
      webSecurity: false
    },
    show: false
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
