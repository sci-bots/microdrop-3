const yo = require('yo-yo');
const _ = require('lodash');
const MicropedeAsync = require('@micropede/client/src/async.js');
const UIPlugin = require('@microdrop/ui-plugin');

const APPNAME = 'microdrop';

const DropBotSchema = {
  type: "object",
  properties: {
    "connection-status": {
      type: "string",
      default: "disconnected",
      per_step: false,
      editable: false
    },
    "channel-count": {
      type: "integer",
      default: 120,
      per_step: false,
      editable: false
    },
    "firmware-version": {
      type: "string",
      default: "unknown",
      per_step: false,
      editable: false
    },
    "hardware-version": {
      type: "string",
      default: "unknown",
      per_step: false,
      editable: false
    },
    "control-board-uuid": {
      type: "string",
      default: "unknown",
      per_step: false,
      editable: false
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
    console.log("Dropbot UI is Listening!");
  }
}

module.exports = DropbotUIPlugin;
