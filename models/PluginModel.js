const _ = require('lodash');
const crossroads = require('crossroads');
const Backbone = require('backbone');
const NodeMqttClient = require('@mqttclient/node');

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
    this.onSignalMsg("web-server", "running-state-requested",
      this.onRunningStateRequested.bind(this));
    this.bindSignalMsg("running", "send-running-state");
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
    this.trigger("plugin-exited", __dirname);
  }
  onStart(payload) {
    this.trigger("plugin-started", __dirname);
  }
  onRunningStateRequested(payload) {
    this.trigger("send-running-state", __dirname);
  }

  // ** Initializers **
  DefaultHeader() {
    const header = new Object();
    header.plugin_name = this.name;
    header.plugin_version = this.version;
  }

};

module.exports = PluginModel;
