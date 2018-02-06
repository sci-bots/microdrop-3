const url = require('url');
const path = require('path');
const {spawn} = require('child_process');

const {app, dialog, BrowserWindow} = require('electron');
const _ = require('lodash');

const options = {shell: true, detached: true};
const MicrodropModels = require('@microdrop/models');


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
    pathname: path.resolve(__dirname, 'public/web-server.html')
  }));

  // Load models
  MicrodropModels.initAsElectronProcesses();

  // Load main window
  win = new BrowserWindow(_.extend(options, {show: true}));
  win.loadURL(url.format({
    pathname: path.resolve(__dirname, 'public/index.html')
  }));
  win.on('closed', () => app.quit() );

}

// Listen for app to be ready
app.on('ready', () => init() );
