const _ = require('lodash');
const crossroads = require('crossroads');
const Backbone = require('backbone');
const NodeMqttClient = require('@mqttclient/node');
const MicrodropAsync = require('@microdrop/async/MicrodropAsync');

class PluginModel extends NodeMqttClient {
  constructor() {
    super("localhost", 1883, "microdrop");
    this.client.on("connect", this._listen.bind(this));
  }

  _listen() {
    this.onSignalMsg("web-server", "running-state-requested",
      this.onRunningStateRequested.bind(this));
    this.bindSignalMsg("running", "send-running-state");
    this.onTriggerMsg("get-subscriptions", this.getSubscriptions.bind(this));
  }

  getSubscriptions(payload, name) {
    const LABEL = "<PluginModel::getSubscriptions>";
    return this.notifySender(payload, this.subscriptions, "get-subscriptions");
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
    return _.get(payload, "__head__.plugin_name");
  }

  async getState(val, timeout=500) {
    const microdrop = new MicrodropAsync();
    let state;
    try {
      state = await microdrop.getState(this.name, val, timeout);
    } catch (e) { state = [] }
    return state;
  }

  dumpStack(label, err) {
    if (err.stack)
      return _.flattenDeep([label, err.stack.toString().split("\n")]);
    if (!err.stack)
      return _.flattenDeep([label, err.toString().split(",")]);
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
