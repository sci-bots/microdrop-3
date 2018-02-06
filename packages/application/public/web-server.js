const fs = require('fs');
const os = require('os');
const path = require('path');
const url = require('url');
const {fork, spawn} = require('child_process');
const {Console} = require('console');

const _ = require('lodash');
const {ipcRenderer} = require('electron');
const express = require('express');

const Broker = require('@micropede/broker/src/index.js');
const {MicropedeClient, GetReceiver} = require('@micropede/client/src/client.js');
const MicrodropUI = require('@microdrop/ui/index.js');

const env = require('../package.json').environment;

const console = new Console(process.stdout, process.stderr);
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled rejection (promise: ', event.promise, ', reason: ', event.reason, ').');
});
window.addEventListener('error', function(e) {
    console.error(e.message);
});


class WebServer extends MicropedeClient {
  constructor(args={}) {
    // Check if plugins.json exists, and if not create it:
    if (!fs.existsSync(path.resolve(__dirname,"../utils/plugins.json")))
      WebServer.generatePluginJSON();
    super('microdrop', env.host, env.MQTT_TCP_PORT);

    Object.assign(this, this.ExpressServer());
    this.use(express.static(MicrodropUI.GetUIPath(), {extensions:['html']}));
    this.use(express.static(path.join(__dirname,"resources")));

    // Get extra search paths from class inputs:
    this.args = args;

    // Init default plugins
    this.webPlugins     = this.WebPlugins();
  }
  listen() {
    ipcRenderer.send('broker-ready');
    this.findPlugins();
    this.on("plugin-found", this.onPluginFound.bind(this));

    /* Listen for http, mqtt, and local events */
    this.get('/', this.onShowIndex.bind(this));

    this.bindStateMsg("web-plugins", "set-web-plugins");
    this.onTriggerMsg("add-plugin-path", this.onAddPluginPath.bind(this));
    this.onTriggerMsg("remove-plugin-path", this.onRemovePluginPath.bind(this));
    this.onTriggerMsg("update-ui-plugin-state", this.onUpdateUIPluginState.bind(this));
    this._listen(env.HTTP_PORT);
  }

  get filepath() {return __dirname;}
  findPlugins() {
      let args = [];

      for (const [i, plugin] of Object.entries(env.defaultEnabled)) {
        // Add path to all default plugins
        args.push('--path');
        args.push(path.resolve(require.resolve(plugin), '..'));
      }

      // args.push("--path");
      // args.push(path.resolve(__dirname, "../.."));

      if (this.args.path) {
        for (const searchpath of this.args.path) {
          args.push("--path");
          args.push(searchpath);
        }
      }
      const plugin_finder = fork(
        path.resolve(__dirname,"../utils/find-microdrop-plugins"), args, {cwd: __dirname});
      plugin_finder.on('message', (e) => this.trigger("plugin-found", e));
  }
  retrievePluginData() {
    return JSON.parse(fs.readFileSync(WebServer.pluginsfile(), 'utf8'));
  }
  addFoundWebPlugin(plugin_data, plugin_path) {
    const file = path.resolve(plugin_path);
    this.addWebPlugin(file, plugin_data);
    this.trigger("set-web-plugins", this.webPlugins);
  }
  addWebPlugin(pluginDir, packageData) {
    const file = path.resolve(pluginDir, packageData.script);
    const fileExists = fs.existsSync(file);
    const extension = path.extname(file);
    const pluginName = path.basename(pluginDir);

    // Ensure file exists, and is a javascript file:
    let error;
    if (!fileExists) error = "file does not exists";
    if (extension != ".js") error = "plugins must be javascript (.js) files";
    if (error) {
      // this.trigger("set-web-plugins-failed", error);
      console.error(error, file);
      return;
    }

    // Add plugin, and write to plugins.json
    const pluginData = this.retrievePluginData();

    if (!(pluginDir in pluginData.webPlugins)) {
      let state = "disabled";

      if (_.includes(env.defaultEnabled, `@microdrop/${pluginName}`) ||
          _.includes(env.defaultEnabled, pluginName)) {
        state = "enabled";
      }
      pluginData.webPlugins[pluginDir] = {
        name: pluginName,
        path: pluginDir,
        state: state,
        data: packageData
      };
      fs.writeFileSync(WebServer.pluginsfile(),
        JSON.stringify(pluginData,null,4), 'utf8');
    }
    this.webPlugins = this.WebPlugins();
  }

  generateDisplayTemplate() {
    // Generate input data for microdrop ui:
    const pluginPaths = new Array();

    for (const [pluginDir, plugin] of Object.entries(this.webPlugins)) {
      if (plugin.state == "enabled") {
        pluginPaths.push(path.join(plugin.name, plugin.data.script));
      }
    }

    // Update html file with added / removed plugins:
    MicrodropUI.UpdateDisplayTemplate(pluginPaths);
  }

  getPluginData(pluginPath) {
    /* Read microdrop.json file found at path*/
    const microdropFile = path.join(pluginPath, "microdrop.json");
    if (fs.existsSync(microdropFile))
      return JSON.parse(fs.readFileSync(microdropFile, 'utf8'));
    else
      return false;
  }
  onAddPluginPath(payload) {
    const pluginData = this.retrievePluginData();
    let pluginPath = path.resolve(payload.path);

    // Retrieve Search Paths:
    const searchDirectories = new Set(pluginData.searchPaths);

    // Validate Search Path:
    if (!fs.existsSync(pluginPath)) {
      console.error(`FAILED TO ADD PLUGIN:
                     Plugin path ${pluginPath} does not exist`);
      return;
    }

    // Add to searchDirectories
    searchDirectories.add(pluginPath);
    pluginData.searchPaths = [...searchDirectories];

    // Save plugin data:
    fs.writeFileSync(WebServer.pluginsfile(),
      JSON.stringify(pluginData,null,4), 'utf8');

    // Find Plugins:
    this.findPlugins();
  }
  onRemovePluginPath(payload) {
    const pluginData = this.retrievePluginData();
    const pluginPath = path.resolve(payload.path);

    // Remove plugins under this path
    for (const [id, plugin] of Object.entries(pluginData.webPlugins)){
      if (path.resolve(plugin.path).indexOf(pluginPath) != -1)
        delete pluginData.webPlugins[id];
    }

    // Remove entry in pluginData.searchPaths
    for (const [i, path] of Object.entries(pluginData.searchPaths)){
      if (path == pluginPath) {
        pluginData.searchPaths.splice(i, 1);
        break;
      }
    }

    // Write to file
    fs.writeFileSync(WebServer.pluginsfile(),
      JSON.stringify(pluginData,null,4), 'utf8');

    // Update
    this.webPlugins = this.WebPlugins();
    this.trigger("set-web-plugins", this.webPlugins);

    this.findPlugins();
  }

  onUpdateUIPluginState(payload) {
    // TODO: Make method more general (i.e. just ui plugin state)
    const plugin = payload;
    const pluginData = this.retrievePluginData();
    if (!(plugin.path in pluginData.webPlugins)) {
      console.error("Cannot update plugin state; plugin not found");
      console.error(payload);
      return;
    }
    pluginData.webPlugins[plugin.path].state = plugin.state;
    fs.writeFileSync(WebServer.pluginsfile(),
      JSON.stringify(pluginData,null,4), 'utf8');
    this.webPlugins = this.WebPlugins();
    this.trigger("set-web-plugins", this.webPlugins);
  }
  onAddWebPlugin(payload) {
    // Validate old plugins (ensure they still exist)
    const file = path.resolve(payload);
    // Add plugin to list of web-plugins:
    this.addWebPlugin(file);
  }
  onPluginFound(payload){
    const pluginPath = payload.plugin_path;
    const pluginData = this.getPluginData(pluginPath);

    // Check if plugin is a ui plugin:
    if (pluginData.type == "ui") {
      this.addFoundWebPlugin(pluginData, pluginPath);
    }
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
    const pluginData = this.retrievePluginData();
    for (const [pluginDir, plugin] of Object.entries(pluginData.webPlugins)) {
      const parentDir = path.resolve(pluginDir, "..");
      this.use(express.static(parentDir));
    }
    this.webPlugins = pluginData.webPlugins;
    this.generateDisplayTemplate();
    return pluginData.webPlugins;
  }

  static pluginsfile() {
    return path.resolve(path.join(__dirname, "../utils/plugins.json"));
  }

  static generatePluginJSON() {
    const pluginData = new Object();
    pluginData.webPlugins = new Object();
    pluginData.searchPaths = new Array();
    const filepath = WebServer.pluginsfile();
    const data = JSON.stringify(pluginData,null,4);
    fs.writeFileSync(filepath, data, 'utf8');
  }
}

const broker = new Broker('microdrop',env.MQTT_WS_PORT, env.MQTT_TCP_PORT);
console.log({env});
broker.on('broker-ready', () => {
  const webServer = new WebServer();
});
broker.listen();
