const _ = require('lodash');
const crossroads = require('crossroads');
const Backbone = require('backbone');
const NodeMqttClient = require('@mqttclient/node');

class PluginModel extends NodeMqttClient {
  constructor() {
    super("localhost", 1883, "microdrop");
    this.client.on("connect", this._listen.bind(this));
  }

  _listen() {
    this.onSignalMsg("web-server", "running-state-requested",
      this.onRunningStateRequested.bind(this));
    this.bindSignalMsg("running", "send-running-state");
  }

  // ** Methods **
  sameSender(payload) {
    if (payload.__head__){
      if (payload.__head__.plugin_name == this.name)
        return true;
    }
    return false;
  }

  getReceiver(payload) {
    if (!payload.__head__) return false;
    if (!payload.__head__.plugin_name) return false;
    return payload.__head__.plugin_name;
  }

  notifySender(payload, response, endpoint, status='success') {
    if (status != 'success') {
      console.error("ERROR:", _.flattenDeep([response]));
      response = _.flattenDeep(response);
    }
    const receiver = this.getReceiver(payload);
    if (!receiver) {return response}
    this.sendMessage(
      `microdrop/${this.name}/notify/${receiver}/${endpoint}`,
      this.wrapData(null, {status: status, response: response}));
    return response;
  }

  wrapData(key, value) {
    // Add "__head__" key to msg and also convert to object
    let msg = new Object();
    if (typeof(value) == "object" && value !== null) msg = value;
    else msg[key] = value;
    msg.__head__ = this.DefaultHeader();
    return msg;
  }

  // ** Event Handlers **
  onRunningStateRequested(payload) {
    // XXX: This method breaks if PluginModel.js is not in same directory
    //      as what is inheriting it
    this.trigger("send-running-state", __dirname);
  }

  // ** Initializers **
  DefaultHeader() {
    const header = new Object();
    header.plugin_name = this.name;
    header.plugin_version = this.version;
    return header;
  }

};

module.exports = PluginModel;
