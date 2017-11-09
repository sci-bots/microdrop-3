const THREE = require('three');
const _ = require('lodash');
const MicrodropAsync = require('@microdrop/async');
const SVGRenderer = require('@Microdrop/device-controller/src/svg-renderer');
const ElectrodeControls = require('@microdrop/device-controller/src/electrode-controls');
const PluginModel = require('./PluginModel');

const DIRECTIONS = {LEFT: "left", UP: "up", DOWN: "down", RIGHT: "right"};

class DeviceModel extends PluginModel {
  constructor () {
    super();
    this.microdrop = new MicrodropAsync();
    this.scene = null;
    this.group = null;
  }
  listen() {
    this.onStateMsg("device-model", "three-object", this.setThreeObject.bind(this));
    this.onTriggerMsg("load-device", this.onLoadDevice.bind(this));
    this.onTriggerMsg("get-neighbouring-electrodes", this.getNeighbouringElectrodes.bind(this));
    this.onPutMsg("threeObject", this.onPutThreeObject.bind(this));
    this.onPutMsg("device", this.onPutDevice.bind(this));
    this.bindPutMsg("device_info_plugin", "device", "put-device");
    this.bindStateMsg("device", "device-set");
    this.bindStateMsg("three-object", "set-three-object");
  }
  get name() {return "device-model" }
  get channel() {return "microdrop/device"}
  get device() {return this._device}
  set device(device) {this._device = device}
  get filepath() {return __dirname;}

  setThreeObject(threeObject) {
    const {scene, group} = SVGRenderer.ConstructScene(threeObject);
    this.scene = scene;
    this.group = group;
  }

  getNeighbouringElectrodes(payload) {
    const LABEL = `<DeviceModel::getNeighbouringElectrodes>`;
    try {
      if (!this.scene) throw("scene undefined");
      if (!this.group) throw("group undefined");
      if (!payload.electrodeId) throw("expected 'electrodeId' in payload");
      const electrodeId = payload.electrodeId;
      const neighbours = ElectrodeControls.FindAllNeighbours(this.group, electrodeId);
      return this.notifySender(payload, neighbours,
        "get-neighbouring-electrodes");
    } catch (e) {
      return this.notifySender(payload, [LABEL, e],
        "get-neighbouring-electrodes", 'failed');
    }
  }

  async onPutThreeObject(payload) {
    const LABEL = `<DeviceModel::onPutThreeObject>`;
    try {
      if (!payload.threeObject) throw("expected 'threeObject' in payload");
      this.trigger("set-three-object", payload.threeObject);
      return this.notifySender(payload, 'success', "threeObject");
    } catch (e) {
      return this.notifySender(payload, [LABEL, e], "threeObject", 'failed');
    }
    return object;
  }

  async onPutDevice(payload) {
    const LABEL = `<DeviceModel#onPutDevice>`; console.log(LABEL);
    try {
      let device;
      // Validate payload
      if (payload.device){
        device = payload.device;
      } else {
        console.error(LABEL, "expected key: 'device' in payload");
        device = payload;
      }
      this.trigger("device-set", this.wrapData(null,device));
      await this.microdrop.electrodes.reset();
      return this.notifySender(payload, device, "device");
    } catch (e) {
      return this.notifySender(payload, [LABEL, e] , "device");
    }
  }

  onLoadDevice(payload) {
    const receiver = this.getReceiver(payload);
    const _this = this;
    let callback;
    callback = (response) => {
      this.off("device-set", callback);
      return this.notifySender(payload, response, 'load-device');
    };
    this.on("device-set", callback);
    this.trigger("put-device", this.wrapData(null,payload));
  }

  // ** Overrides **
  onStart(payload) {
    this.trigger("plugin-started",__dirname);
  }
}

module.exports = DeviceModel;
