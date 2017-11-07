const THREE = require('three');
const _ = require('lodash');
const MicrodropAsync = require('@microdrop/async');
const PluginModel = require('./PluginModel');

class DeviceModel extends PluginModel {
  constructor () {
    super();
    this.microdrop = new MicrodropAsync();
  }
  listen() {
    this.onTriggerMsg("load-device", this.onLoadDevice.bind(this));
    this.onPutMsg("threeSvgGroup", this.onPutThreeSvgGroup.bind(this));
    this.onPutMsg("device", this.onPutDevice.bind(this));
    this.bindPutMsg("device_info_plugin", "device", "put-device");
    this.bindStateMsg("device", "device-set");
  }
  get name() {return "device-model" }
  get channel() {return "microdrop/device"}
  get device() {return this._device}
  set device(device) {this._device = device}
  get filepath() {return __dirname;}

  async onPutThreeSvgGroup(payload) {
    console.log("Putting Three SVG Group::", payload);
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
