const _ = require('lodash');
const _fp = require('lodash/fp');
const { DataFrame } = require("pandas-helpers");

const DataController = require('./DataController');

const extractElectrodeStates = _fp.flow(_fp.at(["electrode_states.index",
  "electrode_states.values"]),_fp.spread(_.zipObject));

class ElectrodeDataController extends DataController {
  constructor () {
    super();
    this.electrodes = new Object();
  }

  // ** Event Listeners **
  listen () {
    this.addPutRoute("electrode-controller-plugin", "electrodes", "electrodes-set");
    this.addPutRoute("dmf-device-ui", "electrodes", "electrodes-set");
    this.addPutRoute("protocol-data-controller", "electrodes", "electrodes-set");

    this.addRoute("microdrop/data-controller/electrode-options", this.onUpdateElectrodeOptions.bind(this));
    this.addRoute("microdrop/dmf-device-ui/set-electrode-state", this.onSetElectrodeState.bind(this));
    this.addRoute("microdrop/dmf-device-ui/set-electrode-states", this.onSetElectrodeStates.bind(this));
    this.addRoute("microdrop/electrode-controller-plugin/set-electrode-states", this.onSetElectrodeStates.bind(this));
    this.addRoute("microdrop/droplet-planning-plugin/set-electrode-states", this.onSetElectrodeStates.bind(this));

    // TODO: Change to set-electrode-state
    this.addRoute("microdrop/state/device", this.onDeviceSwapped.bind(this));
  }

  // ** Methods **
  clearElectrodes () {
    _.each(this.electrodes, (electrode) => {electrode.state = false});
    this.trigger("electrodes-set", this.electrodesAsDataFrame);
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

  // ** Getters and Setters **
  set electrodeChannelsDataFrame(electrodeChannelsDataFrame) {
    this._electrodeChannelsDataFrame = electrodeChannelsDataFrame;
  }

  get electrodeChannelsDataFrame() {
    return this._electrodeChannelsDataFrame;
  }

  get electrodeIdsByChannels() {
    const electrodeIdsByChannel = _.map(this.electrodeChannelsDataFrame
      .groupRecordsBy("channel"),_fp.map(_fp.get("electrode_id")));
    return electrodeIdsByChannel;
  }

  get channelsByElectrodeID() {
    const channelsByElectrodeID = _.mapValues(this.electrodeChannelsDataFrame
      .groupRecordsBy("electrode_id"), _fp.map(_fp.get("channel")));
    return channelsByElectrodeID;
  }

  get channels() {
    return this._channels;
  }

  set channels(channels) {
    this._channels = channels;
  }

  get electrodes() {
    return this._electrodes;
  }

  set electrodes(electrodes) {
    this._electrodes = electrodes;
  }

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
    // When device is swapped, re-initialize electrodes (all to off state)
    this.electrodeChannelsDataFrame =  new DataFrame(payload['df_electrode_channels']);

    // For each electrode, store the channel, id , and state (off by default)
    const electrodeIds   = _.keys(this.channelsByElectrodeID);

    this.channels = new Object();
    const channelObjectsStateOff = _.map(this.channelsByElectrodeID, (channels, id) => {
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

  onSetElectrodeState (payload) {
    // Update the state of electrode by id
    const id = payload.electrode_id;
    const state = payload.state;
    this.updateStatesByElectrodeId(id,state);
    this.trigger("electrodes-set", this.electrodesAsDataFrame);
  }

  onSetElectrodeStates (payload) {
    const electrodeStates = extractElectrodeStates(payload);
    _.each(electrodeStates, (state, id) => {
      if (!this.electrodes[id]) return;
      this.updateStatesByElectrodeId(id,state || false);
    });
    this.trigger("electrodes-set", this.electrodesAsDataFrame);
  }

  onUpdateElectrodeOptions (payload) {
    this.clearElectrodes();
    this.onSetElectrodeStates(payload);
  }
}

module.exports = ElectrodeDataController;
