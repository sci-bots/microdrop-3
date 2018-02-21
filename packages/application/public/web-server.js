const fs = require('fs');
const os = require('os');
const path = require('path');
const url = require('url');
const {spawn} = require('child_process');
const {Console} = require('console');

const _ = require('lodash');
const d64 = require('d64');
const express = require('express');
const {ipcRenderer} = require('electron');
const msgpack5 = require('msgpack5');
const pkginfo = require('pkginfo')(module);

const Broker = require('@micropede/broker/src/index.js');
const {MicropedeClient, GetReceiver} = require('@micropede/client/src/client.js');
const MicroDropUI = require('@microdrop/ui/index.js');
const FindUserDefinedPlugins = require('../utils/find-microdrop-plugins.js');

const env = module.exports.environment;
const version = module.exports.version;

const console = new Console(process.stdout, process.stderr);

const APPNAME = 'microdrop';

class WebServer extends MicropedeClient {
  constructor(broker, ports, storage, defaultRunningPlugins=[]) {
    if (storage == undefined) storage = window.localStorage;
    if (storage.getItem('microdrop:plugins') == null) {
      WebServer.initPlugins(storage);
    }

    super('microdrop', env.host, ports.mqtt_tcp_port, undefined, version);
    Object.assign(this, this.ExpressServer());
    this.use(express.static(MicroDropUI.GetUIPath(), {extensions:['html']}));
    this.use(express.static(path.join(__dirname,"resources")));

    this.storage = storage;
    this.broker = broker;
    this.ports = ports;
    this.runningChildren = {};
    this.defaultRunningPlugins = defaultRunningPlugins;
  }

  storageRaw() {
    let items = _.pickBy(this.storage, (v,k)=>{
      return _.includes(k, `${APPNAME}!!`)
    });
    return items;
  }

  storageClean() {
    const items = this.storageRaw();
    return _.mapValues(items, function (v) {
      v = msgpack.decode(d64.decode(v.substring(5)));
      if (v.payload) v.payload = JSON.parse(v.payload)
      return v;
    });
  }

  listen() {
    // TODO: pass in electron optionally (incase we switch to node later)
    ipcRenderer.on('reset-db', this.reset.bind(this));
    ipcRenderer.send('broker-ready');

    this.findPlugins();
    this.startDefaultRunningPlugins();


    /* Listen for http, mqtt, and local events */
    this.get('/', this.onShowIndex.bind(this));
    this.get('/http-port',     (_, res) => {res.send(`${this.ports.http_port}`)});
    this.get('/mqtt-tcp-port', (_, res) => {res.send(`${this.ports.mqtt_tcp_port}`)});
    this.get('/mqtt-ws-port',  (_, res) => {res.send(`${this.ports.mqtt_ws_port}`)});
    this.get('/storage-clean', (_, res) => {res.send(this.storageClean())});
    this.get('/storage-raw', (_, res) => {res.send(this.storageRaw())});
    this.get('/plugins.json', (_,res) => {res.send(this.storage.getItem('microdrop:plugins'))})
    this.get('/web-plugins.json', (_, res) => {res.send(this.WebPlugins())});

    this.bindStateMsg("plugins", "set-plugins");
    this.onTriggerMsg("add-plugin-path", this.onAddPluginPath.bind(this));
    this.onTriggerMsg("remove-plugin-path", this.removePluginPath.bind(this));
    this.onTriggerMsg("update-plugin-state", this.updatePluginState.bind(this));

    this._listen(this.ports.http_port);
  }


  get filepath() {return __dirname;}
  findPlugins() {
      let args = [];
      for (const [i, plugin] of Object.entries(env.defaultEnabled)) {
        args.push(path.resolve(require.resolve(plugin), '..'));
      }
      FindUserDefinedPlugins(args, this.storage || localStorage, this.onPluginFound.bind(this));
  }

  reset() {
    this.storage.clear();
    ipcRenderer.sendSync('reset-db-success');
  }

  addProcessPlugin(packageData, pluginDir) {
    const LABEL ='web-server:add-proccess-plugin'; console.log(LABEL);
    const storage = this.storage || localStorage;
    try {
      const pluginName = packageData.name
      let pluginData = JSON.parse(storage.getItem('microdrop:plugins'));
      const processPlugins = _.get(pluginData, 'processPlugins') || {};

      if (!(pluginDir in processPlugins)) {
        _.set(pluginData.processPlugins, pluginDir, {
          name: pluginName,
          path: pluginDir,
          state: 'stopped',
          data: packageData
        });
      }

      // Listen for when a process plugin is connected or disconnected
      this.onSignalMsg(pluginName, 'disconnected', () => {
        pluginData.processPlugins[pluginDir].state = 'stopped';
        this.storage.setItem("microdrop:plugins", JSON.stringify(pluginData));
        this.trigger("set-plugins")
      });

      this.onSignalMsg(pluginName, 'connected', () => {
        pluginData.processPlugins[pluginDir].state = 'running';
        this.storage.setItem("microdrop:plugins", JSON.stringify(pluginData));
        this.trigger("set-plugins");
      });

      this.storage.setItem("microdrop:plugins", JSON.stringify(pluginData));
    } catch (e) {
      console.error(LABEL, e);
    }
  }
  addWebPlugin(packageData, pluginDir) {
    const storage = this.storage || localStorage;

    const file = path.resolve(pluginDir, packageData.script);
    const fileExists = fs.existsSync(file);
    const extension = path.extname(file);
    const pluginName = path.basename(pluginDir);

    // Ensure file exists, and is a javascript file:
    let error;
    if (!fileExists) error = "file does not exists";
    if (extension != ".js") error = "plugins must be javascript (.js) files";
    if (error) {
      console.error(error, file);
      return;
    }

    // Add plugin, and write to plugins.json
    let pluginData = JSON.parse(storage.getItem('microdrop:plugins'));
    const webPlugins = _.get(pluginData, "webPlugins") || {};

    if (!(pluginDir in webPlugins )) {
      let state = "disabled";

      if (_.includes(env.defaultEnabled, `@microdrop/${pluginName}`) ||
          _.includes(env.defaultEnabled, pluginName)) {
        state = "enabled";
      }

      _.set(pluginData.webPlugins, pluginDir, {
        name: pluginName,
        path: pluginDir,
        state: state,
        data: packageData
      });

      this.storage.setItem("microdrop:plugins", JSON.stringify(pluginData));
    }
  }

  onAddPluginPath(payload) {
    const LABEL ='web-server:add-plugin-path';
    try {
      const pluginData = JSON.parse(this.storage.getItem("microdrop:plugins"));
      let pluginPath = path.resolve(payload.path);

      // Retrieve Search Paths:
      const searchDirectories = new Set(pluginData.searchPaths);

      // Validate Search Path:
      if (!fs.existsSync(pluginPath)) {
        throw(`FAILED TO ADD PLUGIN:
                       Plugin path ${pluginPath} does not exist`);
      }

      // Add to searchDirectories
      searchDirectories.add(pluginPath);
      pluginData.searchPaths = [...searchDirectories];

      // Save plugin data:
      this.storage.setItem("microdrop:plugins", JSON.stringify(pluginData));

      // Find Plugins:
      this.findPlugins();

      return this.notifySender(payload, pluginData, "add-plugin-path");
    } catch (e) {
      return this.notifySender(payload, DumpStack(LABEL, e), "add-plugin-path", "failed");
    }

  }

  removePluginPath(payload) {
    const LABEL = 'web-server:remove-plugin-path';
    try {
      const pluginData = JSON.parse(this.storage.getItem("microdrop:plugins"));
      const pluginPath = path.resolve(payload.path);

      // TODO: Kill running process plugins when removed from path

      // Remove all plugins along path:
      for (const [id, plugin] of Object.entries(pluginData.webPlugins)){
        if (path.resolve(plugin.path).indexOf(pluginPath) != -1)
          delete pluginData.webPlugins[id];
      }

      for (const [id, plugin] of Object.entries(pluginData.processPlugins)){
        if (path.resolve(plugin.path).indexOf(pluginPath) != -1)
          delete pluginData.processPlugins[id];
      }

      // Remove entry in searchPaths
      for (const [i, path] of Object.entries(pluginData.searchPaths)){
        if (path == pluginPath) {
          pluginData.searchPaths.splice(i, 1);
          break;
        }
      }

      // Write to file
      this.storage.setItem("microdrop:plugins", JSON.stringify(pluginData));
      this.findPlugins();
      return this.notifySender(payload, pluginData, "remove-plugin-path");
    } catch (e) {
      console.error(LABEL, e);
      return this.notifySender(payload, DumpStack(LABEL, e), "remove-plugin-path", "failed");
    }
  }

  startDefaultRunningPlugins() {
    try {
      const pluginData = JSON.parse(this.storage.getItem("microdrop:plugins"));
      const plugins = pluginData.processPlugins;

      for (const [i, jsonFile] of Object.entries(this.defaultRunningPlugins)) {
        if (!fs.existsSync(path.resolve(jsonFile))) {
          throw `Error: ${jsonFile} does not exists (expecting path to microdrop.json file)`
        }

        const data = require(path.resolve(jsonFile));
        const pluginPath = path.dirname(path.resolve(jsonFile));

        this.addProcessPlugin(data, pluginPath);

        plugins[pluginPath] = {
          path: pluginPath,
          state: 'running',
          data: data,
          name: data.name
        };
        
        const options = {
          shell: true ,
          stdio: 'inherit',
          cwd: pluginPath
        };
        const runningChild = spawn(data.script, [], options);
        this.runningChildren[pluginPath] = runningChild;
      }

      this.storage.setItem("microdrop:plugins", JSON.stringify(pluginData));
    } catch (e) {
      console.error(e);
    }
  }

  updatePluginState(payload) {
    const LABEL = 'web-server:update-plugin';
    try {
      // Get plugin data
      const plugin = payload;
      const pluginData = JSON.parse(this.storage.getItem("microdrop:plugins"));

      let plugins;
      if (plugin.data.type == 'ui') plugins = pluginData.webPlugins;
      if (plugin.data.type == 'process') plugins = pluginData.processPlugins;

      // Ensure plugin exists
      if (!(plugin.path in plugins) ) {
        throw(`Cannot update plugin state; plugin not found: ${plugin.path}`)
      }

      // Update plugin data
      plugins[plugin.path].state = plugin.state;
      this.storage.setItem("microdrop:plugins", JSON.stringify(pluginData));

      // If process plugin then call exection script as a child_process
      if (plugin.data.type == 'process') {
        if (plugin.state == 'running') {
          console.log("Starting plugin:", plugin.data.script);

          const options = {
            shell: true ,
            stdio: 'inherit',
            cwd: plugin.path
          };

          const runningChild = spawn(plugin.data.script, [], options);
          this.runningChildren[plugin.path] = runningChild;
        } else {
          if (_.get(this.runningChildren, plugin.path) != undefined)
            this.runningChildren[plugin.path].kill();
        }
      }

      return this.notifySender(payload, pluginData, "update-plugin-state");
    } catch (e) {
      console.error(e);
      return this.notifySender(payload, DumpStack(LABEL, e), "update-plugin-state", "failed");
    }
  }

  onPluginFound(payload){
    const pluginPath = payload.plugin_path;
    const microdropFile = path.join(pluginPath, "microdrop.json");

    /* Read microdrop.json file found at path*/
    if (!fs.existsSync(microdropFile)) return false;
    const pluginData = JSON.parse(fs.readFileSync(microdropFile, 'utf8'));

    // Check if plugin is a ui plugin:
    if (pluginData.type == "ui") {
      this.addWebPlugin(pluginData, pluginPath);
    } else {
      this.addProcessPlugin(pluginData, pluginPath);
    }
    this.trigger("set-plugins");
  }

  onShowIndex(req, res) {
    res.send(
      `Navigate to one of the following: <br>
      <b>/plugin-manager</b> : Manage process and js plugins  <br>
      <b>/display</b> : Display User Interface (Enable plugins in plugin-manager first) <br>
      `);
  }

  ExpressServer() {
    const app = new Object();
    const server = express();
    app.get  = server.get.bind(server);
    app.post = server.post.bind(server);
    app.put  = server.put.bind(server);
    app.use  = server.use.bind(server);
    app._listen = server.listen.bind(server);
    return app;
  }
  WebPlugins() {
    const pluginData = JSON.parse(this.storage.getItem("microdrop:plugins"));
    const webPlugins = _.get(pluginData, "webPlugins") || {};
    for (const [pluginDir, plugin] of Object.entries(webPlugins)) {
      const parentDir = path.resolve(pluginDir, "..");
      this.use(express.static(parentDir));
    }
    return _.get(pluginData, "webPlugins") || {} ;
  }

  static initPlugins(storage) {
    const pluginData = new Object();
    pluginData.webPlugins = new Object();
    pluginData.processPlugins = new Object();
    pluginData.searchPaths = new Array();
    storage.setItem('microdrop:plugins', JSON.stringify(pluginData));
  }
}

module.exports = WebServer;
module.exports.WebServer = WebServer;

module.exports.init = (ports, defaultRunningPlugins=[]) => {
  /* Initialize Electron Web Server */

  window.addEventListener('unhandledrejection', function(event) {
      console.error('Unhandled rejection (promise: ', event.promise, ', reason: ', event.reason, ').');
  });
  window.addEventListener('error', function(e) {
      console.error(e.message);
  });

  const broker = new Broker('microdrop',ports.mqtt_ws_port, ports.mqtt_tcp_port);

  broker.on('broker-ready', () => {
    const webServer = new WebServer(broker, ports, undefined, defaultRunningPlugins);
    if (window) {window.webServer = webServer}
  });

  broker.listen();
}
