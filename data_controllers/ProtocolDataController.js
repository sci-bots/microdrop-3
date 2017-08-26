const _ = require('lodash');

const DataController = require('./DataController');

class ProtocolDataController extends DataController {
  constructor() {
    super();
    this.protocols  = new Array();
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
    this.addRoute("microdrop/dmf-device-ui/update-protocol-running-state", this.onUpdateProtocolRunningState.bind(this));
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
    const stepNumber = payload.stepNumber;
    const steps = this.steps;

    // XXX: Attributes distributed accross many plugins (so traverse all of them)
    _.each(steps[stepNumber], (s) => { if (key in s) s[key] = val });
    this.steps = steps;

    // Trigger plugins attached to data controller to update their steps
    this.trigger("steps-set", steps);
    if ("droplet_planning_plugin" in this.step)
      this.trigger("update-route-options", this.step.droplet_planning_plugin);
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

  onUpdateProtocolRunningState(payload) {
    // TODO: Have the data controller control the execution of steps in a
    // protocol...
    console.log("PROTOCOL RUNNING STATE UPDATED!!");
    console.log(payload);
  }

  onUploadProtocol(payload) {
    const protocol = payload;
    this.protocols.push(protocol);
    this.trigger("update-protocols", this.protocols);
  }

}

module.exports = ProtocolDataController;
