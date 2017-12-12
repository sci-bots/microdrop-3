const _ = require('lodash');

const MicrodropAsync = require("@microdrop/async");
const PluginModel = require('./PluginModel');


function MapElectrodesAndChannels(threeObject) {
  /* Generate electrode and channel maps from three object */
  const LABEL = "<ElectrodesModel::MapElectrodesAndChannels>";
  try {
    if (!_.isArray(threeObject)) throw("Expected array as argument");
    const electrodes = new Object();
    const channels = new Object();
    for (const [i, object] of threeObject.entries()) {
      const id = object.id;
      const channel = object.channel;

      // Validate object
      if (id == undefined) throw(`id missing for object # ${i}`);
      if (channel == undefined) throw(`channel missing for object # ${i}`);
      if (electrodes[id] != undefined) throw(`multiple instances of id ${id}`);

      // Add channel and id to electrode and channel maps
      if (channels[channel] != undefined) channels[channel].push(id);
      else if (channels[channel] == undefined) channels[channel] = [id];
      electrodes[id] = channel;
    }

    return {electrodes, channels};
  } catch (e) {
    throw(_.flattenDeep([LABEL, e]));
  }
}

class ElectrodesModel extends PluginModel {
  constructor () {
    super();
    this.microdrop = new MicrodropAsync();
  }

  listen() {
    this.bindStateMsg("active-electrodes", "set-active-electrodes");
    this.onPutMsg("active-electrodes", this.putActiveElectrodes.bind(this));
    this.onTriggerMsg("toggle-electrode", this.toggleElectrode.bind(this));
  }

  get filepath() {return __dirname;}


  putActiveElectrodes(payload) {
    const LABEL = "<ElectrodesModel::putActiveElectrodes>"; //console.log(LABEL);
    try {
      const activeElectrodes = payload["active-electrodes"] || payload["activeElectrodes"];
      if (!activeElectrodes) throw ("expected active-electrodes in payload");
      if (!_.isArray(activeElectrodes)) throw("active-electrodes should be array");
      this.trigger("set-active-electrodes", activeElectrodes);
      return this.notifySender(payload, activeElectrodes, "active-electrodes");
    } catch (e) {
      return this.notifySender(payload, this.dumpStack(LABEL, e), "active-electrodes", "failed");
    }
  }

  async toggleElectrode(payload) {
    /* Toggle the state of an electrode */
    const LABEL = "<ElectrodesModel::toggleElectrode>"; //console.log(LABEL);
    try {
      const electrodeId = payload.electrodeId;
      const state = payload.state;
      if (electrodeId == undefined) throw("missing 'electrodeId' in payload");
      if (state == undefined) throw("missing 'state' in payload");
      if (!_.isString(electrodeId)) throw("electrodeId should be string");
      if (!_.isBoolean(state)) throw("state should be bool");

      // Get all connected electrodes based on the device object
      const microdrop = new MicrodropAsync();
      const threeObject = await microdrop.device.threeObject();
      const {channels, electrodes} = MapElectrodesAndChannels(threeObject);
      const electrodeChannel = electrodes[electrodeId];
      const connectedElectrodes = channels[electrodeChannel];

      // Get all the currently active electrodes
      let activeElectrodes;
      try {
        activeElectrodes = await microdrop.electrodes.activeElectrodes(500);
      } catch (e) { activeElectrodes = [] }

      // Add or remove the connected electrodes depending on state
      if (state == true)  {
        activeElectrodes = _.uniq(_.concat(activeElectrodes, connectedElectrodes));
      } else {
        activeElectrodes = _.uniq(_.without(activeElectrodes, ...connectedElectrodes));
      }
      activeElectrodes =
        await microdrop.electrodes.putActiveElectrodes(activeElectrodes);
      return this.notifySender(payload, activeElectrodes, "toggle-electrode");
    } catch (e) {
      return this.notifySender(payload, this.dumpStack(LABEL, e), "toggle-electrode",
        'failed');
    }
  }

}

module.exports = ElectrodesModel;
