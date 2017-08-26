const _ = require('lodash');
const crossroads = require('crossroads');
const Backbone = require('backbone');
const mqtt = require('mqtt')

class DataController {
  constructor() {
    _.extend(this, Backbone.Events);
    _.extend(this, crossroads.create());

    // TODO: Make port optional
    this.client = mqtt.connect('mqtt://localhost:1883');

    // XXX: ignoreState variable used internally by crossroads
    this.ignoreState = true;
    this._listen();
  }

  _listen() {
    this.client.on("connect", this.onConnect.bind(this));
    this.client.on("message", this.onMessage.bind(this));
    this.on("exit", this.onExit.bind(this));

    this.addPostRoute("/plugin-started","plugin-started", true);
    this.addPostRoute("/plugin-exited", "plugin-exited", true);
  }

  // ** Methods **
  addPutRoute(plugin, state, event, retain=true, qos=0, dup=false){
    // Update state variable for a given plugin
    // plugin: name of pluggin to update
    // state: name of state variable to update
    // event: name of event that triggers publish
    const channel = "microdrop/put/"+plugin+"/state/"+state;
    this.on(event, (d) => this.sendMessage(channel, d, retain, qos, dup));
  }

  addPostRoute(topic, event, retain=false, qos=0, dup=false){
    // Route endpoint used for publishing
    // topic: mqtt topic
    // event: event name used to trigger publish
    this.on(event, (d) => this.sendMessage(this.channel+topic, d, retain, qos, dup));
  }

  sendMessage(topic, msg, retain=false, qos=0, dup=false){
    const message = JSON.stringify(msg);
    const options = this.MessageOptions(retain,qos,dup);
    this.client.publish(topic, message, options);
  }

  // ** Event Handlers **
  onStart(payload) {
    this.trigger("plugin-started",__dirname);
  }

  onExit(payload) {
    this.trigger("plugin-exited",__dirname);
  }

  onConnect() {
    this.client.subscribe('microdrop/#');
    this.listen();
    this.onStart();
  }

  onMessage(topic, buf){
    if (!topic) return;
    if (!buf.toString().length) return;
    try {
      const msg = JSON.parse(buf.toString());
      this.parse(topic, [msg]);
    } catch (e) {
      console.log("Could not parse message");
    }
  }

  // ** Initializers **
  MessageOptions(retain=false, qos=0, dup=false) {
    const options = new Object();
    options.retain = retain;
    options.qos = qos;
    options.dup = dup;
    return options;
  }

};

module.exports = DataController;
