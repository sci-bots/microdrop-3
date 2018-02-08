const path = require('path');
const url = require('url');

const options = {
  webPreferences: {
    webSecurity: false
  },
  show: true
};

function initAsElectronProcesses(electron, ports) {
  const {BrowserWindow, ipcMain} = electron;

  const sendPorts = (win) => {
    win.webContents.on('did-finish-load', () => {
      win.webContents.send('ports', JSON.stringify(ports));
    });
  }

  const initModel = (name) => {
    const win = new BrowserWindow(options);
    win.loadURL(url.format({
      pathname: path.resolve(__dirname, `public/${name}.html`),
      protocol: 'file:',
      slashes: true
    }));
    sendPorts(win);
  }

  initModel('device');
  initModel('electrodes');
  initModel('routes');
}

module.exports = {initAsElectronProcesses}
