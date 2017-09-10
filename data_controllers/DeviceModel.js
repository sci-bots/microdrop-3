const _ = require('lodash');
const _fp = require('lodash/fp');

const DataController = require('./DataController');

class DeviceModel extends DataController {
  constructor () {
    super();
  }

  listen() {
    this.onTriggerMsg("load-device", this.onLoadDevice.bind(this));
    this.onPutMsg("device", this.onPutDevice.bind(this));
    this.bindPutMsg("device-info-plugin", "device", "put-device");
    this.bindStateMsg("device", "device-set");

    // this.addRoute("microdrop/device-info-plugin/state/device", this.onDeviceSet.bind(this));

    // this.addStateRoute("/device", "device-set", true);
    // this.addPutRoute("device-info-plugin", "device", "put-device",false);
    // this.addRoute("microdrop/{*}/load-device", this.onLoadDevice.bind(this));
    // this.addRoute("microdrop/data-controller/device", this.onDevicePut.bind(this));
    // this.addPostRoute("/device", "update-device", true);
  }

  get name() {return "device-model" }
  get channel() {return "microdrop/device"}
  get device() {return this._device}
  set device(device) {this._device = device}

  onPutDevice(payload) {
    this.trigger("device-set", payload);
  }

  onLoadDevice(payload) {
    this.trigger("put-device", payload);
  }

  // ** Overrides **
  onStart(payload) {
    this.trigger("plugin-started",__dirname);
  }
}
module.exports = DeviceModel;
