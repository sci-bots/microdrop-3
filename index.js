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
    this._listen();
  }

  _listen() {
    this.client.on("connect", this.onConnect.bind(this));
    this.client.on("message", this.onMessage.bind(this));
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
  onConnect() {
    this.client.subscribe('microdrop/#');
  }

  onMessage(topic, buf){
    if (!topic) return;
    if (!buf.toString().length) return;
    console.log(topic);
    const msg = JSON.parse(buf.toString());
    this.parse(topic, [msg]);
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

class RoutesDataController extends DataController {
  constructor() {
    super();
    this.listen();
  }

  // ** Event Listeners **
  listen() {
    this.addRoute("microdrop/droplet-planning-plugin/routes",  this.onRoutesUpdated.bind(this));
    this.addRoute("microdrop/data-controller/route-options", this.onUpdateRouteOptions.bind(this));

    this.addPutRoute("droplet-planning-plugin", "routes","routes-set");
    this.addPutRoute("data-controller", "route-options", "route-options-set");
    this.addPutRoute("dmf-device-ui", "routes", "routes-set");

    this.addPutRoute("droplet-planning-plugin", "route-repeats", "route-repeats-set");
    this.addPutRoute("droplet-planning-plugin", "repeat-duration-s", "repeat-duration-s-set");
    this.addPutRoute("droplet-planning-plugin", "trail-length", "trail-length-set");
    this.addPutRoute("droplet-planning-plugin", "transition-duration-ms", "transition-duration-ms-set");
  }

  // ** Getters and Setters **
  get channel() {
    return "microdrop/routes-data-controller";
  }

  get state() {
    const state = new Object();
    state.drop_routes = this.dropRoutes;
    state.repeat_duration_s = this.repeatDurationSeconds;
    state.route_repeats = this.routeRepeats;
    state.transition_duration_ms = this.transitionDurationMilliseconds;
    state.trail_length = this.trailLength;
    return state;
  }

  get dropRoutes() {
    return this._dropRoutes;
  }

  set dropRoutes(dropRoutes) {
    // XXX: Be careful not to override _routes class variable (used by crossroads)
    this._dropRoutes = dropRoutes;
  }

  get repeatDurationSeconds() {
    return this._repeatDurationSeconds;
  }

  set repeatDurationSeconds(repeatDurationSeconds) {
    this._repeatDurationSeconds = repeatDurationSeconds;
    this.trigger("repeat-duration-s-set", this.repeatDurationSeconds);
  }

  get routeRepeats() {
    return this._routeRepeats;
  }

  set routeRepeats(routeRepeats) {
    this._routeRepeats = routeRepeats;
    this.trigger("route-repeats-set", this.routeRepeats);
  }

  get stepNumber() {
    return this._stepNumber;
  }

  set stepNumber(stepNumber) {
    this._stepNumber = stepNumber;
  }

  get transitionDurationMilliseconds() {
    return this._transitionDurationMilliseconds;
  }

  set transitionDurationMilliseconds(transitionDurationMilliseconds) {
    this._transitionDurationMilliseconds = transitionDurationMilliseconds;
    this.trigger("transition-duration-ms-set", this.transitionDurationMilliseconds);
  }

  get trailLength() {
    return this._trailLength;
  }

  set trailLength(trailLength) {
    this._trailLength = trailLength;
    this.trigger("trail-length-set", this.trailLength);
  }

  // ** Methods **
  updateDropletPlanningPlugin(d) {
    if ("drop_routes" in d) this.dropRoutes = d.drop_routes;
    if ("trail_length" in d) this.trailLength = d.trail_length;
    if ("transition_duration_ms" in d) this.transitionDurationMilliseconds = d.transition_duration_ms;
    if ("repeat_duration_s" in d) this.repeatDurationSeconds = d.repeat_duration_s;
    if ("route_repeats" in d) this.routeRepeats = d.route_repeats;
  }

  // ** Event Handlers **
  onRoutesUpdated(payload) {
    this.dropRoutes = payload;
    this.trigger("route-options-set", this.state);
    this.trigger("routes-set", this.dropRoutes);
  }

  onUpdateRouteOptions(payload) {
    this.updateDropletPlanningPlugin(payload);
    this.trigger("routes-set", this.dropRoutes);
  }

  onStepSwapped(payload) {
    const data = payload.stepData;
    this.stepNumber = payload.stepNumber;

    if (data.droplet_planning_plugin)
      this.updateDropletPlanningPlugin(data.droplet_planning_plugin);
  }

}

class ProtocolDataController extends DataController {
  constructor() {
    super();
    this.protocols  = new Array();
    this.listen();
  }

  // ** Event Listeners **
  listen() {
    // Experiment Controller (Load, Save, Import, and Export Protocols):
    //  "change-protocol": Changes that active/loaded protocol in data controller
    //  "mqtt-plugin": bridge between ProtocolDataController and old Microdrop ProtocolController
    //  "experiment-controller": load, save, import and export protocols

    this.addRoute("microdrop/dmf-device-ui/change-protocol", this.onSetProtocol.bind(this));
    this.addPutRoute("mqtt-plugin", "protocol", "protocol-set");
    this.addPutRoute("experiment-controller", "protocol", "protocol-set");

    this.addRoute("microdrop/{*}/protocols", this.onGetProtocols.bind(this));
    this.addRoute("microdrop/{*}/save-protocol", this.onSaveProtocol.bind(this));
    this.addRoute("microdrop/{*}/delete-protocol", this.onDeleteProtocol.bind(this));
    this.addRoute("microdrop/{*}/request-protocol-export", this.onExportProtocolRequested.bind(this));
    this.addRoute("microdrop/{*}/upload-protocol", this.onUploadProtocol.bind(this));
    this.addPostRoute("/protocols","update-protocols", true);
    this.addPostRoute("/send-protocol", "send-protocol");

    // Protocol Controller (Updated Protocol Steps, Running State, and Number of Repeats)
    //  "delete-step"  delete selected step
    //  "insert-step"  inserts step at end of protocol
    //  "update-step"  change the value of on of the step values
    //  "step-changed" request made from Microdrop UI to change step

    this.addRoute("microdrop/dmf-device-ui/delete-step", this.onDeleteStep.bind(this));
    this.addRoute("microdrop/dmf-device-ui/insert-step", this.onInsertStep.bind(this));
    this.addRoute("microdrop/dmf-device-ui/update-step-number", this.onUpdateStepNumber.bind(this));
    this.addRoute("microdrop/dmf-device-ui/update-step", this.onUpdateStep.bind(this));
    // this.addRoute("microdrop/mqtt-plugin/step-changed",this.onStepChanged.bind(this));

    this.addPutRoute("protocol-controller", "steps", "steps-set");
    this.addPutRoute("mqtt-plugin", "steps", "steps-set");

    this.addPutRoute("mqtt-plugin", "step-number", "step-number-set");
    this.addPutRoute("protocol-controller", "step-number", "step-number-set");

    // Routes (TODO: Migrate to own DataController):
    this.addPostRoute("/route-options", "update-route-options", true);
    this.addRoute("microdrop/put/data-controller/state/route-options", this.oneRouteOptionsUpdated.bind(this));

  }

  // ** Getters and Setters **
  get channel() {
    // TODO: Change to "microdrop/protocol-data-controller";
    return "microdrop/data-controller";
  }

  get messages(){
    const messages = new Object();
    messages.noProtocol = "No protocol available to save. Refusing to add protocol";
    messages.protocolDoesNotExist = "Protocol does not exist.";
    return messages;
  }

  get protocol() {
    return this._protocol;
  }

  set protocol(protocol) {
    this._protocol = protocol;
  }

  get steps() {
    if (!this.protocol) return null;
    return this.protocol.steps;
  }

  set steps(steps) {
    if (!this.protocol) return;
    this.protocol.steps = steps;
  }

  get step() {
    if (!this.steps) return null;
    return this.steps[this.stepNumber];
  }

  set step(step) {
    if (!this.steps) return;
    this.steps[this.stepNumber] = step;
  }

  get stepNumber() {
    return this._stepNumber;
  }

  set stepNumber(stepNumber) {
    if (!this.steps) return;
    this._stepNumber = stepNumber;
  }

  // ** Methods **
  addProtocol() {
    if (!this.protocol) { console.warning(this.messages.noProtocol); return;}
    this._protocols.push(this.protocol);
    this.trigger("protocols-changed", this._protocols);
  }

  deleteProtocolAtIndex(index) {
    this.protocols.splice(index, 1);
    this.trigger("update-protocols", this.protocols);
  }

  getProtocolIndex(name){
    const protocols = this.protocols;
    return _.findIndex(protocols, (p) => {return p.name == name});
  }

  // ** Event Handlers **
  onDeleteProtocol(payload) {
    const protocol = payload;
    const index = this.getProtocolIndex(protocol.name);
    this.deleteProtocolAtIndex(index);
  }

  onInsertStep(payload) {
    // payload: {stepNumber}
    const stepNumber = payload;
    const steps = this.steps;
    const step = _.cloneDeep(this.step);
    this.steps.splice(stepNumber, 0, step);
    this.stepNumber = stepNumber + 1;
    this.trigger("steps-set", this.steps);
    this.trigger("step-number-set", this.stepNumber);
    if ("droplet_planning_plugin" in this.step)
      this.trigger("update-route-options", this.step.droplet_planning_plugin);
  }

  onSetProtocol(payload) {
    // Set the active / loaded protocol in the data controller
    const protocol = payload;
    this.protocol = protocol;

    this.stepNumber = 0;
    this.trigger("protocol-set", protocol);
    this.trigger("steps-set", this.steps);
    this.trigger("step-number-set", this.stepNumber);
    if ("droplet_planning_plugin" in this.step)
      this.trigger("update-route-options", this.step.droplet_planning_plugin);
  }

  onGetProtocols(payload) {
    if (!_.isArray(payload)) return;
    this.protocols = payload;
  }

  onExportProtocolRequested(payload) {
    const protocol = this.protocol;
    const str = protocol;
    this.trigger("send-protocol", str);
  }

  onSaveProtocol(payload) {
    const name  = payload;
    const index = this.getProtocolIndex(name);
    this.protocol.name = name;
    if (index < 0)  this.protocols.push(this.protocol);
    if (index >= 0) this.protocols[index] = this.protocol;
    this.trigger("update-protocols", this.protocols);
  }

  onStepChanged(payload) {
    if (!this.steps) return;

    // XXX: This method currently is depricated (as functionaility is moved over)
    //      to WebUI and ProtocolDataController
    this.stepNumber = payload.stepNumber;
    this.step = payload.stepData;
    // if ("droplet_planning_plugin" in this.step)
    //   this.trigger("update-route-options", this.step.droplet_planning_plugin);
  }

  onDeleteStep(payload) {
    const prevStepNumber = payload;
    let nextStepNumber;
    if (prevStepNumber == 0) nextStepNumber = 0;
    if (prevStepNumber != 0) nextStepNumber = prevStepNumber - 1;
    
    const steps = this.steps;

    steps.splice(prevStepNumber, 1);
    this.steps = steps;
    this.stepNumber = nextStepNumber;
    this.trigger("steps-set", this.steps);
    this.trigger("step-number-set", this.stepNumber);
    if ("droplet_planning_plugin" in this.step)
      this.trigger("update-route-options", this.step.droplet_planning_plugin);
  }

  onUpdateStep(payload) {
    const key = payload.key;
    const val = payload.val;
    const steps = this.steps;
    this.stepNumber = payload.stepNumber;
    _.each(this.step, (s) => { if (key in s) s[key] = val });
    this.steps = steps;
    this.trigger("steps-set", steps);
  }

  oneRouteOptionsUpdated(payload) {
    if (!this.step) return;
    if (!this.steps) return;

    const step = this.step;
    step.droplet_planning_plugin = payload;
    this.step = step;
  }

  onUpdateStepNumber(payload) {
    const stepNumber = payload;
    this.stepNumber = stepNumber;
    console.log("step number changed!!");
    this.trigger("step-number-set", this.stepNumber);
    if ("droplet_planning_plugin" in this.step)
      this.trigger("update-route-options", this.step.droplet_planning_plugin);
  }

  onUploadProtocol(payload) {
    const protocol = payload;
    this.protocols.push(protocol);
    this.trigger("update-protocols", this.protocols);
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

const routesDataController = new RoutesDataController();
const protocolDataController = new ProtocolDataController();
const moscaServer = new MoscaServer();
const dashboardServer = new DashboardServer();
