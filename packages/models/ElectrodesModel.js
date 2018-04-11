const {Console} = require('console');

const _ = require('lodash');

const {MicropedeClient, DumpStack} = require('@micropede/client/src/client.js');
const MicropedeAsync = require('@micropede/client/src/async.js');

const console = new Console(process.stdout, process.stderr);
const timeout = ms => new Promise(res => setTimeout(res, ms))

window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled rejection (promise: ', event.promise, ', reason: ', event.reason, ').');
});
window.addEventListener('error', function(e) {
    console.error(e.message);
});

const APPNAME = 'microdrop';

const ElectrodeSchema = {
  type: "object",
  properties: {
    id: {type: "string"},
    channel:  {type: "number"}
  },
  required: ['id', 'channel']
}

const ElectrodesSchema = {
  type: "object",
  properties: {
    "active-electrodes": {
      type: "array",
      default: [],
      items: {
        type: "string",
        pattern:'^electrode',
        set_with: 'active-electrodes'
      }
    },
    "min-duration": {
      type: "number",
      default: 100
    },
    "voltage": {
      type: "string",
      pattern: "^([0-9]+)V",
      default: "100V"
    },
    "frequency": {
      type: "string",
      pattern: "^([0-9]+)Hz",
      default: "1000Hz"
    }
  }
};

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

class ElectrodesModel extends MicropedeClient {
  constructor (appname=APPNAME, host, port, ...args) {
    console.log("Initializing Electrodes Model");
    super(appname, host, port, ...args);
    this.port = port;
    this.schema = ElectrodesSchema;
  }

  async listen() {
    let minDuration = await this.getState('min-duration');
    if (minDuration == undefined)
      await this.loadDefaults({keys: ['min-duration']});

    this.onPutMsg("active-electrodes", this.putActiveElectrodes.bind(this));
    this.onPutMsg("min-duration", this.putMinDuration.bind(this));
    this.onPutMsg("voltage", this.putVoltage.bind(this));
    this.onPutMsg("frequency", this.putFrequency.bind(this));
    this.onTriggerMsg("toggle-electrode", this.toggleElectrode.bind(this));
    this.onTriggerMsg("execute", this.execute.bind(this));
  }

  get isPlugin() {return true}
  get filepath() {return __dirname;}

  async execute(payload) {
    const LABEL = "<ElectrodesModel::execute>"; //console.log(LABEL);
    const microdrop = new MicropedeAsync(APPNAME, undefined, this.port);
    try {
      const ids = payload['active-electrodes'];
      // const minDuration = await this.getState("min-duration");
      if (ids) {
        // Add electrodes to running route sequence:
        const triggerName = 'add-electrode-to-sequence';
        await microdrop.triggerPlugin('routes-model', triggerName, {ids});

        // Call put endpoint
        await this.putActiveElectrodes({'active-electrodes': activeElectrodes});
      }

      // Ensure the electrodes have an on-time of at least the minDuration
      await timeout(await this.getState('min-duration'));
      return this.notifySender(payload, "complete", "execute");
    } catch (e) {
      return this.notifySender(payload, DumpStack(LABEL, e), "execute", "failed");
    }
  }

  async putVoltage(payload) {
    const LABEL = "<ElectrodesModel::putVoltage>"; //console.log(LABEL);
    try {
      await this.setState('voltage', payload['voltage']);
      return this.notifySender(payload, payload['voltage'], "voltage");
    } catch (e) {
      return this.notifySender(payload, DumpStack(LABEL, e), "voltage", "failed");
    }
  }

  async putFrequency(payload) {
    const LABEL = "<ElectrodesModel::putFrequency>"; //console.log(LABEL);
    try {
      await this.setState('frequency', payload['frequency']);
      return this.notifySender(payload, payload['frequency'], "frequency");
    } catch (e) {
      return this.notifySender(payload, DumpStack(LABEL, e), "frequency", "failed");
    }
  }

  async putMinDuration(payload) {
    const LABEL = "<ElectrodesModel::putMinDuration>"; //console.log(LABEL);
    try {
      await this.setState('min-duration', payload['min-duration']);
      return this.notifySender(payload, payload['min-duration'], "min-duration");
    } catch (e) {
      return this.notifySender(payload, DumpStack(LABEL, e), "min-duration", "failed");
    }
  }

  async putActiveElectrodes(payload) {
    const LABEL = "<ElectrodesModel::putActiveElectrodes>"; //console.log(LABEL);
    try {
      const activeElectrodes = payload["active-electrodes"] || payload["activeElectrodes"];
      if (!activeElectrodes) throw ("expected active-electrodes in payload");
      if (!_.isArray(activeElectrodes)) throw("active-electrodes should be array");
      await this.setState('active-electrodes', activeElectrodes);
      return this.notifySender(payload, activeElectrodes, "active-electrodes");
    } catch (e) {
      return this.notifySender(payload, DumpStack(LABEL, e), "active-electrodes", "failed");
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

      const microdrop = new MicropedeAsync(APPNAME, 'localhost', this.port);

      // Get all connected electrodes based on the device object
      const threeObject = await microdrop.getState('device-model', 'three-object');
      const {channels, electrodes} = MapElectrodesAndChannels(threeObject);
      const electrodeChannel = electrodes[electrodeId];
      const connectedElectrodes = channels[electrodeChannel];

      // Get all the currently active electrodes
      let activeElectrodes = await this.getState('active-electrodes') || [];

      // Add or remove the connected electrodes depending on state
      if (state == true)  {
        activeElectrodes = _.uniq(_.concat(activeElectrodes, connectedElectrodes));
      } else {
        activeElectrodes = _.uniq(_.without(activeElectrodes, ...connectedElectrodes));
      }
      // activeElectrodes =
      //   await microdrop.electrodes.putActiveElectrodes(activeElectrodes);
      activeElectrodes = (
        await microdrop.putPlugin('electrodes-model', 'active-electrodes',
          {'active-electrodes': activeElectrodes})).response;

      return this.notifySender(payload, activeElectrodes, "toggle-electrode");
    } catch (e) {
      return this.notifySender(payload, DumpStack(LABEL, e), "toggle-electrode",
        'failed');
    }
  }

}

module.exports = ElectrodesModel;

if (require.main === module) {
  try {
    console.log("STARTING ELECTRODES MODEL..");
    model = new ElectrodesModel();
  } catch (e) {
    console.error('ElectrodesModel failed!', e);
  }
}
