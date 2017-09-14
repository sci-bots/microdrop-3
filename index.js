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
    super("localhost", 1883, "microdrop");
    Object.assign(this, this.ExpressServer());
    this.use(express.static(path.join(__dirname,"mqtt-admin"), {extensions:['html']}));
    this.use(express.static(path.join(__dirname,"ui/src"), {extensions:['html']}));
    this.plugins = new Set();

  }
  listen() {
    const plugin_finder = fork("find-microdrop-plugins");
    plugin_finder.on('message', this.onPluginFound.bind(this));

    /* Listen for http, mqtt, and local events */
    this.get('/', this.onShowIndex.bind(this));
    this.addGetRoute("microdrop/{*}/add-web-plugin", this.onAddWebPlugin.bind(this));
    this.addGetRoute("microdrop/state/web-plugins", this.onWebPluginsChanged.bind(this));
    this.addStateRoute("web-plugins", "set-web-plugins");
    this.addStateErrorRoute("web-plugins", "set-web-plugins-failed");
    this.onTriggerMsg("remove-plugin", this.onRemovePlugin.bind(this));

    this.bindStateMsg("new-process-plugins", "set-new-process-plugins");
    this.bindStateMsg("process-plugins", "set-process-plugins");
    this.onTriggerMsg("save-process-plugins", this.onSaveProcessPlugins.bind(this));
    this.onStateMsg("web-server", "process-plugins", this.onProcessPluginsSet.bind(this));
    this.onSignalMsg("{plugin_name}", "plugin-started", this.onProcessPluginStarted.bind(this));
    this.onSignalMsg("{plugin_name}", "plugin-exited", this.onProcessPluginExited.bind(this));
    this.onTriggerMsg("launch-plugin", this.onLaunchProcessPlugin.bind(this));
    this.onTriggerMsg("close-plugin", this.onCloseProcessPlugin.bind(this));

    this.allPlugins = new Object();
    this.newPlugins = new Object();
    this.processPluginsHasInitialized = false;
    this._listen(3000);
  }
  addPlugin(plugin) {
    this.plugins.add(plugin);
    this.trigger("set-web-plugins", [...this.plugins]);

    // Serve directory containing file:
    this.use(express.static(path.dirname(plugin), {extensions:['html']}));

    // Re-generate display template
    this.generateDisplayTemplate();
  }
  generateDisplayTemplate() {
    // Generate input data for handlebars template:
    const pluginPaths = _.map([...this.plugins], (src) => {
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
    for (const file of this.plugins){
      const fileExists = fs.existsSync(file);
      if (!fileExists) this.plugins.delete(file);
    }
  }
  onProcessPluginsSet(payload) {
    this.allPlugins = payload;
    if (this.processPluginsHasInitialized == false){
      this.processPluginsHasInitialized = true;
      for (const [k,v] of Object.entries(this.newPlugins)){
        this.allPlugins[k] = v;
      }
      this.trigger("set-process-plugins", this.allPlugins);
    }
    this.trigger("set-new-process-plugins", this.allPlugins);
  }
  onProcessPluginStarted(payload, pluginName) {
    const plugin = new Object();
    plugin.name = pluginName;
    plugin.path = payload;
    plugin.state = "running";
    if (this.processPluginsHasInitialized == true) {
      this.allPlugins[pluginName] = plugin;
      this.trigger("set-process-plugins", this.allPlugins);
    }
    if (this.processPluginsHasInitialized == false) {
      // Don't trigger state update (as to avoid potentially overriding prev
      // plugins)
      this.newPlugins[pluginName] = plugin;
      this.trigger("set-new-process-plugins", this.newPlugins);
    }
  }
  onProcessPluginExited(payload, pluginName) {
    if (this.processPluginsHasInitialized == false) {
      this.allPlugins = this.newPlugins;
    }
    if (!this.allPlugins[pluginName]) {
      console.error(`plugin: ${pluginName} not registered`);
      return;
    }
    this.allPlugins[pluginName].state = "stopped";
    this.trigger("set-process-plugins", this.allPlugins);
  }
  onSaveProcessPlugins(payload) {
    // XXX: Currently using as quick hack to deal with aynchronous updates
    // of process plugins (can avoid with synchronous mqtt messages)
    if (this.processPluginsHasInitialized == false) {
      this.allPlugins = this.newPlugins;
      this.trigger("set-process-plugins", this.allPlugins);
    }
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
    this.addPlugin(file);
  }
  onPluginFound(payload){
    const plugin_path = payload.plugin_path;
    console.log("PLUGIN FOUND:::");
    console.log(plugin_path);
  }
  onRemovePlugin(payload) {
    const filepath = payload.filepath;
    this.plugins.delete(filepath);
    this.trigger("set-web-plugins", [...this.plugins]);
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
    this.plugins = new Set(payload);
    for (const filepath of this.plugins) {
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
