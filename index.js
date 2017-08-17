const _ = require('lodash');
const Backbone = require('backbone');
const connect = require('connect');
const crossroads = require('crossroads');
const level = require('level');
const mosca = require('mosca');
const mqtt = require('mqtt')
const serveStatic = require('serve-static');

class DataController {
  constructor() {
    _.extend(this, Backbone.Events);
    _.extend(this, crossroads.create());

    // TODO: Make port optional
    this.client = mqtt.connect('mqtt://localhost:1883');

    // XXX: ignoreState variable used internally by crossroads
    this.ignoreState = true;
    this.protocols  = new Array();
    this.protocol   = null;
    this.listen();
  }

  // ** Event Listeners **
  listen() {
    this.addRoute("microdrop/{*}/change-protocol", this.onChangeProtocol.bind(this));
    this.addRoute("microdrop/{*}/protocol-changed", this.onProtocolChanged.bind(this));
    this.addRoute("microdrop/{*}/protocols", this.onGetProtocols.bind(this));
    this.addRoute("microdrop/{*}/save-protocol", this.onSaveProtocol.bind(this));
    this.addRoute("microdrop/{*}/protocol-swapped", this.onProtocolSwapped.bind(this));
    this.addRoute("microdrop/{*}/delete-protocol", this.onDeleteProtocol.bind(this));

    this.addPostRoute("/protocols","update-protocols", true);
    this.addPostRoute("/load-protocol", "load-protocol");

    this.client.on("connect", this.onConnect.bind(this));
    this.client.on("message", this.onMessage.bind(this));
  }

  // ** Methods **
  addPostRoute(topic, event, retain=false, qos=0, dup=false){
    const channel = "microdrop/data-controller";
    this.on(event, (d) => this.sendMessage(channel+topic, d, retain, qos, dup));
  }

  addProtocol() {
    if (!this.protocol) { console.warning(this.messages.noProtocol); return;}
    this._protocols.push(this.protocol);
    this.trigger("protocols-changed", this._protocols);
  }

  sendMessage(topic, msg, retain=false, qos=0, dup=false){
    const message = JSON.stringify(msg);
    const options = this.MessageOptions(retain,qos,dup);
    this.client.publish(topic, message, options);
  }

  deleteProtocolAtIndex(index) {
    this.protocols.splice(index, 1);
    this.trigger("update-protocols", this.protocols);
  }

  getProtocolIndex(name){
    const protocols = this.protocols;
    return _.findIndex(protocols, (p) => {return p.name == name});
  }

  // ** Getters and Setters **
  get messages(){
    const messages = new Object();
    messages.noProtocol = "No protocol available to save. Refusing to add protocol";
    messages.protocolDoesNotExist = "Protocol does not exist."
    return messages;
  }

  // ** Event Handlers **
  onConnect() {
    this.client.subscribe('microdrop/#');
  }

  onDeleteProtocol(payload){
    const protocol = payload;
    const index = this.getProtocolIndex(protocol.name);
    this.deleteProtocolAtIndex(index);
  }

  onMessage(topic, buf){
    console.log(topic);
    const msg = JSON.parse(buf.toString());
    this.parse(topic, [msg]);
  }

  onChangeProtocol(payload) {
    const protocol = payload;
    this.trigger("load-protocol", protocol);
  }

  onGetProtocols(payload) {
    if (!_.isArray(payload)) return;
    this.protocols = payload;
  }

  onProtocolChanged(payload) {
    this.protocol = payload;
  }

  onProtocolSwapped(payload) {
    this.protocol = payload;
  }

  onSaveProtocol(payload) {
    const name  = payload;
    const index = this.getProtocolIndex(name);
    this.protocol.name = name;
    if (index < 0)  this.protocols.push(this.protocol);
    if (index >= 0) this.protocols[index] = this.protocol;

    this.trigger("update-protocols", this.protocols);
  }

  // ** Initializers **
  MessageOptions(retain=false, qos=0, dup=false) {
    const options = new Object();
    options.retain = retain;
    options.qos = qos;
    options.dup = dup;
    return options;
  }

}

class MoscaServer {
  constructor() {
    _.extend(this, Backbone.Events);

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

    this.listen();
  }

  // ** Event Listeners **
  listen() {
    this.server.on('clientConnected', this.onConnected.bind(this));
    this.server.on('published', this.onPublish.bind(this));
    this.server.on('ready', this.onSetup.bind(this));
  }

  // ** Event Handlers **
  onConnected(client) {
    console.log('client connected', client.id);
  }

  onPublish(packet, client){}

  onSetup(){
    console.log('Mosca server is up and running on port: ' + this.settings.port +
                 ' and http port: ' + this.settings.http.port);
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

const dataController = new DataController();
const moscaServer = new MoscaServer();
const dashboardServer = new DashboardServer();
