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
    this.onTriggerMsg("request-protocol-export", this.onExportProtocolRequested.bind(this));

    // Change trigger to automatically bind "notify messages" (with dynamic receiver topics)
    // to be used with Javascript Promises / MicrodropSync
    this.onTriggerMsg("new-protocol", this.onNewProtocol.bind(this));
    this.onTriggerMsg("save-protocol", this.onSaveProtocol.bind(this));
    this.onTriggerMsg("change-protocol", this.onChangeProtocol.bind(this));
    this.onTriggerMsg("delete-protocol", this.onDeleteProtocol.bind(this));
    this.onTriggerMsg("upload-protocol", this.onUploadProtocol.bind(this));
    this.onTriggerMsg("load-protocol", this.onLoadProtocol.bind(this));

    this.bindTriggerMsg("experiment-ui", "send-protocol", "send-protocol");

    this.bindStateMsg("protocol-skeleton", "protocol-skeleton-set");
    this.bindStateMsg("protocol-skeletons", "protocol-skeletons-set");
    this.bindStateMsg("protocols", "protocols-set");

    // Steps:
    this.bindPutMsg("step-model", "steps", "put-steps");
    this.bindPutMsg("step-model", "step-number", "put-step-number");

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
    this.trigger("protocols-set", this.wrapData(null, this.protocols));
    this.trigger("protocol-skeletons-set", this.createProtocolSkeletons());
  }
  getProtocolIndexByName(name){
    const protocols = this.protocols;
    return _.findIndex(protocols, (p) => {return p.name == name});
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

    const receiver = this.getReceiver(payload);
    if (!receiver) return;
    this.sendMessage(
      `microdrop/${this.name}/notify/${receiver}/delete-protocol`,
      this.wrapData(null, protocol));
  }
  onDeviceSet(payload){
    console.log("<ProtocolModel>:: DeviceSet");

    // TODO: Error messages here
    if (!this.protocol) {
      console.error(`<ProtocolModel> Cannot set device; this.protocol is ${this.protocol}`);
      return;
    }
    if (!this.protocols) {
      console.error(`<ProtocolModel> Cannot set device; this.protocol is ${this.protocols}`);
      return;
    }

    this.protocol.device = payload;
    this.save();
    this.trigger("protocol-skeleton-set", this.ProtocolSkeleton(this.protocol));
    // this.trigger("protocols-set", this.wrapData(null, this.protocols));
    // this.trigger("protocol-skeletons-set", this.createProtocolSkeletons());
  }
  onStepsSet(payload) {
    console.log("<ProtocolModel>:: onStepsSet");

    if (!this.protocol) {
      console.warn("CANNOT SET STEPS: protocol not defined");
      return;
    }
    if (!this.protocols) {
      console.warn("CANNOT SET STEPS: protocols not defined");
      return;
    }

    this.protocol.steps = payload;
    this.save();
  }
  onSchemaSet(payload) {
    console.log("<ProtocolModel>:: Schema Set");
    console.log(payload.__head__);
    this.schema = payload;
  }
  onExportProtocolRequested(payload) {
    const protocol = this.protocol;
    const str = protocol;
    this.trigger("send-protocol", str);
  }
  onProtocolsSet(payload) {
    console.log("<ProtocolModel>:: ProtocolsSet");
    console.log(payload.__head__);
    if (!_.isArray(payload)) return;
    this.protocols = payload;
  }
  onNewProtocol(payload) {
    this.protocol = this.Protocol();
    this.protocols.push(this.protocol);
    this.trigger("protocols-set", this.wrapData(null, this.protocols));
    this.trigger("protocol-skeletons-set", this.createProtocolSkeletons());
    this.trigger("protocol-skeleton-set", this.ProtocolSkeleton(this.protocol));
    this.trigger("put-steps", this.wrapData("steps", this.protocol.steps));
    this.trigger("put-step-number", this.wrapData("stepNumber", 0));

    // Should use a recursive promise tree:
    const receiver = this.getReceiver(payload);
    if (!receiver) return;
    this.sendMessage(
      `microdrop/${this.name}/notify/${receiver}/new-protocol`,
      this.wrapData(null, this.protocol));
  }

  save() {
    if (!this.protocol) {
      console.error(`<ProtocolModel> Failed to save(); this.protocol if ${this.protocol}`);
      return;
    }
    const index = this.getProtocolIndexByName(this.protocol.name);
    this.protocols[index] = this.protocol;

    this.trigger("protocols-set", this.wrapData(null, this.protocols));
    this.trigger("protocol-skeletons-set", this.createProtocolSkeletons());
  }

  onSaveProtocol(payload) {
    const name  = payload.name;
    const index = this.getProtocolIndexByName(name);

    if (index < 0) {
      this.protocol = this.protocol;
      this.protocol.name = name;
      this.protocols.push(this.protocol);
    } else {
      this.protocols[index] = this.protocol;
    }

    this.trigger("protocols-set", this.wrapData(null, this.protocols));
    this.trigger("protocol-skeletons-set", this.createProtocolSkeletons());
  }

  onChangeProtocol(payload) {
    // Set the active / loaded protocol in the data controller
    const name = payload.name;
    const index = this.getProtocolIndexByName(name);
    if (index == -1) return;

    this.protocol = this.protocols[index];

    this.trigger("put-steps", this.wrapData("steps",this.protocol.steps));
    this.trigger("put-step-number", this.wrapData("stepNumber", 0));
    this.trigger("protocol-skeleton-set", this.ProtocolSkeleton(this.protocol));

    // TODO: Chould have automatic triggers for attributes attached to device
    if ("device" in this.protocol)
      this.trigger("put-device", this.protocol["device"]);

    const receiver = this.getReceiver(payload);
    if (!receiver) return;
    this.sendMessage(
      `microdrop/${this.name}/notify/${receiver}/change-protocol`,
      this.wrapData(null, this.protocol));
  }

  onLoadProtocol(payload) {
    let requireConfirmation;
    const protocol = payload.protocol;
    const overwrite = payload.overwrite;

    // Ensure the protocol is valid before loading it
    if (!_.isPlainObject(protocol)) {
      console.error([`<ProtocolModel>:onLoadProtocol Invalid Type`, protocol]);
    }

    // TODO: Change this to a "unique id"
    const index = this.getProtocolIndexByName(protocol.name);

    // If protocol, doesn't exist then create it
    if (index == -1){
      this.protocols.push(protocol);
      this.trigger("protocols-set", this.wrapData(null, this.protocols));
      this.protocol = protocol;
      requireConfirmation = false;
    } else if (!overwrite){
      // Protocol is already loaded, don't overwrite working copy
      // unless asked to do so
      this.protocol = this.protocols[index];
      requireConfirmation = true;
    } else {
      console.log("overriding protocol");
      this.protocols[index] = payload.protocol;
      this.protocol = protocol;
      requireConfirmation = false;
    }

    this.trigger("put-steps", this.wrapData("steps",this.protocol.steps));
    this.trigger("put-step-number", this.wrapData("stepNumber", 0));
    this.trigger("protocol-skeleton-set", this.ProtocolSkeleton(this.protocol));

    // TODO: Store a "default device" when not specified
    if ("device" in this.protocol)
      this.trigger("put-device", this.protocol["device"])

    const receiver = this.getReceiver(payload);
    if (!receiver) return;
    this.sendMessage(
      `microdrop/${this.name}/notify/${receiver}/load-protocol`,
      this.wrapData("requireConfirmation", requireConfirmation));
  }

  onUploadProtocol(payload) {
    const protocol = payload.protocol;
    this.protocols.push(protocol);
    this.trigger("protocols-set", this.wrapData(null, this.protocols));
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

    protocol.name = "Protocol: " + this.time
    while (this.getProtocolIndexByName(protocol.name) != -1) {
      var id = Math.ceil(100*Math.random());
      protocol.name = "Protocol: " + this.time + ":" + id;
    }

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
