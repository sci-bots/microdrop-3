const fs = require('fs');
const path = require('path');

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
    /* Listen for http, mqtt, and local events */
    this.get('/', this.onShowIndex.bind(this));
    this.addGetRoute("microdrop/{*}/add-web-plugin", this.onAddWebPlugin.bind(this));
    this.addGetRoute("microdrop/state/web-plugins", this.onWebPluginsChanged.bind(this));
    this.addStateRoute("web-plugins", "set-web-plugins");
    this.addStateErrorRoute("web-plugins", "set-web-plugins-failed");
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
  onWebPluginsChanged(payload) {
    this.plugins = new Set(payload);
    for (const filepath of this.plugins) {
      this.use(express.static(path.dirname(filepath), {extensions:['html']}));
    }
    generateDisplayTemplate();
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
