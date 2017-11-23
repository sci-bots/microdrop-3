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

function MapElectrodesToChannels(channelMap, electrodeMap) {
  /* Generate electrodes and channels from device file */
  const LABEL = "<ElectrodesModel::mapElectrodesToChannels>";
  try {
    // Init new objects for electrodes and channels
    const electrodes = new Object();
    const channels = new Object();
    // Construct electrodes
    for (const [id, channel] of Object.entries(electrodeMap)) {
      const initialized = electrodes[id];
      if (initialized)  {electrodes[id].channels.push(channel)}
      if (!initialized) {electrodes[id] = {channels: [channel], state: false}}
    }
    // Construct channels
    for (const [index, electrodeId] of Object.entries(channelMap)) {
      const initialized = channels[index];
      if (initialized)  {channels[index].push(electrodeId)}
      if (!initialized) {channels[index] = [electrodeId]}
    }
    return {electrodes, channels};
  } catch (e) {
    throw([LABEL, e]);
  }
}

function UpdateStatesByElectrode(id, state, electrodes, channels, _visitedMap={}) {
  _visitedMap[id] = true;
  const electrode = electrodes[id];
  electrode.state = state;
  for (const [i,index] of electrode.channels.entries()) {
    _UpdateStatesByChannel(index, state, electrodes, channels, _visitedMap);
  }
  return electrodes;
}

function _UpdateStatesByChannel (index, state, electrodes, channels, _visitedMap={}) {
  const electrodeIds = channels[index];
  for (const [i,id] of electrodeIds.entries()) {
    if (_visitedMap[id]) continue;
    UpdateStatesByElectrode(id, state, electrodes, channels, _visitedMap);
  }
  return channels;
}

function CountOnElectrodes(electrodes) {
   return _.countBy(Object.values(electrodes), (e)=>{return e.state});
}

function DataFrameToElectrodes(dataframe) {
  const LABEL = "<RoutesModel::DataFrameToElectrodes>";
  try {
    if (!dataframe.index) throw("dataframe.index missing");
    if (!dataframe.values) throw("dataframe.values missing");
    return _.zipObject(dataframe.index, dataframe.values);
  } catch (e) {
    throw([LABEL, e]);
  }
}

class ElectrodesModel extends PluginModel {
  constructor () {
    super();
    this.microdrop = new MicrodropAsync();
  }

  listen() {
    // Depricating:
    this.onPutMsg("electrodes", this.onPutElectrodes.bind(this));
    this.onPutMsg("channels", this.onPutChannels.bind(this));
    this.onTriggerMsg("from-dataframe", this.fromDataframe.bind(this));
    this.onTriggerMsg("update-electrode", this.updateElectrode.bind(this));
    this.bindStateMsg("electrodes", "set-electrodes");
    this.bindStateMsg("channels", "set-channels");
    this.onTriggerMsg("reset-electrodes", this.resetElectrodes.bind(this));

    this.bindStateMsg("active-electrodes", "set-active-electrodes");
    this.onPutMsg("active-electrodes", this.putActiveElectrodes.bind(this));
    this.onTriggerMsg("toggle-electrode", this.toggleElectrode.bind(this));
    this.onStateMsg("step-model", "step-number", this.onStepChange.bind(this));
  }

  get filepath() {return __dirname;}

  async onStepChange(stepNumber) {
    /* When step is changed, load the electrodes and channels from this step */
    const LABEL = "<ElectrodesModel::onStepsSet>"; //console.log(LABEL);
    try {
      const steps = await this.microdrop.steps.steps();
      const electrodes = steps[stepNumber].electrodes;
      const channels = steps[stepNumber].channels;
      if (electrodes) this.trigger("set-electrodes", electrodes);
      if (channels) this.trigger("set-channels", channels);
    } catch (e) {
      throw([LABEL, e]);
    }
  }

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
  async fromDataframe(payload) {
    const LABEL = "<ElectrodesModel::fromDataframe>"; //console.log(LABEL);
    try {
      if (!payload.df_electrodes) throw("missing payload.df_electrodes");
      const microdrop = new MicrodropAsync();
      const electrodes = await microdrop.electrodes.electrodes();
      const channels = await microdrop.electrodes.channels();
      const updatedElectrodes = DataFrameToElectrodes(payload.df_electrodes);
      for (const [id, state] of Object.entries(updatedElectrodes)) {
        UpdateStatesByElectrode(id, state, electrodes, channels);
      }
      await microdrop.electrodes.putElectrodes(electrodes);
      return this.notifySender(payload, electrodes, "from-dataframe");
    } catch (e) {
      return this.notifySender(payload, this.dumpStack(LABEL, e), "from-dataframe", 'failed');
    }
  }

  async onPutElectrodes(payload) {
    const LABEL = "<ElectrodesModel::onPutElectrodes>";
    try {
      if (!payload.electrodes) throw("payload.electrodes missing");
      const electrodes = payload.electrodes;
      const stepNumber = await this.microdrop.steps.currentStepNumber();
      await this.microdrop.steps.updateStep('electrodes', electrodes, stepNumber);
      this.trigger("set-electrodes", electrodes);
      return this.notifySender(payload, electrodes, "electrodes");
    } catch (e) {
      return this.notifySender(payload, this.dumpStack(LABEL, e), "electrodes", 'failed');
    }
  }

  async onPutChannels(payload) {
    const LABEL = "<ElectrodesModel::onPutChannels>";
    try {
      if (!payload.channels) throw("payload.channels missing");
      const channels = payload.channels;
      const stepNumber = await this.microdrop.steps.currentStepNumber();
      await this.microdrop.steps.updateStep('channels', channels, stepNumber);
      this.trigger("set-channels", channels);
      return this.notifySender(payload, channels, "channels");
    } catch (e) {
      return this.notifySender(payload, this.dumpStack(LABEL, e), "channels", 'failed');
    }
  }

  async updateElectrode(payload) {
    /* Switch an electrode from on to off or vice versa */
    const LABEL = "<ElectrodesModel::updateElectrode>"; // console.log(LABEL);
    try {
      if (payload.electrode_id == undefined) throw([LABEL, "payload.electrode_id missing"]);
      if (payload.state == undefined) throw([LABEL, "payload.state missing"]);

      const id = payload.electrode_id;
      const state = payload.state;
      // Get channels and electrodes
      const channels = await this.microdrop.electrodes.channels();
      const electrodes = await this.microdrop.electrodes.electrodes();

      // Recursively change the state of electrodes and channels
      UpdateStatesByElectrode(id, state, electrodes, channels);

      // Update electrodes and channel
      await this.microdrop.electrodes.putChannels(channels);
      await this.microdrop.electrodes.putElectrodes(electrodes);

      return this.notifySender(payload, electrodes, "update-electrode");
    } catch (e) {
      return this.notifySender(payload, this.dumpStack(LABEL, e), "update-electrode", 'failed');
    }
  }

  async resetElectrodes(payload) {
    /* Re-generate electrodes and channels map based on loaded device
       with all electrode states set to "off" */
    const LABEL = "<ElectrodesModel::resetElectrodes>"; // console.log(LABEL);
    try {
      const channelMap = await this.microdrop.device.channels();
      const electrodeMap = await this.microdrop.device.electrodes();
      const r = MapElectrodesToChannels(channelMap, electrodeMap);
      await this.microdrop.electrodes.putChannels(r.channels);
      await this.microdrop.electrodes.putElectrodes(r.electrodes);
      return this.notifySender(payload, r, "reset-electrodes");
    } catch (e) {
      return this.notifySender(payload, this.dumpStack(LABEL, e), "reset-electrodes", "failed");
    }
  }

}

module.exports = ElectrodesModel;
