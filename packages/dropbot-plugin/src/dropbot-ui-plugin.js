const yo = require('yo-yo');
const _ = require('lodash');
const MicropedeAsync = require('@micropede/client/src/async.js');
const UIPlugin = require('@microdrop/ui-plugin');

const APPNAME = 'microdrop';

const keys = ["i2c_address", "switching_board_i2c_address", "R7", "pot_max",
"max_voltage", "min_frequency", "max_frequency", "id", "capacitance_n_samples",
"hv_output_enabled", "hv_output_selected", "channel_count",
"capacitance_update_interval_ms", "target_capacitance",
"base_node_software_version", "package_name", "display_name", "manufacturer",
"url", "software_version", "uuid", "voltage", "frequency"];

let properties =_.zipObject(keys, _.map(keys, () => {return {editable: false, hidden: true}}));

const DropBotSchema = {
  type: "object",
  properties: {
    "info": {
      type: "object",
      properties: _.extend(properties, {
        voltage: {hidden: false},
        frequency: {hidden: false}
      }),
      per_step: false
    }
  }
};

class DropbotUIPlugin extends UIPlugin {
  constructor(element, focusTracker, ...args) {
    super(element, focusTracker, ...args);
    this.noPanel = true;
    this.schema = DropBotSchema;
  }
  listen() {
    this.onStateMsg("dropbot", "info", (payload, params) => {
      this.setState("info", _.omit(payload, "__head__"));
      console.log("DROPBOT INFO:::");
      console.log({payload, params});
    });
    console.log("Dropbot UI is Listening!");
  }
}

module.exports = DropbotUIPlugin;
