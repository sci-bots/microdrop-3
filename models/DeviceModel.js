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
  wrapData(key, value) {
    let msg = new Object();
    // Convert message to object if not already
    if (typeof(value) == "object" && value !== null) msg = value;
    else msg[key] = value;
    // Add header
    msg.__head__ = this.DefaultHeader();
    return msg;
  }
  get name() {return "device-model" }
  get channel() {return "microdrop/device"}
  get device() {return this._device}
  set device(device) {this._device = device}
  get filepath() {return __dirname;}

  onPutDevice(payload) {
    this.trigger("device-set", this.wrapData(null,payload))
  }
  onLoadDevice(payload) {
    this.trigger("put-device", this.wrapData(null,payload))
  }
  // ** Overrides **
  onStart(payload) {
    this.trigger("plugin-started",__dirname);
  }
}
module.exports = DeviceModel;
