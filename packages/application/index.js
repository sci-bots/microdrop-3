const url = require('url');
const path = require('path');
const {spawn} = require('child_process');

const _ = require('lodash');
const MicrodropModels = require('@microdrop/models');

module.exports = (electron, skipReady=false) => {
  return new Promise((resolve, reject) => {

    console.log("INITIALIZING!!");
    const {app, dialog, ipcMain, BrowserWindow} = electron;

    function init () {
      console.log("INIT CALLED");
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
        win = new BrowserWindow(_.extend(options, {show: true}));
        win.loadURL(url.format({
          pathname: path.resolve(__dirname, 'public/index.html'),
          protocol: 'file:',
          slashes: true
        }));

      });

      win.on('closed', () => app.quit() );

    }

    if (skipReady) {
      init()
    } else {
      // Listen for app to be ready
      app.on('ready', () => init() );
    }

  });

}

if (require.main === module) {
  const electron = require('electron');
  module.exports(electron);
}
