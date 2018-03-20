const url = require('url');
const path = require('path');
const {spawn} = require('child_process');
const fs = require('fs');

const terminate = require('terminate');
const psTree = require('ps-tree');
const request = require('request');
const mqtt = require('mqtt');
const _ = require('lodash');

const MicroDropModels = require('@microdrop/models');
const MicropedeAsync = require('@micropede/client/src/async.js');
const {MicropedeClient, DumpStack} = require('@micropede/client/src/client.js');

const APPNAME = 'microdrop';

const sendDefaults = (win, defaultRunningPlugins) => {
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('default-running-plugins', JSON.stringify(defaultRunningPlugins));
  });
}

const sendPorts = (win, ports) => {
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('ports', JSON.stringify(ports));
  });
}

const sendReadyPing = (win, msg={}) => {
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('ready', JSON.stringify(msg));
  });
}

const createClient = (port) => {
  return new Promise((resolve, reject) => {
    const address = `mqtt://localhost:${port}`;
    const client  = mqtt.connect(address);
    client.on('connect', () => {
      resolve(client);
    });
  });
}

const launchWebserver = (win) => {
  win.loadURL(url.format({
    pathname: path.resolve(__dirname, 'public/web-server.html'),
    protocol: 'file:',
    slashes: true
  }));
  return win;
}

const dump = (electron, ports) => {
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
      launchWebserver(win);
      sendReadyPing(win, {ports});

      // Get
      ipcMain.on('broker-ready', (event, arg) => {
        const address = `http://localhost:${ports.http_port}/storage-raw`;
        request(address, (error, response, body)  => {
          resolve(body);
        });
      });
    });
  });
}

const reset = (electron, ports) => {
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
      launchWebserver(win);
      sendReadyPing(win, {ports});

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

const loadSvg = (electron, ports, file=undefined) => {
  const {ipcMain, BrowserWindow} = electron;
  const port = ports.mqtt_tcp_port;

  const options = {
    webPreferences: {
      webSecurity: false
    },
    show: false
  };

  return new Promise((resolve, reject) => {
    fs.readFile(path.resolve(file), 'utf8', (err, content) => {
      if (err) throw err;
      const win = new BrowserWindow(options);

      win.loadURL(url.format({
        pathname: path.resolve(__dirname, 'public/read-svg.html'),
        protocol: 'file:',
        slashes: true
      }));

      ipcMain.on('svg-reader-ready', (event, arg) => {
        win.webContents.send('file-content', content);
      });

      ipcMain.on('three-object', async (event, data) => {
        const micropede = new MicropedeAsync('microdrop', undefined, port);
        await micropede.putPlugin('device-model', 'three-object', JSON.parse(data));
        resolve('complete');
      });
    });
  });
}

const init = (electron, ports, defaultRunningPlugins=[], file=undefined, show=true, skipReady=false, debug=false) => {

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
      launchWebserver(win);
      sendReadyPing(win, {ports, defaultRunningPlugins});

      // Load models
      MicroDropModels.initAsElectronProcesses(electron, ports);

      // Load main window
      ipcMain.on('broker-ready', (event, arg) => {
        let filedata;

        const client = new MicropedeClient(APPNAME, "localhost", ports.mqtt_tcp_port, APPNAME);
        client.listen = () => {
          client.onTriggerMsg("browse", async (payload) => {
            try {
              const filepath = await new Promise((resolve, reject) => {
                win = new BrowserWindow();
                win.show();
                dialog.showOpenDialog(win, {
                  properties: [
                    'openDirectory'
                  ]
                }, (filePaths) => {
                  resolve(filePaths[0]);
                });
              });
              win.close();
              return client.notifySender(payload, filepath, "browse");
            } catch (e) {
              return client.notifySender(payload, DumpStack(APPNAME, e), "browse", "failed");
            }
          });

          if (file !== undefined) {
            client.onNotifyMsg("schema-ui-plugin", "connected", (a,b,topic) => {
              fs.readFile(file, 'utf8', (err, data) => {
                const _topic = 'microdrop/file-launcher/state/last-opened-file';
                client.sendMessage(_topic, JSON.parse(data)).then((d) => {
                  // TODO: change client.client to client.mqtt or something
                  client.client.unsubscribe(topic);
                })
              });
            });
          }
        }

        win = new BrowserWindow(_.extend(options, {show}));
        win.loadURL(url.format({
          pathname: path.resolve(__dirname, 'public/index.html'),
          protocol: 'file:',
          slashes: true
        }));
        win.webContents.openDevTools();

        sendReadyPing(win, {ports});

        win.on('closed', () => app.quit() );

        app.on('before-quit', (e) => {
          e.preventDefault();
          psTree(process.pid, async (err, children) => {
            await Promise.all(_.map(children , (c) => {
              return new Promise((r, b) => {
                terminate(c.PID, (e)=>r(e));
              })
            }));
            process.exit();
          });
        });

        // Resolve init
        resolve('ready');
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
module.exports.dump = dump;
module.exports.loadSvg = loadSvg;

if (require.main === module) {
  const electron = require('electron');
  module.exports(electron);
}
