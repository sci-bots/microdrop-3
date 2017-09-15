const fs = require('fs');
const os = require('os');
const path = require('path');
const {fork, spawn} = require('child_process');

const _ = require('lodash');
const express = require('express');
const handlebars = require('handlebars');

const MoscaServer  = require('./MoscaServer');
const NodeMqttClient = require('./NodeMqttClient');

class WebServer extends NodeMqttClient {
  constructor() {
    if (!fs.existsSync(path.resolve("plugins.json")))
      WebServer.generatePackageJSON();
    // Check if package.json exists, and if not create it:
    super("localhost", 1883, "microdrop");
    Object.assign(this, this.ExpressServer());
    this.use(express.static(path.join(__dirname,"mqtt-admin"), {extensions:['html']}));
    this.use(express.static(path.join(__dirname,"ui/src"), {extensions:['html']}));
    this.webPlugins = new Set();
    this.processPlugins = this.ProcessPlugins();
  }

  listen() {
    this.findPlugins();

    /* Listen for http, mqtt, and local events */
    this.get('/', this.onShowIndex.bind(this));
    this.addGetRoute("microdrop/{*}/add-web-plugin", this.onAddWebPlugin.bind(this));
    this.addGetRoute("microdrop/state/web-plugins", this.onWebPluginsChanged.bind(this));
    this.addStateRoute("web-plugins", "set-web-plugins");
    this.addStateErrorRoute("web-plugins", "set-web-plugins-failed");
    this.onTriggerMsg("remove-plugin", this.onRemovePlugin.bind(this));

    this.bindStateMsg("process-plugins", "set-process-plugins");
    this.bindSignalMsg("running-state-requested", "request-running-states");
    this.onSignalMsg("{plugin_name}", "running", this.onPluginRunning.bind(this));
    this.onSignalMsg("{plugin_name}", "plugin-started", this.onProcessPluginStarted.bind(this));
    this.onSignalMsg("{plugin_name}", "plugin-exited", this.onProcessPluginExited.bind(this));
    this.onTriggerMsg("launch-plugin", this.onLaunchProcessPlugin.bind(this));
    this.onTriggerMsg("close-plugin", this.onCloseProcessPlugin.bind(this));
    this.onTriggerMsg("add-plugin-path", this.onAddPluginPath.bind(this));

    this._listen(3000);
  }
  static generatePackageJSON() {
    const pluginData = new Object();
    pluginData.plugins = new Object();
    pluginData.search_paths = new Array();
    fs.writeFileSync('plugins.json', JSON.stringify(pluginData,null,4), 'utf8');
  }
  findPlugins() {
    const plugin_finder = fork("find-microdrop-plugins");
    plugin_finder.on('message', this.onPluginFound.bind(this));
  }
  retrieveProcessPlugins() {
    const pluginsFile = path.resolve("plugins.json");
    return JSON.parse(fs.readFileSync(pluginsFile, 'utf8'));
  }
  addWebPlugin(plugin) {
    this.webPlugins.add(plugin);
    this.trigger("set-web-plugins", [...this.webPlugins]);

    // Serve directory containing file:
    this.use(express.static(path.dirname(plugin), {extensions:['html']}));

    // Re-generate display template
    this.generateDisplayTemplate();
  }
  addProcessPlugin(plugin) {
    const pluginData = this.retrieveProcessPlugins();
    if (plugin.id in pluginData) {
    } else {
      pluginData.plugins[plugin.id] = {name: plugin.name, path: plugin.path};
      fs.writeFileSync('plugins.json', JSON.stringify(pluginData,null,4), 'utf8');
    }
    this.processPlugins = this.ProcessPlugins();
  }
  generateDisplayTemplate() {
    // Generate input data for handlebars template:
    const pluginPaths = _.map([...this.webPlugins], (src) => {
      return {src: path.basename(src)}});

    // Update html file with added / removed plugins:
    const fileSrc  = path.join(__dirname, "ui/templates/display.hb");
    const fileDest = path.join(__dirname, "ui/src/display.html");

    const file = fs.readFileSync(fileSrc);
    const template = handlebars.compile(file.toString());
    const html = template({pluginPaths: pluginPaths});
    fs.writeFileSync(fileDest, html);
  }
  validatePreviousPlugins() {
    // TODO: Send error to plugin manager if plugin can no longer be found
    for (const file of this.webPlugins){
      const fileExists = fs.existsSync(file);
      if (!fileExists) this.webPlugins.delete(file);
    }
  }
  onAddPluginPath(payload) {
    const pluginData = this.retrieveProcessPlugins();
    const pluginPath = path.resolve(payload.path);

    // Retrieve Search Paths:
    const searchDirectories = new Set(pluginData.search_paths);

    // Validate Search Path:
    if (!fs.existsSync(pluginPath)) return;

    // Add to searchDirectories
    searchDirectories.add(pluginPath);
    pluginData.search_paths = [...searchDirectories];

    // Save plugin data:
    fs.writeFileSync('plugins.json', JSON.stringify(pluginData,null,4), 'utf8');

    // Find Plugins:
    this.findPlugins();
  }
  onPluginRunning(payload, pluginName) {
    const pluginPath = payload;
    const pluginId = `${pluginName}:${pluginPath}`;
    this.processPlugins[pluginId].state = "running";
    this.trigger("set-process-plugins", this.processPlugins);
  }
  onProcessPluginStarted(payload, pluginName) {
    const plugin = new Object();
    plugin.name = pluginName;
    plugin.path = payload;
    plugin.id   = `${plugin.name}:${plugin.path}`;
    this.addProcessPlugin(plugin);
    this.processPlugins[plugin.id].state = "running";
    this.trigger("set-process-plugins", this.processPlugins);
  }
  onProcessPluginExited(payload, pluginName) {
    const pluginPath = payload;
    const pluginId = `${pluginName}:${pluginPath}`;
    this.processPlugins[pluginId].state = "stopped";
    this.trigger("set-process-plugins", this.processPlugins);
  }
  onLaunchProcessPlugin(payload) {
    const pluginPath = payload;
    const platform = os.platform();
    let npm;

    // For windows, use npm.cmd to run plugin
    if (platform == "win32") npm = "npm.cmd";
    if (platform != "win32") npm = "npm";

    // Spawn child and de-reference so it doesn't close when the broker does
    const child = spawn(npm, ["start", "--prefix", pluginPath]);
    child.unref();
  }
  onCloseProcessPlugin(payload) {
    const pluginName = payload;
    const topic = `microdrop/${pluginName}/exit`;
    this.sendMessage(topic);
  }
  onAddWebPlugin(payload) {
    // Validate old plugins (ensure they still exist)
    this.validatePreviousPlugins();

    const file = path.resolve(payload);
    const fileExists = fs.existsSync(file);
    const extension = path.extname(file);

    // Ensure file exists, and is a javascript file:
    let error;
    if (!fileExists) error = "file does not exists";
    if (extension != ".js") error = "plugins must be javascript (.js) files"
    if (error) { this.trigger("set-web-plugins-failed", error); return}

    // Add plugin to list of web-plugins:
    this.addWebPlugin(file);
  }
  onPluginFound(payload){
    const plugin = new Object();
    const plugin_path = payload.plugin_path;
    const plugin_file = path.join(payload.plugin_path, "microdrop.json");
    const plugin_data = JSON.parse(fs.readFileSync(plugin_file, 'utf8'));

    plugin.path = plugin_path;
    plugin.name = plugin_data.name;
    plugin.version = plugin_data.version;
    plugin.state = "stopped";
    plugin.id = `${plugin.name}:${plugin.path}`;

    this.addProcessPlugin(plugin);
    this.trigger("set-process-plugins", this.processPlugins);
  }
  onRemovePlugin(payload) {
    const filepath = payload.filepath;
    this.webPlugins.delete(filepath);
    this.trigger("set-web-plugins", [...this.webPlugins]);
    this.generateDisplayTemplate();
  }
  onShowIndex(req, res) {
    res.send(
      `Navigate to one of the following: <br>
      <b>/mqtt-admin</b> : UI for mqtt broker  <br>
      <b>/plugin-manager</b> : Manage process and js plugins  <br>
      <b>/display</b> : Display User Interface  <br>
      `);
  }
  onWebPluginsChanged(payload) {
    this.webPlugins = new Set(payload);
    for (const filepath of this.webPlugins) {
      this.use(express.static(path.dirname(filepath), {extensions:['html']}));
    }
    this.generateDisplayTemplate();
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
    const pluginData = this.retrieveProcessPlugins();

    // Set all of their running states to "stopped"
    for (const [id,plugin] of Object.entries(pluginData.plugins))
      plugin.state = "stopped"

    // Ping plugins to get their actual running state
    this.trigger("request-running-states", null);
    return pluginData.plugins;
  }
}

const launchMicrodrop = function() {
  const moscaServer = new MoscaServer();
  const webServer = new WebServer();
}

module.exports = {
  WebServer: WebServer,
  launchMicrodrop: launchMicrodrop
};

if (require.main === module) {
  launchMicrodrop();
}
