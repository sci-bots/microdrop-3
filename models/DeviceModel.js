const _ = require('lodash');
const _fp = require('lodash/fp');

const PluginModel = require('./PluginModel');

class DeviceModel extends PluginModel {
  constructor () {
    super();
  }
  listen() {
    this.onTriggerMsg("load-device", this.onLoadDevice.bind(this));
    this.onPutMsg("device", this.onPutDevice.bind(this));
    this.bindPutMsg("device_info_plugin", "device", "put-device");
    this.bindStateMsg("device", "device-set");
  }
  get name() {return "device-model" }
  get channel() {return "microdrop/device"}
  get device() {return this._device}
  set device(device) {this._device = device}
  get filepath() {return __dirname;}

  onPutDevice(payload) {
    this.trigger("device-set", this.wrapData(null,payload));
  }
  onLoadDevice(payload) {
    const receiver = this.getReceiver(payload);
    const _this = this;
    let callback;
    callback = (response) => {
      this.off("device-set", callback);
      if (!receiver) return;
      this.sendMessage(
        `microdrop/${this.name}/notify/${receiver}/load-device`,
        this.wrapData(null, {success: true, response: response}));
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
