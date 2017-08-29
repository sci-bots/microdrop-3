const _ = require('lodash');
const _fp = require('lodash/fp');

const DataController = require('./DataController');

class DeviceDataController extends DataController {
  constructor () {
    super();
  }

  listen() {
    this.addStateRoute("/device", "device-set", true);
    this.addPutRoute("device-info-plugin", "device", "put-device",false);
    this.addRoute("microdrop/device-info-plugin/state/device", this.onDeviceSet.bind(this));
    this.addRoute("microdrop/{*}/load-device", this.onLoadDevice.bind(this));
    this.addRoute("microdrop/data-controller/device", this.onDeviceSet.bind(this));
    this.addPostRoute("/device", "update-device", true);
  }

  get channel(){return "microdrop/device"}
  get device() {return this._device}
  set device(device) {this._device = device}

  onDeviceSet(payload) {
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
module.exports = DeviceDataController;
