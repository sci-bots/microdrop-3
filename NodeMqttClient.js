const _ = require('lodash');
const crossroads = require('crossroads');
const Backbone = require('backbone');
const mqtt = require('mqtt')

function resolveTarget(target){
  // TODO: allow for local, and absolute target paths
  // i.e. /execute => microdrop/plugin/execute
  //      microdrop/plugin/execute => microdrop/plugin/execute (same)
  if (target.charAt(0) != '/') target = `/${target}`
  return target;
}

class NodeMqttClient {
  constructor(host="localhost", port=1883, base="microdrop") {
    _.extend(this, Backbone.Events);
    _.extend(this, crossroads.create());

    this.base = base;
    this.port = port;
    this.client = this.Client(host,port);
    this.subscriptions = new Array();

    // XXX: ignoreState variable used internally by crossroads
    this.ignoreState = true;
  }
  listen() {
    console.error(`No listen method implemented for ${this.name}`);
  }
  get name() {return this.constructor.name}

  // ** Methods **
  addGetRoute(topic, method) {
    /*
        Add route and mqtt subscription
        topic: mqtt topic <str>
        state: name of state variable to update <str>
    */
    this.addRoute(topic, method);
    // Replace content within curly brackets with "+" wildcard
    this.subscriptions.push(topic.replace(/\{(.+?)\}/g, "+"));
  }
  addPostRoute(topic, event, retain=false, qos=0, dup=false){
    /*
        General endpoint used for publishing
        topic: tail of mqtt topic <str>
        event: event name <str>
    */
    // TODO: Depricate channel (instead use base/plugin)
    topic = resolveTarget(topic);
    this.on(event, (d) => this.sendMessage(this.channel+topic, d, retain, qos, dup));
  }
  addPutRoute(plugin, state, event, retain=true, qos=0, dup=false){
    /*
        Request plugin to update state variable
        plugin: name of pluggin to update <str>
        state: name of state variable to update <str>
        event: name of event that triggers publish <str>
    */
    const channel = `${this.base}/put/${plugin}/state/${state}`;
    this.on(event, (d) => this.sendMessage(channel, d, retain, qos, dup));
  }
  addStateErrorRoute(state, event, retain=true, qos=0, dup=false){
    /*
        Publish to when failed to update state
        state: state name <str>
        event: event name <str>
    */
    state = resolveTarget(state);
    const channel = `${this.base}/state/error${state}`;
    this.on(event, (d) => this.sendMessage(channel, d, retain, qos, dup));
  }
  addStateRoute(state, event, retain=true, qos=0, dup=false){
    /*
        Use state routes after validating output of "put"
        state: state name <str>
        event: event name <str>
    */
    state = resolveTarget(state);
    const channel = `${this.base}/state${state}`;
    this.on(event, (d) => this.sendMessage(channel, d, retain, qos, dup));
  }
  sendMessage(topic, msg, retain=false, qos=0, dup=false){
    const message = JSON.stringify(msg);
    const options = this.MessageOptions(retain,qos,dup);
    this.client.publish(topic, message, options);
  }
  // ** Event Handlers **
  onConnect() {
    // XXX: Depricating subscriptions to base
    //      Move to using same subscription model as WebMqttClient
    this.client.subscribe(`${this.base}/#`);
    for (var s of this.subscriptions) this.client.subscribe(s);
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
      console.error("Could not parse the following message:");
      console.log(buf.toString());
    }
  }
  // ** Initializers **
  Client(host,port) {
    const client = mqtt.connect(`mqtt://${host}:${port}`);
    client.on("connect", this.onConnect.bind(this));
    client.on("message", this.onMessage.bind(this));
    return client;
  }
  MessageOptions(retain=false, qos=0, dup=false) {
    const options = new Object();
    options.retain = retain;
    options.qos = qos;
    options.dup = dup;
    return options;
  }
};

module.exports = NodeMqttClient;
