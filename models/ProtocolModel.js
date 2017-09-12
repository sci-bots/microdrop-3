const _ = require('lodash');

const PluginModel = require('./PluginModel');

class ProtocolModel extends PluginModel {
  constructor() {
    super();
    this.protocols  = new Array();
    this.schema = this.Schema();
  }

  // ** Event Listeners **
  listen() {
    // Persistent Messages:
    this.onStateMsg("protocol-model", "protocols", this.onProtocolsSet.bind(this));
    this.onStateMsg("electrodes-model", "electrodes", this.onElectrodesUpdated.bind(this));
    this.onStateMsg("electrodes-model", "channels", this.onElectrodeChannelsUpdated.bind(this));
    this.onStateMsg("device-model", "device", this.onDeviceUpdated.bind(this));

    // Protocol
    this.onNotifyMsg("request-protocol-export", this.onExportProtocolRequested.bind(this));
    this.onTriggerMsg("new-protocol", this.onNewProtocol.bind(this));
    this.onTriggerMsg("save-protocol", this.onSaveProtocol.bind(this));
    this.onTriggerMsg("change-protocol", this.onSetProtocol.bind(this));
    this.onTriggerMsg("delete-protocol", this.onDeleteProtocol.bind(this));
    this.onTriggerMsg("upload-protocol", this.onUploadProtocol.bind(this));

    this.bindTriggerMsg("experiment-ui", "send-protocol", "send-protocol");
    this.bindStateMsg("protocol-skeleton", "protocol-skeleton-set");
    this.bindStateMsg("protocol-skeletons", "protocol-skeletons-set");
    this.bindStateMsg("protocols", "protocols-set");

    // Schema:
    this.onSignalMsg("{pluginName}", "update-schema", this.onUpdateSchema.bind(this));
    this.bindStateMsg("schema", "schema-set");

    // Steps:
    this.onPutMsg("step-number", this.onUpdateStepNumber.bind(this));
    this.onTriggerMsg("update-step", this.onUpdateStep.bind(this));
    this.onTriggerMsg("delete-step", this.onDeleteStep.bind(this));
    this.onTriggerMsg("insert-step", this.onInsertStep.bind(this));
    this.bindStateMsg("step-number", "step-number-set");
    this.bindStateMsg("steps", "steps-set");

    // Routes:
    this.onPutMsg("route-options", this.onRouteOptionsUpdated.bind(this));
    this.bindPutMsg("routes-model", "route-options", "put-route-options");

    // Electrodes:
    this.bindPutMsg("electrodes-model", "electrode-options", "put-electrode-options");

    // Device:
    this.bindPutMsg("device-model", "device", "put-device");
  }

  // ** Getters and Setters **
  get channel() {
    // TODO: Change to "microdrop/protocol-data-controller";
    return "microdrop/data-controller";
  }
  get name() {
    return encodeURI(this.constructor.name.split(/(?=[A-Z])/).join('-').toLowerCase());
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
    this.trigger("protocols-set", this.protocols);
    this.trigger("protocol-skeletons-set", this.createProtocolSkeletons());
    this.trigger("steps-set", this.steps);
    this.trigger("step-number-set", this.wrapData("stepNumber", this.stepNumber));
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
    this.trigger("protocols-set", this.protocols);
    this.trigger("protocol-skeletons-set", this.createProtocolSkeletons());
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
  wrapData(key, value) {
    let msg = new Object();
    // Convert message to object if not already
    if (typeof(value) == "object" && value !== null) msg = value;
    else msg[key] = value;
    // Add header
    msg.__head__ = this.DefaultHeader();
    return msg;
  }
  // ** Event Handlers **
  onDeleteProtocol(payload) {
    const protocol = payload.protocol;
    const index = this.getProtocolIndexByName(protocol.name);
    this.deleteProtocolAtIndex(index);
  }
  onDeleteStep(payload) {
    const prevStepNumber = payload.stepNumber;
    let nextStepNumber;
    if (prevStepNumber == 0) nextStepNumber = 0;
    if (prevStepNumber != 0) nextStepNumber = prevStepNumber - 1;

    const steps = this.steps;
    steps.splice(prevStepNumber, 1);
    this.steps = steps;
    this.stepNumber = nextStepNumber;

    this.trigger("steps-set", this.wrapData(null, this.steps));
    this.trigger("step-number-set", this.wrapData("stepNumber", this.stepNumber));
    this.trigger("put-electrode-options", this.step["electrode-data-controller"] || false);

    if ("droplet-planning-plugin" in this.step)
      this.trigger("put-route-options", this.step["droplet-planning-plugin"]);
  }
  onDeviceUpdated(payload){
    const protocol = this.protocol;
    if (!protocol) return;
    protocol.device = payload;
    this.protocol = protocol;
    this.trigger("protocol-skeleton-set", this.ProtocolSkeleton(this.protocol));
  }
  onElectrodesUpdated(payload) {
    if (!this.step) return; if (!this.steps) return;
    const step = this.step;
    if ("electrode-data-controller" in step)
      step["electrode-data-controller"].electrode_states = payload;
    else
      step["electrode-data-controller"] = {electrode_states: payload};

    this.step = step;
  }
  onElectrodeChannelsUpdated(payload) {
    if (!this.step) return; if (!this.steps) return;
    const step = this.step;
    if ("electrode-data-controller" in step)
      step["electrode-data-controller"].channels = payload;
    else
      step["electrode-data-controller"] = {channels: payload};
    this.step = step;
  }
  onExportProtocolRequested(payload) {
    console.log("Export protocol is requested...");
    const protocol = this.protocol;
    const str = protocol;
    this.trigger("send-protocol", str);
  }
  onProtocolsSet(payload) {
    if (!_.isArray(payload)) return;
    this.protocols = payload;
  }
  onInsertStep(payload) {
    // payload: {stepNumber: ...}
    const stepNumber = payload.stepNumber;
    const steps = this.steps;
    const step = _.cloneDeep(this.step);
    steps.splice(stepNumber, 0, step);
    this.steps = steps;
    this.stepNumber = stepNumber + 1;
    this.trigger("steps-set", this.steps);
    this.trigger("step-number-set", this.wrapData("stepNumber",this.stepNumber));
    this.trigger("put-electrode-options", this.step["electrode-data-controller"] || false);

    if ("droplet-planning-plugin" in this.step)
      this.trigger("put-route-options", this.step["droplet-planning-plugin"]);
  }
  onNewProtocol(payload) {
    // Create a blank protocol from the schema
    this.createNewProtocol();
  }
  onRouteOptionsUpdated(payload) {
    if (!this.step) return;
    if (!this.steps) return;

    const step = this.step;
    step["droplet-planning-plugin"] = payload;
    this.step = step;
  }
  onSaveProtocol(payload) {
    const name  = payload.name;
    const index = this.getProtocolIndexByName(name);

    if (index < 0) {
      this.protocol = _.cloneDeep(this.protocol);
      this.protocol.name = name;
      this.protocols.push(this.protocol);
    } else {
      this.protocols[index] = this.protocol;
    }

    this.trigger("protocols-set", this.protocols);
    this.trigger("protocol-skeletons-set", this.createProtocolSkeletons());
  }
  onSetProtocol(payload) {
    // Set the active / loaded protocol in the data controller
    const name = payload.name;
    const index = this.getProtocolIndexByName(name);
    if (index == -1) return;

    // Clone the protocol (so as to not override the old one unless to save)
    this.protocol = _.cloneDeep(this.protocols[index]);
    this.stepNumber = 0;

    this.trigger("protocol-skeleton-set", this.ProtocolSkeleton(this.protocol));
    this.trigger("steps-set", this.steps);
    this.trigger("step-number-set", this.wrapData("stepNumber", this.stepNumber));

    if ("electrode-data-controller" in this.step)
      this.trigger("put-electrode-options", this.step["electrode-data-controller"] || false);
    if ("device" in this.protocol)
      this.trigger("put-device", this.protocol["device"])
    if ("droplet-planning-plugin" in this.step)
      this.trigger("put-route-options", this.step["droplet-planning-plugin"]);
  }

  // ** Overrides **
  onStart(payload) {
    this.trigger("schema-set", this.schema);
    this.trigger("plugin-started",__dirname);
  }

  onUploadProtocol(payload) {
    const protocol = payload.protocol;
    this.protocols.push(protocol);
    this.trigger("protocols-set", this.protocols);
    this.trigger("protocol-skeletons-set", this.createProtocolSkeletons());
  }
  onUpdateSchema(payload, pluginName) {
    const defaults = this.SchemaDefaults(payload);
    this.schema[pluginName] = payload;
    this.trigger("schema-set", this.schema);
    const step = this.step;

    if (!step) return;
    if (pluginName in step) return;

    step[pluginName] = defaults;
    this.step = step;
    this.trigger("steps-set", this.steps);
    this.trigger("put-electrode-options", this.step["electrode-data-controller"] || false);

    // Trigger plugins attached to data controller to update their steps
    if ("droplet-planning-plugin" in this.step)
      this.trigger("put-route-options", this.step["droplet-planning-plugin"]);
  }
  onUpdateStep(payload) {
    console.log("UPDATING STEP:::")
    console.log(payload);
    const data = payload.data;
    const key = data.key;
    const val = data.val;
    const stepNumber = data.stepNumber;
    if (!this.steps) this.createNewProtocol();

    // XXX: Attributes distributed accross many plugins (so traverse all of them)
    _.each(this.steps[stepNumber], (s) => { if (key in s) s[key] = val });

    // Trigger plugins attached to data controller to update their steps
    this.trigger("steps-set", this.steps);
    this.trigger("put-electrode-options", this.step["electrode-data-controller"] || false);

    if ("droplet-planning-plugin" in this.step)
      this.trigger("put-route-options", this.step["droplet-planning-plugin"]);
  }
  onUpdateStepNumber(payload) {
    const stepNumber = payload.stepNumber;
    this.stepNumber = stepNumber;
    this.trigger("step-number-set", this.wrapData("stepNumber", this.stepNumber || 0));
    this.trigger("put-electrode-options", this.step["electrode-data-controller"] || false);

    if ("droplet-planning-plugin" in this.step)
      this.trigger("put-route-options", this.step["droplet-planning-plugin"]);
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

module.exports = ProtocolModel;
