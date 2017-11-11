const lo = require('lodash');
DEFAULT_TIMEOUT = 10000;

class Electrodes {
  constructor(ms) {
    this.ms = ms;
  }

  async activeElectrodes(timeout=DEFAULT_TIMEOUT) {
    return (await this.ms.getState("electrodes-model", "active-electrodes", timeout));
  }

  async channels() {
    return (await this.ms.getState("electrodes-model", "channels"));
  }

  async electrodes() {
    return (await this.ms.getState("electrodes-model", "electrodes"));
  }

  async clear(timeout=DEFAULT_TIMEOUT) {
    return (await this.ms.triggerPlugin("electrodes-model", "clear-electrodes",
      undefined, timeout));
  }

  async reset(timeout=DEFAULT_TIMEOUT) {
    return (await this.ms.triggerPlugin("electrodes-model", "reset-electrodes",
      undefined, timeout));
  }

  async toggleElectrode(id, state, timeout=DEFAULT_TIMEOUT) {
    const LABEL = "<Electrodes::toggleElectrode>";
    try {
      const msg = {
        __head__: {plugin_name: this.ms.name},
        electrodeId: id,
        state: state
      };
      if (!lo.isString(id)) throw("arg 1 should be string");
      if (!lo.isBoolean(state)) throw("arg 2 should be bool");

      const payload = await this.ms.triggerPlugin("electrodes-model",
        "toggle-electrode", msg, timeout);
      return payload.response;
    } catch (e) {
      throw(lo.flattenDeep([LABEL, e]));
    }
  }

  async putActiveElectrodes(activeElectrodes, timeout=DEFAULT_TIMEOUT) {
    const LABEL = "<MicrodropAsync::Electrodes::putActiveElectrodes>";
    try {
      const msg = {
        __head__: {plugin_name: this.ms.name},
        activeElectrodes: activeElectrodes
      };
      if (!lo.isArray(activeElectrodes)) throw("arg 1 should be array");
      const payload = await this.ms.putPlugin("electrodes-model", "active-electrodes",
        msg, timeout);
      return payload.response;
    } catch (e) {
      throw(lo.flattenDeep([LABEL, e]));
    }
  }

  async putChannels(channels, timeout=DEFAULT_TIMEOUT) {
    const msg = {
      __head__: {plugin_name: this.ms.name},
      channels: channels
    };
    return (await this.ms.putPlugin("electrodes-model", "channels",
      msg, timeout));
  }

  async putElectrodes(electrodes, timeout=DEFAULT_TIMEOUT) {
    const msg = {
      __head__: {plugin_name: this.ms.name},
      electrodes: electrodes
    };
    return (await this.ms.putPlugin("electrodes-model", "electrodes",
      msg, timeout));
  }

}

module.exports = Electrodes;
