const _ = require('lodash');
const crossroads = require('crossroads');
const Backbone = require('backbone');
const mqtt = require('mqtt')

const NodeMqttClient = require('../NodeMqttClient');

class DataController extends NodeMqttClient {
  constructor() {
    super("localhost", 1883, "microdrop");
    this._listen();
  }

  _listen() {
    this.on("start", this.onStart.bind(this));
    this.on("exit",  this.onExit.bind(this));
    this.addPostRoute("/plugin-started","plugin-started", true);
    this.addPostRoute("/plugin-exited", "plugin-exited", true);
  }

  // ** Event Handlers **
  onExit(payload) {
    this.trigger("plugin-exited",__dirname);
  }
  onStart(payload) {
    this.trigger("plugin-started",__dirname);
  }
};

module.exports = DataController;
