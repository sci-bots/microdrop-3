const fs = require('fs');
const path = require('path');

const _ = require('lodash');
const Backbone = require('backbone');
const express = require('express');

const MoscaServer  = require('./MoscaServer');
const NodeMqttClient = require('./NodeMqttClient');

class WebServer extends NodeMqttClient {
  constructor() {
    super("localhost", 1883, "microdrop");
    _.extend(this, this.ExpressServer());
    this.use(express.static(__dirname+"/mqtt-admin",    {extensions:['html']}));
    this.use(express.static(__dirname+"/web-ui/public", {extensions:['html']}));
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
  onWebPluginsChanged(payload) {
    this.plugins = new Set(payload);
  }
  onAddWebPlugin(payload) {
    const file = path.resolve(payload);
    const fileExists = fs.existsSync(file);
    const extension = path.extname(file);

    // Ensure file exists, and is a javascript file:
    let error;
    if (!fileExists) error = "file does not exists";
    if (extension != ".js") error = "plugins must be javascript (.js) files"
    if (error) { this.trigger("set-web-plugins-failed", error); return}

    // Add plugin to list of web-plugins:
    this.plugins.add(file);
    this.trigger("set-web-plugins", [...this.plugins]);
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

const moscaServer = new MoscaServer();
const webServer = new WebServer();
