const _ = require('lodash');

const PluginModel = require('./PluginModel');

class ProtocolModel extends PluginModel {
  constructor() {
    super();
    this.protocols  = new Array();
  }

  // ** Event Listeners **
  listen() {
    // Persistent Messages:
    this.onStateMsg("protocol-model", "protocols", this.onProtocolsSet.bind(this));
    this.onStateMsg("step-model", "steps", this.onStepsSet.bind(this));
    this.onStateMsg("device-model", "device", this.onDeviceSet.bind(this));
    this.onStateMsg("schema-model", "schema", this.onSchemaSet.bind(this));
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

    // Steps:
    this.bindPutMsg("step-model", "steps", "put-steps");
    this.bindPutMsg("step-model", "step-number", "put-step-number");
    this.bindTriggerMsg("step-model", "init-steps", "init-steps");

    // Device:
    this.bindPutMsg("device-model", "device", "put-device");
  }

  // ** Getters and Setters **
  get channel() {
    // TODO: Change to "microdrop/protocol-data-controller";
    return "microdrop/data-controller";
  }
  get name() {return encodeURI(this.constructor.name.split(/(?=[A-Z])/).join('-').toLowerCase());}
  get filepath() {return __dirname;}
  get protocol() {return this._protocol;}
  set protocol(protocol) {this._protocol = protocol;}
  get time() {return new Date(new Date().getTime()).toLocaleString();}

  // ** Methods **
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
  onDeviceSet(payload){
    const protocol = this.protocol;
    if (!protocol) return;
    protocol.device = payload;
    this.protocol = protocol;
    this.trigger("protocol-skeleton-set", this.ProtocolSkeleton(this.protocol));
  }
  onStepsSet(payload) {
    if (!this.protocol) {
      console.warn("CANNOT SET STEPS: protocol not defined");
      return;
    }
    this.protocol.steps = payload;
    this.updateStepNumbers(this.protocol.steps);
  }
  onSchemaSet(payload) {
    this.schema = payload;
  }
  onExportProtocolRequested(payload) {
    const protocol = this.protocol;
    const str = protocol;
    this.trigger("send-protocol", str);
  }
  onProtocolsSet(payload) {
    if (!_.isArray(payload)) return;
    this.protocols = payload;
  }

  onNewProtocol(payload) {
    this.protocol = this.Protocol();
    this.protocols.push(this.protocol);
    this.trigger("protocols-set", this.protocols);
    this.trigger("protocol-skeletons-set", this.createProtocolSkeletons());
    this.trigger("protocol-skeleton-set", this.ProtocolSkeleton(this.protocol));
    this.trigger("put-steps", this.wrapData("steps", this.protocol.steps));
    this.trigger("put-step-number", this.wrapData("stepNumber", 0));
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

    this.trigger("put-steps", this.wrapData("steps",this.protocol.steps));
    this.trigger("put-step-number", this.wrapData("stepNumber", 0));
    this.trigger("protocol-skeleton-set", this.ProtocolSkeleton(this.protocol));

    if ("device" in this.protocol)
      this.trigger("put-device", this.protocol["device"])
  }

  // ** Overrides **
  onUploadProtocol(payload) {
    const protocol = payload.protocol;
    this.protocols.push(protocol);
    this.trigger("protocols-set", this.protocols);
    this.trigger("protocol-skeletons-set", this.createProtocolSkeletons());
  }

  // ** Initializers **
  Protocol() {
    if (!this.schema) {
      console.error(`
        FAILED TO CREATE PROTOCOL
        this.schema === ${this.schema}`);
      return;
    }
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

  SchemaDefaults(schema) {
    // [<value>: { default: <default>,..},..] => [{<value>:<default>},..]
    const getDefaults = (obj) => {
      return _.zipObject(_.keys(obj), _.map(obj, (v) => {return v.default}))
    }
    return getDefaults(schema);
  }

}

module.exports = ProtocolModel;
