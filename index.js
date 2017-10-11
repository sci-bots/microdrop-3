const fs = require('fs');
const os = require('os');
const path = require('path');
const {fork, spawn} = require('child_process');

const _ = require('lodash');
const ArgumentParser = require('argparse').ArgumentParser;
const express = require('express');
const handlebars = require('handlebars');
const NodeMqttClient = require('@mqttclient/node');

const MoscaServer  = require('./MoscaServer');

const DeviceModel     = require("./models/DeviceModel");
const ElectrodesModel = require('./models/ElectrodesModel');
const ProtocolModel   = require('./models/ProtocolModel');
const RoutesModel     = require('./models/RoutesModel');
const StepModel       = require('./models/StepModel');
const SchemaModel     = require('./models/SchemaModel');


class WebServer extends NodeMqttClient {
  constructor(args={}) {
    // Check if plugins.json exists, and if not create it:
    if (!fs.existsSync(path.resolve(path.join(__dirname,"plugins.json"))))
      WebServer.generatePluginJSON();
    super("localhost", 1883, "microdrop");

    Object.assign(this, this.ExpressServer());
    this.use(express.static(path.join(__dirname,"mqtt-admin"), {extensions:['html']}));
    this.use(express.static(path.join(__dirname,"ui/src"), {extensions:['html']}));

    // NPM Packages used in Handlebar template:
    this.use(express.static(path.join(__dirname,"node_modules/@mqttclient"), {extensions:['html']}));

    // Get extra search paths from class inputs:
    this.args = args;

    // Init default plugins
    this.webPlugins     = this.WebPlugins();
    this.processPlugins = this.ProcessPlugins();
  }
  listen() {
    this.findPlugins();
    this.on("plugin-found", this.onPluginFound.bind(this));

    /* Listen for http, mqtt, and local events */
    this.get('/', this.onShowIndex.bind(this));

    // this.addSubscription("microdrop/{*}/add-web-plugin", this.onAddWebPlugin.bind(this));
    this.addStateErrorRoute("web-plugins", "set-web-plugins-failed");

    this.bindStateMsg("web-plugins", "set-web-plugins");
    this.bindStateMsg("process-plugins", "set-process-plugins");
    this.bindSignalMsg("running-state-requested", "request-running-states");
    this.onSignalMsg("broker", "client-connected", this.onClientConnected.bind(this));
    this.onSignalMsg("broker", "client-disconnected", this.onClientDisconnected.bind(this));
    this.onSignalMsg("{plugin_name}", "running", this.onPluginRunning.bind(this));
    this.onTriggerMsg("launch-plugin", this.onLaunchProcessPlugin.bind(this));
    this.onTriggerMsg("close-plugin", this.onCloseProcessPlugin.bind(this));
    this.onTriggerMsg("add-plugin-path", this.onAddPluginPath.bind(this));
    this.onTriggerMsg("remove-plugin-path", this.onRemovePluginPath.bind(this));
    this.onTriggerMsg("update-ui-plugin-state", this.onUpdateUIPluginState.bind(this));
    this._listen(3000);

    // Launch models:
    new DeviceModel();
    new ElectrodesModel();
    new RoutesModel();
    new ProtocolModel();
    new StepModel();
    new SchemaModel();
    // Ping plugins every three seconds
    setInterval(this.pingRunningStates.bind(this), 3000);
  }
  get filepath() {return __dirname;}
  findPlugins() {
    let args = [];
    if (this.args.path) {
      for (const searchpath of this.args.path) {
        args.push("--path");
        args.push(searchpath);
      }
    }
    const plugin_finder = fork(
      path.join(__dirname,"find-microdrop-plugins"), args);
    plugin_finder.on('message', (e) => this.trigger("plugin-found", e));
  }
  retrievePluginData() {
    return JSON.parse(fs.readFileSync(WebServer.pluginsfile(), 'utf8'));
  }
  addFoundWebPlugin(plugin_data, plugin_path) {
    const file = path.resolve(plugin_path, plugin_data.script);
    this.addWebPlugin(file, plugin_data);
    this.trigger("set-web-plugins", this.webPlugins);
  }
  addFoundProcessPlugin(plugin_data, plugin_path) {
    const plugin = new Object();
    plugin.path = plugin_path;
    plugin.name = plugin_data.name;
    plugin.version = plugin_data.version;
    plugin.state = "stopped";
    plugin.id = `${plugin.name}:${plugin.path}`;

    this.addProcessPlugin(plugin);
    this.trigger("set-process-plugins", this.processPlugins);
  }
  addWebPlugin(file, packageData) {
    const fileExists = fs.existsSync(file);
    const extension = path.extname(file);
    const filename = path.basename(file, ".js");

    // Ensure file exists, and is a javascript file:
    let error;
    if (!fileExists) error = "file does not exists";
    if (extension != ".js") error = "plugins must be javascript (.js) files"
    if (error) { this.trigger("set-web-plugins-failed", error); return}

    // Add plugin, and write to plugins.json
    const pluginData = this.retrievePluginData();
    if (!(file in pluginData.webPlugins)) {
      pluginData.webPlugins[file] = {
        name: filename,
        path: file,
        state: "disabled",
        data: packageData
      };
      fs.writeFileSync(WebServer.pluginsfile(),
        JSON.stringify(pluginData,null,4), 'utf8');
    }
    this.webPlugins = this.WebPlugins();
  }
  addProcessPlugin(plugin) {
    const pluginData = this.retrievePluginData();
    if (!(plugin.id in pluginData)) {
      pluginData.processPlugins[plugin.id] = {name: plugin.name, path: plugin.path};
      fs.writeFileSync(WebServer.pluginsfile(),
        JSON.stringify(pluginData,null,4), 'utf8');
    }
    this.processPlugins = this.ProcessPlugins();
  }
  generateDisplayTemplate() {
    // Generate input data for handlebars template:
    const pluginPaths = new Array();

    for (const [filename, plugin] of Object.entries(this.webPlugins)) {
      if (plugin.state == "enabled")
        pluginPaths.push(path.basename(filename));
    }

    // Update html file with added / removed plugins:
    const fileSrc  = path.join(__dirname, "ui/templates/display.hb");
    const fileDest = path.join(__dirname, "ui/src/display.html");

    const file = fs.readFileSync(fileSrc);
    const template = handlebars.compile(file.toString());
    const html = template({pluginPaths: pluginPaths});
    fs.writeFileSync(fileDest, html);
  }
  getPluginData(pluginPath) {
    /* Read microdrop.json file found at path*/
    const microdropFile = path.join(pluginPath, "microdrop.json");
    if (fs.existsSync(microdropFile))
      return JSON.parse(fs.readFileSync(microdropFile, 'utf8'));
    else
      return false;
  }
  pingRunningStates() {
    this.trigger("request-running-states", null);
  }
  onAddPluginPath(payload) {
    const pluginData = this.retrievePluginData();
    const pluginPath = path.resolve(payload.path);

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
    for (const [id, plugin] of Object.entries(pluginData.processPlugins)){
      if (path.resolve(plugin.path).indexOf(pluginPath) != -1)
        delete pluginData.processPlugins[id];
    }
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
    this.processPlugins = this.ProcessPlugins();
    this.webPlugins = this.WebPlugins();
    this.trigger("set-process-plugins", this.processPlugins);
    this.trigger("set-web-plugins", this.webPlugins);

    this.findPlugins();
  }
  onCloseProcessPlugin(payload) {
    const pluginName = payload;
    const topic = `microdrop/${pluginName}/exit`;
    this.sendMessage(topic);
  }
  onLaunchProcessPlugin(payload) {
    const pluginPath = path.resolve(payload);
    const pluginData = this.getPluginData(pluginPath);
    if (!pluginData) return false;

    try {
      const command = pluginData.scripts.start.split(" ");

      // Spawn child and de-reference so it doesn't close when the broker does
      const child = spawn(command[0],
        command.slice(1, command.length), {cwd: pluginPath});
      child.unref();
    } catch (e) {
      console.error(`Failed to launch child process with path: ${pluginPath}`);
      console.error(e);
    }
  }
  onPluginRunning(payload, pluginName) {
    const plugin = new Object();
    plugin.name = pluginName
    plugin.path = payload;
    plugin.id   = `${plugin.name}:${plugin.path}`;
    const pluginId = `${plugin.name}:${plugin.path}`;
    if (this.processPlugins[plugin.id])
      this.processPlugins[plugin.id].state = "running";
    else
      this.addProcessPlugin(plugin);
    this.processPlugins[plugin.id].state = "running";
    this.trigger("set-process-plugins", this.processPlugins);
  }

  onClientConnected(payload) {
    const plugin = new Object();
    plugin.name = payload.clientName;
    plugin.path = payload.clientPath;
    if (plugin.path == "web") return;
    plugin.id   = `${plugin.name}:${plugin.path}`;
    console.log("CLIENT CONNECTED:::");
    console.log(plugin);
    this.addProcessPlugin(plugin);
    this.processPlugins[plugin.id].state = "running";
    this.trigger("set-process-plugins", this.processPlugins);
  }

  onClientDisconnected(payload){
    const pluginName = payload.clientName;
    const pluginPath = payload.clientPath;
    const pluginId = `${pluginName}:${pluginPath}`;

    if (this.processPlugins[pluginId]) {
      this.processPlugins[pluginId].state = "stopped";
      this.trigger("set-process-plugins", this.processPlugins);
    }
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
    } else {
      this.addFoundProcessPlugin(pluginData, pluginPath);
    }
  }
  onShowIndex(req, res) {
    res.send(
      `Navigate to one of the following: <br>
      <b>/mqtt-admin</b> : UI for mqtt broker  <br>
      <b>/plugin-manager</b> : Manage process and js plugins  <br>
      <b>/display</b> : Display User Interface  <br>
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
  ProcessPlugins() {
    // Get a list of plugin names from json file
    const pluginData = this.retrievePluginData();

    // Set all of their running states to "stopped"
    for (const [id,plugin] of Object.entries(pluginData.processPlugins))
      plugin.state = "stopped"

    // Ping plugins to get their actual running state
    this.trigger("request-running-states", null);
    return pluginData.processPlugins;
  }
  WebPlugins() {
    const pluginData = this.retrievePluginData();
    for (const [file, plugin] of Object.entries(pluginData.webPlugins)) {
      this.use(express.static(path.dirname(file), {extensions:['html']}));
    }
    this.webPlugins = pluginData.webPlugins;
    this.generateDisplayTemplate();
    return pluginData.webPlugins;
  }

  static pluginsfile() {
    return path.resolve(path.join(__dirname, "plugins.json"));
  }

  static generatePluginJSON() {
    const pluginData = new Object();
    pluginData.processPlugins = new Object();
    pluginData.webPlugins = new Object();
    pluginData.searchPaths = new Array();
    const filepath = WebServer.pluginsfile();
    const data = JSON.stringify(pluginData,null,4);
    fs.writeFileSync(filepath, data, 'utf8');
  }
}

const launchMicrodrop = function() {


  const parser = new ArgumentParser({
    version: '0.0.1',
    addHelp:true,
    description: 'Microdrop Args Parser'
  });

  parser.addArgument(
    [ '-p', '--path' ],
    {
      help: 'Additional microdrop plugin searchpath',
      action: "append"
    }
  );

  const moscaServer = new MoscaServer();
  const webServer = new WebServer(parser.parseArgs());
}

module.exports = {
  WebServer: WebServer,
  launchMicrodrop: launchMicrodrop
};

if (require.main === module) {
  launchMicrodrop();
}
