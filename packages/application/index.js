const os = require('os');
const path = require('path');
const url = require('url');

const _ = require('lodash');
const ArgumentParser = require('argparse').ArgumentParser;
const electron = require('electron');

const HTTP_PORT = 3000;
const MQTT_PORT = 1884;

const launchMicrodrop = function() {

  const parser = new ArgumentParser({
    version: '0.0.1',
    addHelp: true,
    description: 'Microdrop Args Parser'
  });

  parser.addArgument(
    [ '-p', '--path' ],
    {
      help: 'Additional microdrop plugin searchpath',
      action: "append"
    }
  );
  let webServer;

  const ifaces = os.networkInterfaces();
  const address = _.get(ifaces, 'wlan0[0].address');
  let base = 'localhost';
  if (address) base = address;

  console.log("launching microdrop", {HTTP_PORT, MQTT_PORT});
  console.log(`Launch Jupyterlab (complete)
  or visit ${base}:${HTTP_PORT} (no filebrowser, terminal, or notebooks)`);

  // Create electron window
  const app = electron.app;
  const BrowserWindow = electron.BrowserWindow;
  let mainWindow;

  const createWindow = () => {
    mainWindow = new BrowserWindow({width: 800, height: 600, show: true});
    mainWindow.loadURL(url.format({
      pathname: path.join(__dirname, 'index.html'),
      protocol: 'file:',
      slashes: true
    }));
    mainWindow.webContents.openDevTools()
    mainWindow.on('closed', function () {
      mainWindow = null;
    });
    return mainWindow;
  }

  app.on('ready', () => createWindow() );

  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  });

  app.on('activate', function () {
    if (mainWindow === null) {
      createWindow();
    }
  });

  return {webServer, app, createWindow};
}

module.exports = {
  launchMicrodrop: launchMicrodrop
};

if (require.main === module) {
  try {
    launchMicrodrop();
  } catch (e) {
    console.error("LAUNCH FAILED!");
    console.error(e);
  }
}
