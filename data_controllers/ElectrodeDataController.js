const _ = require('lodash');

const DataController = require('./DataController');

class ElectrodeDataController extends DataController {
  constructor () {
    super();
    this.electrodes = new Array();
  }

  // ** Getters and Setters **
  get channel() {
    return "microdrop/electrode-data-controller";
  }

  // ** Event Listeners **
  listen () {
    this.addRoute("microdrop/dmf-device-ui/set-electrode-state", this.onSetElectrodeState.bind(this));
    this.addRoute("microdrop/droplet-planning-plugin/set-electrode-states", this.onSetElectrodeState.bind(this));
  }

  // ** Event Handlers **
  onSetElectrodeState (payload) {
    console.log("Set Electrode State::");
    console.log(payload);
  }

}

module.exports = ElectrodeDataController;
