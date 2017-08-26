const os = require('os');
const {spawn} = require('child_process');

const _ = require('lodash');
const Backbone = require('backbone');
const connect = require('connect');
const crossroads = require('crossroads');
const level = require('level');
const mosca = require('mosca');
const serveStatic = require('serve-static');

const ElectrodeDataController = require('./data_controllers/ElectrodeDataController');
const ProtocolDataController  = require('./data_controllers/ProtocolDataController');
const RoutesDataController    = require('./data_controllers/RoutesDataController');

const IsJsonString = (str) => {
  try { JSON.parse(str);} catch (e) {return false;}
  return true;
}

class MoscaServer {
  constructor() {
    _.extend(this, Backbone.Events);
    _.extend(this, crossroads.create());
    this.ignoreState = true;

    const http  = new Object();
    http.port   = 8083;
    http.bundle = true;
    http.static = "./";

    const settings = new Object();
    settings.port  = 1883;
    settings.http  = http;

    // XXX: Assuming setting time to zero with call indefinite timeout
    //      (this should be verified through Mosca's documentation)
    const db_settings         = new Object();
    db_settings.path          = __dirname+"./db";
    db_settings.subscriptions = 0;
    db_settings.packets       = 0;

    this.db = new mosca.persistence.LevelUp(db_settings);
    this.settings = settings;
    this.server = new mosca.Server(settings);
    this.db.wire(this.server);

    this.runningPlugins = new Object();
    this.listen();
  }

  // ** Event Listeners **
  listen() {
    this.server.on('clientConnected', this.onConnected.bind(this));
    this.server.on('published', this.onPublish.bind(this));
    this.server.on('ready', this.onSetup.bind(this));

    this.addPostRoute("/running-plugins", "running-plugins-set", true);
    this.addRoute("microdrop/{plugin_name}/plugin-started", this.onPluginStarted.bind(this));
    this.addRoute("microdrop/{plugin_name}/plugin-exited", this.onPluginExited.bind(this));
    this.addRoute("microdrop/plugin-manager/launch-plugin", this.onLaunchPlugin.bind(this));
    this.addRoute("microdrop/plugin-manager/close-plugin", this.onClosePlugin.bind(this));

  }

  // ** Getters and Setters **
  get channel() {return "microdrop/broker";}

  // ** Methods **
  addPostRoute(topic, event, retain=false, qos=0, dup=false){
    // Route endpoint used for publishing
    // topic: mqtt topic
    // event: event name used to trigger publish
    this.on(event, (d) => this.sendMessage(this.channel+topic, d, retain, qos, dup));
  }

  sendMessage(topic, msg={}, retain=false, qos=0, dup=false){
    const message = new Object();
    message.topic = topic;
    message.payload = JSON.stringify(msg);
    message.qos = qos;
    message.retain = retain;
    this.server.publish(message);
  }

  // ** Event Handlers **
  onConnected(client) {
    console.log('client connected', client.id);
  }

  onPublish(packet, client){
    // TODO: Allow for empty payloads
    if (typeof(packet.topic)   != "string") return;
    if (typeof(packet.payload) != "object") return;
    const topic   = packet.topic;
    const payload = packet.payload;
    this.onMessage(topic, payload);
  }

  onMessage(topic, buf){
    if (!topic) return;
    if (!buf.toString().length) return;
    const msg = JSON.parse(buf.toString());
    this.parse(topic, [msg]);
  }

  onClosePlugin(pluginName) {
    const topic = "microdrop/"+pluginName+"/exit";
    this.sendMessage(topic);
  }

  onLaunchPlugin(payload) {
    const pluginPath = payload;
    const platform = os.platform();
    let npm;

    // For windows, use npm.cmd to run plugin
    if (platform == "win32") npm = "npm.cmd";
    if (platform != "win32") npm = "npm";

    // Spawn child and de-reference so it doesn't close when the broker does
    const child = spawn(npm, ["start", "--prefix", pluginPath]);
    child.unref();
  }

  onPluginStarted(payload, pluginName) {
    if (!(pluginName in this.runningPlugins))
      this.runningPlugins[pluginName] = payload;
    this.trigger("running-plugins-set", this.runningPlugins);
    console.log("Starting Plugin::");
    console.log(this.runningPlugins);
  }

  onPluginExited(payload, pluginName) {
    if (pluginName in this.runningPlugins)
      delete this.runningPlugins[pluginName];
    this.trigger("running-plugins-set", this.runningPlugins);
    console.log("REMOVING PLUGIN::");
    console.log(this.runningPlugins);
  }

  onSetup() {
    console.log('Mosca server is up and running on port: ' + this.settings.port +
                 ' and http port: ' + this.settings.http.port);

    this.electrodeDataController = new ElectrodeDataController();
    this.routesDataController    = new RoutesDataController();
    this.protocolDataController  = new ProtocolDataController();
  }

  onExit(options, err) {
    this.electrodeDataController.trigger("exit");
    this.routesDataController.trigger("exit");
    this.protocolDataController.trigger("exit");
    if (options.exit)
      setTimeout(() => process.exit(), 500);
  }

}

class DashboardServer {
  constructor() {
    this.port = 3000;
    this.server = connect();
    this.server.use(serveStatic(__dirname+"/mqtt-admin"));
    this.server.listen(this.port);
    console.log("View dashboard on port " + this.port);
  }
}

const moscaServer = new MoscaServer();
const dashboardServer = new DashboardServer();
