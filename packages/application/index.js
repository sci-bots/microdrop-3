const url = require('url');
const path = require('path');
const {spawn} = require('child_process');

const _ = require('lodash');
const MicrodropModels = require('@microdrop/models');


const reset = (electron) => {
  /* Reset level-js / indexedDB data in Electron webserver */
  const {app, ipcMain, BrowserWindow} = electron;

  return new Promise((resolve, reject) => {
    electron.app.on('ready', () => {
      const options = {
        webPreferences: { webSecurity: false },
        show: false
      };

      // Launch webserver process
      let win;
      win = new BrowserWindow(options);
      win.loadURL(url.format({
        pathname: path.resolve(__dirname, 'public/web-server.html'),
        protocol: 'file:',
        slashes: true
      }));

      // Reset indexedDB
      ipcMain.on('broker-ready', (event, arg) => {
        ipcMain.on('reset-db-success', () => {
          resolve('reset-complete');
        });
        event.sender.send('reset-db');
      });
    });
  });

}

const init = (electron, show=true, skipReady=false, debug=false) => {
  return new Promise((resolve, reject) => {
    const {app, dialog, ipcMain, BrowserWindow} = electron;

    if (debug) require('electron-debug')({showDevTools: true});

    function init () {
      let win;
      const options = {
        webPreferences: {
          webSecurity: false
        },
        show: false
      };

      // Load webserver:
      win = new BrowserWindow(options);
      win.loadURL(url.format({
        pathname: path.resolve(__dirname, 'public/web-server.html'),
        protocol: 'file:',
        slashes: true
      }));

      // Load models
      MicrodropModels.initAsElectronProcesses(electron);

      // Load main window
      ipcMain.on('broker-ready', function(event, arg) {
        resolve('ready');
        win = new BrowserWindow(_.extend(options, {show}));
        win.loadURL(url.format({
          pathname: path.resolve(__dirname, 'public/index.html'),
          protocol: 'file:',
          slashes: true
        }));
        win.on('closed', () => app.quit() );
      });

    }

    if (skipReady) {
      init()
    } else {
      // Listen for app to be ready
      app.on('ready', () => init() );
    }

  });

}

module.exports = init;
module.exports.init = init;
module.exports.reset = reset;

if (require.main === module) {
  const electron = require('electron');
  module.exports(electron);
}
