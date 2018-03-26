const fs = require('fs');
const os = require('os');
const path = require('path');
const url = require('url');
const {spawn} = require('child_process');
const {Console} = require('console');

const _ = require('lodash');
const bodyParser = require('body-parser');
const cors = require('cors');
const d64 = require('d64');
const express = require('express');
const {ipcRenderer} = require('electron');
const msgpack = require('msgpack5')();
const pkginfo = require('pkginfo')(module);
const pidusage = require('pidusage');
const psTree = require('ps-tree');
const terminate = require('terminate');
const yac = require('@yac/api');

const Broker = require('@micropede/broker/src/index.js');
const {MicropedeClient, GetReceiver} = require('@micropede/client/src/client.js');
const MicropedeAsync = require('@micropede/client/src/async.js');
const MicroDropUI = require('@microdrop/ui/index.js');
const FindUserDefinedPlugins = require('../utils/find-microdrop-plugins.js');

const env = module.exports.environment;
const version = module.exports.version;

const console = new Console(process.stdout, process.stderr);

const APPNAME = 'microdrop';

class WebServer extends MicropedeClient {
  constructor(broker, ports, storage, defaultRunningPlugins=[]) {
    if (storage == undefined) storage = window.localStorage;
    // Add key to local storage that tracks ui plugins:
    let firstLoad = false;
    if (storage.getItem('microdrop:plugins') == null) {
      firstLoad = true;
      WebServer.initPlugins(storage);
    }

    super('microdrop', env.host, ports.mqtt_tcp_port, undefined, version);
    Object.assign(this, this.ExpressServer());
    this.use(cors({
      'origin': '*',
      'methods': 'GET,HEAD,PUT,PATCH,POST,DELETE'
    }));
    this.use(express.static(MicroDropUI.GetUIPath(), {extensions:['html']}));
    this.use(express.static(path.join(__dirname,"resources")));
    this.use(bodyParser.json({limit: '50mb'}));
    this.storage = storage;
    this.broker = broker;
    this.ports = ports;
    this.runningChildren = {};
    this.firstLoad = firstLoad;
    this.defaultRunningPlugins = defaultRunningPlugins;
  }

  storageClean() {
    let items = _.pickBy(this.storage, (v,k)=>{
      return _.includes(k, `${APPNAME}!!`)
    });

    return _.mapValues(items, function (v) {
      v = msgpack.decode(d64.decode(v.substring(5)));
      if (v.payload) v.payload = JSON.parse(v.payload)
      return v;
    });
  }

  async listen() {
    if (this.firstLoad) {
      this.setState('first-load', true);
    } else {
      this.setState('first-load', false);
    }

    // TODO: pass in electron optionally (incase we switch to node later)
    ipcRenderer.on('reset-db', this.reset.bind(this));
    ipcRenderer.send('broker-ready');

    this.get('/yacinfo', (req, res) => {
      if (this.yacinfo == undefined) {
        this.yacinfo = {};
        let projects = [];
        _.each(env.defaultProcessPlugins, (name) => {
          let _path = require.resolve(path.join(name, 'package.json'));
          projects.push({
            name: name,
            path: path.dirname(_path),
            prevLog: [],
            autostart: true
          });
        });
        this.yacinfo.yacProjects = projects;
      }
      res.send(this.yacinfo);
    });
    this.post('/yacinfo', (req, res) => {
      this.yacinfo = req.body;
      res.send('yacinfo updated');
    });

    const resourcesDir = path.resolve(__dirname, 'resources');

    let storage = this.storage || window.localStorage;

    // Terminate zombies processes from prev yac instance:
    let prevPids = storage.getItem('microdrop:pids');

    if (prevPids) {
      let children = JSON.parse(prevPids);
      const EPS = 5;
      for (let [k,c] of Object.entries(children)) {
        try {
          let stats = await pidusage(c.pid);
          let startTime = (new Date()).getTime() - stats.elapsed;
          if (startTime - c.startTime > EPS) return; // Process has been reassigned
          await new Promise((res, rej) => {
            terminate(c.pid, (err) => {
              res();
            });
          });
        } catch (e) {}
      }
      storage.setItem('microdrop:pids', JSON.stringify({}));
    }

    // Start yac dashboard
    yac.dashboard.addKeywordFilter(APPNAME);
    yac.dashboard.setLogo(path.resolve(resourcesDir, 'logo.svg'));
    const url = `http://localhost:${this.ports.http_port}`;
    yac.dashboard(undefined, `${url}/yacinfo`, {url:true});

    // Track pids of child processes
    setInterval(async () => {
      let p = process.pid;

      // Get all child processes
      let children = await new Promise((r, b) => {
        psTree(p, (e, c) => r(c));
        setTimeout(() => { r([]); }, 500);
      });

      // Get prev pids
      let pids = {};
      if (storage.getItem('microdrop:pids') !== null) {
        pids = JSON.parse(storage.getItem('microdrop:pids'));
      }

      // Fetch startime for each child process id
      for (let c of [...children]) {
        try {
          let stats;
          try {
            stats = await pidusage(parseInt(c.PID));
          } catch (e) {
            delete pids[c.PID];
            continue;
          }
          console.log({stats});
          let startTime = (new Date()).getTime() - stats.elapsed;
          pids[stats.pid] = {pid: stats.pid, startTime: startTime };
        } catch (e) {
          console.error(e);
        }
      }

      storage.setItem('microdrop:pids', JSON.stringify(pids));
    }, 500);

    this.findPlugins();

    /* Listen for http, mqtt, and local events */
    this.get('/', this.onShowIndex.bind(this));
    this.get('/http-port',     (_, res) => {res.send(`${this.ports.http_port}`)});
    this.get('/mqtt-tcp-port', (_, res) => {res.send(`${this.ports.mqtt_tcp_port}`)});
    this.get('/mqtt-ws-port',  (_, res) => {res.send(`${this.ports.mqtt_ws_port}`)});
    this.get('/storage-clean', (_, res) => {res.send(this.storageClean())});
    this.get('/storage-raw', (_, res) => {res.send(JSON.stringify(this.storage))});
    this.get('/plugins.json', (_,res) => {res.send(this.storage.getItem('microdrop:plugins'))})
    this.get('/web-plugins.json', (_, res) => {res.send(this.WebPlugins())});
    this.get('/fetch-file', (req, res) => {res.send(this.fetchFile(req))});
    this.post('/load-storage', (req, res) => {
      const LABEL = 'webserver:load-storage';
      try {
        const storage = req.body;
        _.each(storage, (v,k) => {
          if (_.includes(k, 'microdrop!!')) {
            this.storage.setItem(k,v);
          }
        });
        res.send('done');
      } catch (e) {
        console.error(LABEL, e);
        res.status(500).json({ error: e.toString() });
      }
    });

    this.get('/write-state', (req, res) => {
      const LABEL = 'webserver:write-key-to-storage';
      try {
        const pluginName = req.query["pluginName"];
        const key = req.query["key"];
        const val = JSON.stringify(JSON.parse(req.query["val"]));

        // Convert into mosca message
        let msg = {};
        msg.topic = `microdrop/${pluginName}/state/${key}`;
        msg.payload = Buffer.from(val);
        msg.messageId = `id_${parseInt(Math.random()*1e10)}`;
        msg.qos = 0;
        msg.retain = true;

        const storageKey = `${APPNAME}!!retained!${APPNAME}/${pluginName}/state/${key}`;
        const encodedVal = `Buff:${d64.encode(msgpack.encode(msg).slice())}`;
        this.storage.setItem(storageKey, encodedVal);
        res.send({key, encodedVal});
      } catch (e) {
        console.error(LABEL, e);
        res.status(500).json({error: e.toString()});
      }
    });

    this.get('/get-state', (req, res) => {
      const LABEL = 'webserver:get-state';
      try {
        const key = req.query["key"];
        const pluginName = req.query["pluginName"];
        const storageKey = `${APPNAME}!!retained!${APPNAME}/${pluginName}/state/${key}`;

        const encodedVal = localStorage.getItem(storageKey);
        const val = JSON.parse(msgpack.decode(d64.decode(encodedVal.substring(5))).payload);
        res.send({storageKey, encodedVal, val});
      } catch (e) {
        res.status(500).json({error: e.toString()});
      }
    });

    this.get('/process-plugins', (_, res) => {
      const style = `
        position: absolute;
        top: 0px;
        left: 0px;
        border: none;
        width: 100%;
        height: 100%;
      `;

      const html = `<iframe style="${style}" src="${yac.dashboard.url()}"></iframe>`;
      res.send(html);
    });

    this.bindStateMsg("plugins", "set-plugins");
    this.bindTriggerMsg("device-model", "load-default", 'load-device');
    this.onTriggerMsg("add-plugin-path", this.onAddPluginPath.bind(this));
    this.onTriggerMsg("remove-plugin-path", this.removePluginPath.bind(this));
    this.onTriggerMsg("update-plugin-state", this.updatePluginState.bind(this));

    this._listen(this.ports.http_port);
  }


  get filepath() {return __dirname;}
  findPlugins() {
      let args = [];
      for (const [i, plugin] of Object.entries(env.defaultEnabled)) {
        let _path = path.dirname(require.resolve(path.join(plugin, 'package.json')));
        args.push(_path);
      }
      FindUserDefinedPlugins(args, this.storage || localStorage, this.onPluginFound.bind(this));
  }

  reset() {
    this.storage.clear();
    ipcRenderer.sendSync('reset-db-success');
  }

  addWebPlugin(packageData, pluginDir) {
    const LABEL = "webserver:addwebplugin";
    try {
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

        if (!pluginData.webPlugins)pluginData.webPlugins = {};
        pluginData.webPlugins[pluginDir] = {
          name: pluginName,
          path: pluginDir,
          state: state,
          data: packageData
        };

        this.storage.setItem("microdrop:plugins", JSON.stringify(pluginData));
      }

    } catch (e) {
      console.error(LABEL, e);
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
      console.error(LABEL, e);
      return this.notifySender(payload, DumpStack(LABEL, e), "add-plugin-path", "failed");
    }

  }

  removePluginPath(payload) {
    const LABEL = 'web-server:remove-plugin-path';
    try {
      const pluginData = JSON.parse(this.storage.getItem("microdrop:plugins"));
      const pluginPath = path.resolve(payload.path);

      // Remove all plugins along path:
      for (const [id, plugin] of Object.entries(pluginData.webPlugins)){
        if (path.resolve(plugin.path).indexOf(pluginPath) != -1)
          delete pluginData.webPlugins[id];
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

  updatePluginState(payload) {
    const LABEL = 'web-server:update-plugin';
    try {
      // Get plugin data
      const plugin = payload;
      const pluginData = JSON.parse(this.storage.getItem("microdrop:plugins"));

      let plugins;
      if (plugin.data.type == 'ui') plugins = pluginData.webPlugins;
      else {
        throw `Only UI plugins supported`;
      }
      // Ensure plugin exists
      if (!(plugin.path in plugins) ) {
        throw(`Cannot update plugin state; plugin not found: ${plugin.path}`)
      }

      // Update plugin data
      plugins[plugin.path].state = plugin.state;
      this.storage.setItem("microdrop:plugins", JSON.stringify(pluginData));

      return this.notifySender(payload, pluginData, "update-plugin-state");
    } catch (e) {
      console.error(LABEL, e);
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
      throw `Only ui plugins supported`;
    }

    this.trigger("set-plugins");
  }

  onShowIndex(req, res) {
    res.send(
      `Navigate to one of the following: <br>
      <b>/process-plugins</b> : Manage process plugins (yac dashboard) <br>
      <b>/ui-plugins</b> : Manage js ui plugins  <br>
      <b>/display</b> : Display User Interface (Enable plugins in plugin-manager first) <br>
      `);
  }

  fetchFile(req) {

    let file = req.query["file"];
    return fs.readFileSync(file);
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
