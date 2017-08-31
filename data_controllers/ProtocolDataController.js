const _ = require('lodash');

const DataController = require('./DataController');

class ProtocolDataController extends DataController {
  constructor() {
    super();
    this.protocols  = new Array();
    this.schema = this.Schema();
  }

  // ** Event Listeners **
  listen() {

    // Protocol
    this.addRoute("microdrop/{*}/protocols", this.onGetProtocols.bind(this));
    this.addRoute("microdrop/{*}/save-protocol", this.onSaveProtocol.bind(this));
    this.addRoute("microdrop/{*}/delete-protocol", this.onDeleteProtocol.bind(this));
    this.addRoute("microdrop/{*}/request-protocol-export", this.onExportProtocolRequested.bind(this));
    this.addRoute("microdrop/{*}/upload-protocol", this.onUploadProtocol.bind(this));
    this.addRoute("microdrop/dmf-device-ui/update-protocol-running-state", this.onUpdateProtocolRunningState.bind(this));
    this.addRoute("microdrop/dmf-device-ui/change-protocol", this.onSetProtocol.bind(this));
    this.addPutRoute("experiment-controller", "protocol-skeleton", "protocol-skeleton-set");
    this.addPostRoute("/protocols","update-protocols", true);
    this.addPostRoute("/protocol-skeletons","update-protocol-skeletons", true);
    this.addPostRoute("/send-protocol", "send-protocol");

    // Schema:
    this.addRoute("microdrop/{pluginName}/update-schema", this.onUpdateSchema.bind(this));
    this.addStateRoute("/schema", "schema-updated");

    // Steps:
    this.addRoute("microdrop/dmf-device-ui/delete-step", this.onDeleteStep.bind(this));
    this.addRoute("microdrop/dmf-device-ui/insert-step", this.onInsertStep.bind(this));
    this.addRoute("microdrop/{*}/update-step-number", this.onUpdateStepNumber.bind(this));
    this.addRoute("microdrop/dmf-device-ui/update-step", this.onUpdateStep.bind(this));
    this.addPutRoute("protocol-controller", "steps", "steps-set");
    this.addPutRoute("mqtt-plugin", "steps", "steps-set");
    this.addPutRoute("mqtt-plugin", "step-number", "step-number-set");
    this.addPutRoute("protocol-controller", "step-number", "step-number-set");

    // Route Options:
    this.addRoute("microdrop/put/data-controller/state/route-options", this.onRouteOptionsUpdated.bind(this));
    this.addPostRoute("/route-options", "update-route-options", true);

    // Electrodes:
    this.addRoute("microdrop/put/protocol-data-controller/state/electrodes", this.onElectrodesUpdated.bind(this));
    this.addPostRoute("/electrode-options", "update-electrode-options", true);

    // Device:
    this.addRoute("microdrop/state/device", this.onDeviceUpdated.bind(this));
    this.addPostRoute("/device", "update-device", true);
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
  get time() {
    return new Date(new Date().getTime()).toLocaleString();
  }
  get steps() {
    if (!this.protocol) return null;
    return this.protocol.steps;
  }
  set steps(steps) {
    // NOTE: Whenever modifying steps, don't modify this.steps directly
    //      ex: const steps = this.steps; ... this.steps = steps;
    if (!this.protocol) return;
    this.protocol.steps = steps;
    this.updateStepNumbers(steps);
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
  createNewProtocol() {
    this.protocol = this.Protocol();
    this.protocols.push(this.protocol);
    this.stepNumber = 0;
    this.trigger("update-protocols", this.protocols);
    this.trigger("update-protocol-skeletons", this.createProtocolSkeletons());
    this.trigger("steps-set", this.steps);
    this.trigger("step-number-set", this.stepNumber);
  }

  createProtocolSkeletons() {
    const skeletons = new Array();
    _.each(this.protocols, (protocol) => {
      skeletons.push(this.ProtocolSkeleton(protocol));
    });
    return skeletons;
  }

  deleteProtocolAtIndex(index) {
    this.protocols.splice(index, 1);
    this.trigger("update-protocols", this.protocols);
    this.trigger("update-protocol-skeletons", this.createProtocolSkeletons());
  }

  getProtocolIndexByName(name){
    const protocols = this.protocols;
    return _.findIndex(protocols, (p) => {return p.name == name});
  }

  updateStepNumbers(steps) {
    // Update step numbers column for protocol steps
    for (const [i, step] of steps.entries()) {
      if (!("defaults" in step)) return;
      step.defaults.step = i;
    }
    return steps;
  }


  // ** Event Handlers **
  onDeleteProtocol(payload) {
    const protocol = payload;
    const index = this.getProtocolIndexByName(protocol.name);
    this.deleteProtocolAtIndex(index);
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

    if ("droplet-planning-plugin" in this.step)
      this.trigger("update-route-options", this.step["droplet-planning-plugin"]);
    if ("electrode-data-controller" in this.step)
      this.trigger("update-electrode-options", this.step["electrode-data-controller"]);
  }
  onDeviceUpdated(payload){
    const protocol = this.protocol;
    if (!protocol) return;
    protocol.device = payload;
    this.protocol = protocol;
    this.trigger("protocol-skeleton-set", this.ProtocolSkeleton(this.protocol));
  }
  onElectrodesUpdated(payload) {
    if (!this.step) return;
    if (!this.steps) return;

    const step = this.step;
    step["electrode-data-controller"] = {electrode_states: payload};
    this.step = step;
  }
  onExportProtocolRequested(payload) {
    const protocol = this.protocol;
    const str = protocol;
    this.trigger("send-protocol", str);
  }
  onGetProtocols(payload) {
    if (!_.isArray(payload)) return;
    this.protocols = payload;
  }
  onInsertStep(payload) {
    // payload: {stepNumber}
    const stepNumber = payload;
    const steps = this.steps;
    const step = _.cloneDeep(this.step);
    steps.splice(stepNumber, 0, step);
    this.steps = steps;
    this.stepNumber = stepNumber + 1;
    this.trigger("steps-set", this.steps);
    this.trigger("step-number-set", this.stepNumber);
    if ("droplet-planning-plugin" in this.step)
      this.trigger("update-route-options", this.step["droplet-planning-plugin"]);
    if ("electrode-data-controller" in this.step)
      this.trigger("update-electrode-options", this.step["electrode-data-controller"]);
  }
  onRouteOptionsUpdated(payload) {
    if (!this.step) return;
    if (!this.steps) return;

    const step = this.step;
    step["droplet-planning-plugin"] = payload;
    this.step = step;
  }
  onSaveProtocol(payload) {
    const name  = payload;
    const index = this.getProtocolIndexByName(name);
    this.protocol.name = name;
    if (index < 0)  this.protocols.push(this.protocol);
    if (index >= 0) this.protocols[index] = this.protocol;
    this.trigger("update-protocols", this.protocols);
    this.trigger("update-protocol-skeletons", this.createProtocolSkeletons());
  }
  onSetProtocol(payload) {
    // Set the active / loaded protocol in the data controller
    const name = payload;
    const index = this.getProtocolIndexByName(name);
    if (index == -1) return;
    this.protocol = this.protocols[index];
    this.stepNumber = 0;
    this.trigger("protocol-skeleton-set", this.ProtocolSkeleton(this.protocol));
    this.trigger("steps-set", this.steps);
    this.trigger("step-number-set", this.stepNumber);

    if ("device" in this.protocol)
      this.trigger("update-device", this.protocol["device"])
    if ("droplet-planning-plugin" in this.step)
      this.trigger("update-route-options", this.step["droplet-planning-plugin"]);
    if ("electrode-data-controller" in this.step)
      this.trigger("update-electrode-options", this.step["electrode-data-controller"]);
  }
  onStart(payload) {
    this.trigger("schema-updated", this.schema);
  }
  onUpdateProtocolRunningState(payload) {
    // TODO: Have the data controller control the execution of steps in a
    // protocol...
    console.log("PROTOCOL RUNNING STATE UPDATED!!");
    console.log(payload);
    // Get list of plugins that will perform actions during step
    // Call for step to execute, and listen for "execution started" signal
    // Wait for all plugins listening to emit "execution complete"
    // Move to next step, if no more steps then end execution
  }
  onUploadProtocol(payload) {
    const protocol = payload;
    this.protocols.push(protocol);
    this.trigger("update-protocols", this.protocols);
    this.trigger("update-protocol-skeletons", this.createProtocolSkeletons());
  }
  onUpdateSchema(payload, pluginName) {
    const defaults = this.SchemaDefaults(payload);
    this.schema[pluginName] = payload;
    this.trigger("schema-updated", this.schema);
    const step = this.step;

    if (!step) return;
    if (pluginName in step) return;

    step[pluginName] = defaults;
    this.step = step;
    this.trigger("steps-set", this.steps);

    // Trigger plugins attached to data controller to update their steps
    if ("droplet-planning-plugin" in this.step)
      this.trigger("update-route-options", this.step["droplet-planning-plugin"]);
    if ("electrode-data-controller" in this.step)
      this.trigger("update-electrode-options", this.step["electrode-data-controller"]);
  }
  onUpdateStep(payload) {
    const key = payload.key;
    const val = payload.val;
    const stepNumber = payload.stepNumber;
    if (!this.steps) this.createNewProtocol();

    // XXX: Attributes distributed accross many plugins (so traverse all of them)
    _.each(this.steps[stepNumber], (s) => { if (key in s) s[key] = val });

    // Trigger plugins attached to data controller to update their steps
    this.trigger("steps-set", this.steps);

    if ("droplet-planning-plugin" in this.step)
      this.trigger("update-route-options", this.step["droplet-planning-plugin"]);
    if ("electrode-data-controller" in this.step)
      this.trigger("update-electrode-options", this.step["electrode-data-controller"]);
  }
  onUpdateStepNumber(payload) {
    const stepNumber = payload;
    console.log("STEP NUMBER::::");
    console.log(stepNumber);
    this.stepNumber = stepNumber;
    this.trigger("step-number-set", this.stepNumber || 0);

    if ("droplet-planning-plugin" in this.step)
      this.trigger("update-route-options", this.step["droplet-planning-plugin"]);
    if ("electrode-data-controller" in this.step)
      this.trigger("update-electrode-options", this.step["electrode-data-controller"]);
  }
  // ** Initializers **
  Protocol() {
    const protocol = new Object();
    const steps    = new Array();
    const step = _.zipObject(_.keys(this.schema), _.map(this.schema, this.SchemaDefaults));
    steps.push(step);
    protocol.name = "Protocol: " + this.time;
    protocol.steps = steps;
    return protocol;
  }

  ProtocolSkeleton(protocol) {
    // Create a copy of the current protocol, with larger attributes undefined

    // Store references:
    const device = protocol.device;
    const steps = protocol.steps;
    // Temporarily remove references from protocol:
    protocol.device = undefined;
    protocol.steps  = undefined;
    // Clone:
    const skeleton = _.cloneDeep(protocol);
    // Re-add pointers:
    protocol.device = device;
    protocol.steps  = steps;

    return skeleton;
  }

  Schema() {
    const schema = new Object();
    schema.defaults = {step: {default: 0, type: 'integer'}};
    return schema;
  }

  SchemaDefaults(schema) {
    // [<value>: { default: <default>,..},..] => [{<value>:<default>},..]
    const getDefaults = (obj) => {
      return _.zipObject(_.keys(obj), _.map(obj, (v) => {return v.default}))
    }
    return getDefaults(schema);
  }

}

module.exports = ProtocolDataController;
