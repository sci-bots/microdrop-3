const _ = require('lodash');
const _fp = require('lodash/fp');
const { DataFrame } = require("pandas-helpers");

const PluginModel = require('./PluginModel');

const extractElectrodeStates = _fp.flow(_fp.at(["electrode_states.index",
  "electrode_states.values"]),_fp.spread(_.zipObject));

class ElectrodesModel extends PluginModel {
  constructor () {
    super();
    this.electrodes = new Object();
  }

  // ** Event Listeners **
  listen () {
    this.onPutMsg("electrode-options", this.onUpdateElectrodeOptions.bind(this));
    this.onPutMsg("electrode-state", this.onSetElectrodeState.bind(this));
    this.onPutMsg("electrode-states", this.onSetElectrodeStates.bind(this));
    this.onStateMsg("device-model", "device", this.onDeviceSwapped.bind(this));

    this.bindStateMsg("electrodes", "electrodes-set");
    this.bindStateMsg("channels", "channels-set");
  }

  // ** Methods **
  channelsByElectrodeID(electrodeChannelsDataFrame) {
    return _.mapValues(electrodeChannelsDataFrame
      .groupRecordsBy("electrode_id"), _fp.map(_fp.get("channel")));
  }

  clearElectrodes () {
    _.each(this.electrodes, (electrode) => {electrode.state = false});
    // this.trigger("electrodes-set", this.electrodesAsDataFrame);
  }

  electrodeIdsByChannels(electrodeChannelsDataFrame) {
    return _.map(electrodeChannelsDataFrame
      .groupRecordsBy("channel"),_fp.map(_fp.get("electrode_id")));
  }

  updateElectrodesFromChannels (channels) {
    const electrodeChannelsDataFrame =  new DataFrame(channels);
    const channelsByElectrodeID = this.channelsByElectrodeID(electrodeChannelsDataFrame);
    const electrodeIds   = _.keys(channelsByElectrodeID);

    this.trigger("channels-set", this.wrapData(null,channels));
    // For each electrode, store the channel, id , and state (off by default)

    this.channels = new Object();
    const channelObjectsStateOff = _.map(channelsByElectrodeID,
      (channels, id) => {
        // Map channels to electrode id:
        _.each(channels, (index) => {
          if (!this.channels[index]) this.channels[index] = new Array();
          this.channels[index].push(id);
        });

        // Return electrode:
        return {id: id, channels: channels, state: false};
    });

    // Map electrodeId to electrodes
    this.electrodes = _.zipObject(electrodeIds, channelObjectsStateOff);
  }

  updateStatesByElectrodeId (id, state, visitedMap={}) {
    visitedMap[id] = true;
    const electrode = this.electrodes[id];
    electrode.state = state;
    _.each(electrode.channels, (index) => {
      this.updateStatesByChannel(index, state, visitedMap);
    });
  }

  updateStatesByChannel (index, state, visitedMap={}) {
    const electrodeIds = this.channels[index];
    _.each(electrodeIds, (id) => {
      if (visitedMap[id]) return;
      this.updateStatesByElectrodeId(id, state, visitedMap);
    });
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

  // ** Getters and Setters **
  get channels() {return this._channels;}
  set channels(channels) {this._channels = channels;}
  get electrodes() {return this._electrodes;}
  set electrodes(electrodes) {this._electrodes = electrodes;}
  get filepath() {return __dirname;}

  get electrodesAsDataFrame() {
    // TODO: Ensure that they remain in the same order (possibly a lodash method)
    const ids    = _.map(this.electrodes, (e) => {return e.id});
    const states = _.map(this.electrodes, (e) => {return e.state});

    const electrodeStates = new Object();
    electrodeStates.index  = ids;
    electrodeStates.type   = "Series";
    electrodeStates.values = states;
    electrodeStates.dtype  = "object";
    electrodeStates.index_dtype = "object" ;

    return electrodeStates;
  }

  get channel() {
    // XXX: This corresponds to MQTT Channel (not Electrode Channels).
    //      should rename (accross DataController)
    return "microdrop/electrode-data-controller";
  }

  // ** Event Handlers **
  onDeviceSwapped (payload) {
    // When device is swapped, re-initialize channels:

    // Backup current state of electrodes
    const electrodes = _.cloneDeep(this.electrodes);
    // Update channels:
    const channels = payload['df_electrode_channels'];
    this.updateElectrodesFromChannels(channels);

    // Re-apply electrodes if the previously existed:
    if (Object.keys(electrodes).length !== 0)
      this.electrodes = electrodes;
  }

  onSetElectrodeState (payload) {
    // Update the state of electrode by id
    const id = payload.electrode_id;

    const state = payload.state;
    this.updateStatesByElectrodeId(id,state);
    this.trigger("electrodes-set",
                 this.wrapData(null, this.electrodesAsDataFrame));
  }

  onSetElectrodeStates (payload) {
    const electrodeStates = extractElectrodeStates(payload);
    _.each(electrodeStates, (state, id) => {
      if (!(id in this.electrodes)) return;
      // if (!this.electrodes[id]) return;
      this.updateStatesByElectrodeId(id,state || false);
    });
    this.trigger("electrodes-set",
                 this.wrapData(null, this.electrodesAsDataFrame));
  }

  onUpdateElectrodeOptions (payload) {
    // Update Electrode Channels (Change per device)
    if (payload) {
      if(payload.channels) {
        this.updateElectrodesFromChannels(payload.channels);
      }
    }

    // Clear the current electrode states
    this.clearElectrodes();
    if (!payload) return;

    // Update electrode states
    if (payload.electrode_states)
      this.onSetElectrodeStates(payload);
  }
}

module.exports = ElectrodesModel;
