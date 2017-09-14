const _ = require('lodash');
const crossroads = require('crossroads');
const Backbone = require('backbone');
const mqtt = require('mqtt')

const NodeMqttClient = require('../NodeMqttClient');

class PluginModel extends NodeMqttClient {
  constructor() {
    super("localhost", 1883, "microdrop");
    this._listen();
  }

  _listen() {
    this.on("start", this.onStart.bind(this));
    this.on("exit",  this.onExit.bind(this));

    this.bindSignalMsg("plugin-started", "plugin-started");
    this.bindSignalMsg("plugin-exited", "plugin-exited");

  }

  // ** Methods **
  wrapData(key, value) {
    let msg = new Object();
    // Convert message to object if not already
    if (typeof(value) == "object" && value !== null) msg = value;
    else msg[key] = value;
    // Add header
    msg.__head__ = this.DefaultHeader();
    return msg;
  }

  // ** Event Handlers **
  onExit(payload) {
    this.trigger("plugin-exited",__dirname);
  }
  onStart(payload) {
    this.trigger("plugin-started",__dirname);
  }

  // ** Initializers **
  DefaultHeader() {
    const header = new Object();
    header.plugin_name = this.name;
    header.plugin_version = this.version;
  }

};

module.exports = PluginModel;
