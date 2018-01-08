const lo = require('lodash');
const crossroads = require('crossroads');
const Backbone = require('backbone');
const mqtt = require('mqtt');

const MQTTMessages = require('@mqttclient/mqtt-messages');

function resolveTarget(target){
  // TODO: allow for local, and absolute target paths
  // i.e. /execute => microdrop/plugin/execute
  //      microdrop/plugin/execute => microdrop/plugin/execute (same)
  if (target.charAt(0) != '/') target = `/${target}`
  return target;
}

const decamelize = (str, sep='-') => {
  // https://github.com/sindresorhus/decamelize
  return str
    .replace(/([a-z\d])([A-Z])/g, '$1' + sep + '$2')
    .replace(/([A-Z]+)([A-Z][a-z\d]+)/g, '$1' + sep + '$2')
    .toLowerCase();
}

class NodeMqttClient {
  constructor(host="localhost", port=1883, base="microdrop") {
    lo.extend(this, Backbone.Events);
    lo.extend(this, crossroads.create());
    lo.extend(this, MQTTMessages);

    this.base = base;
    this.port = port;
    this.host = host;
    this.client = this.Client(host,port);
    this.subscriptions = new Array();
    this.mqtt = mqtt;

    // XXX: ignoreState variable used internally by crossroads
    this.ignoreState = true;
    this.clientId = this.ClientID();
  }
  listen() {
    console.error(`No listen method implemented for ${this.name}`);
  }
  get connected() {
    return this.client.connected;
  }
  get name() {
    return encodeURI(decamelize(this.constructor.name));
  }
  get filepath() {
    const childName  = this.constructor.name;
    const parentName =  Object.getPrototypeOf(this.constructor).name;
    if (childName != parentName){
      throw `CLASS MISSING GETTER METHOD: filepath
      class ${childName} does not contain getter "filepath". Please implement.
      ex: class ${childName} {... get filepath() {return __dirname } ... }
      `
      return;
    }
    return __dirname;
  }
  get version() {return "0.0"}
  // ** Methods **
  addGetRoute(topic, method) {
    console.error("<NodeMqttClient>:: GET ROUTE DEPRICATED: ", topic, method);
  }
  getReceiver(payload) {
    // XXX: Remove this method from WebServer and PluginModel
    if (!payload.__head__) return false;
    if (!payload.__head__.plugin_name) return false;
    return payload.__head__.plugin_name;
  }
  addPostRoute(topic, event, retain=false, qos=0, dup=false){
    // TODO: Depricate channel (instead use base/plugin)
    topic = resolveTarget(topic);
    this.on(event, (d) => this.sendMessage(this.channel+topic, d, retain, qos, dup));
  }
  addPutRoute(plugin, state, event, retain=true, qos=0, dup=false){
    const channel = `${this.base}/put/${plugin}/state/${state}`;
    this.on(event, (d) => this.sendMessage(channel, d, retain, qos, dup));
  }
  addStateErrorRoute(state, event, retain=true, qos=0, dup=false){
    state = resolveTarget(state);
    const channel = `${this.base}/state/error${state}`;
    this.on(event, (d) => this.sendMessage(channel, d, retain, qos, dup));
  }
  addStateRoute(state, event, retain=true, qos=0, dup=false){
    state = resolveTarget(state);
    const channel = `${this.base}/state${state}`;
    this.on(event, (d) => this.sendMessage(channel, d, retain, qos, dup));
  }
  sendMessage(topic, msg={}, retain=false, qos=0, dup=false){
    const message = JSON.stringify(msg);
    const options = this.MessageOptions(retain,qos,dup);
    this.client.publish(topic, message, options);
  }
  // ** Event Handlers **
  onConnect() {
    this.listen();
    this.trigger("start",null);
  }
  onMessage(topic, buf){
    if (!topic) return;
    if (!buf.toString().length) return;
    try {
      const msg = JSON.parse(buf.toString());
      this.parse(topic, [msg]);
    } catch (e) {
      console.log(buf.toString());
      console.log(e);
    }
  }
  wrapData(key, value) {
    // Add "__head__" key to msg and also convert to object
    let msg = new Object();
    if (typeof(value) == "object" && value !== null) msg = value;
    else msg[key] = value;
    msg.__head__ = this.DefaultHeader();
    return msg;
  }

  // ** Initializers **
  Client(host,port) {
    const client = mqtt.connect(`mqtt://${host}:${port}`,
      {clientId: this.clientId});
    client.on("connect", this.onConnect.bind(this));
    client.on("message", this.onMessage.bind(this));
    return client;
  }
  DefaultHeader() {
    const header = new Object();
    header.plugin_name = this.name;
    header.plugin_version = this.version;
    return header;
  }
  MessageOptions(retain=false, qos=0, dup=false) {
    const options = new Object();
    options.retain = retain;
    options.qos = qos;
    options.dup = dup;
    return options;
  }
  ClientID() {
    const num = Math.ceil(Math.random()*1000);
    return `${this.name}>>${this.filepath}>>${Date.now()}.${num}`;
  }
};

module.exports = NodeMqttClient;
