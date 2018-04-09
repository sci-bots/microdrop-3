const yo = require('yo-yo');
const _ = require('lodash');

const MicropedeAsync = require('@micropede/client/src/async.js');
const UIPlugin = require('@microdrop/ui-plugin');
const {TabMenu, select, unselect} = require('@microdrop/ui-mixins/src/TabMenu.js');
const JsonEditorMixins = require('@microdrop/jsoneditor-mixins');

const GlobalSchema = {
  type: "object",
  properties: {
    "show-hidden": {
      type: "boolean",
      default: false,
      "per_step": false
    }
  },
};

class GlobalUIPlugin extends UIPlugin {
  constructor(elem, focusTracker, ...args){
    super(elem, focusTracker, ...args);
    _.extend(this, JsonEditorMixins);

    let items = [
      {name: 'electrode-controls', args: ['global'], onclick: this.pluginInEditorChanged.bind(this)},
      {name: 'device-model', args: ['global'], onclick: this.pluginInEditorChanged.bind(this)},
      {name: 'global-ui-plugin', args: ['global'], onclick: this.pluginInEditorChanged.bind(this)}
    ];

    this.menu = TabMenu(items);
    this.innerContent = yo`<div></div>`;
    this.editor = this.createEditor(this.innerContent);

    this.element.appendChild(yo`<div>
      ${this.menu}
      ${this.innerContent}
    </div>`);

    this.addEditorListeners();
    this.schema = GlobalSchema;
  }

  async listen() {
    this.onTriggerMsg('change-schema', async (payload) => {
      const LABEL = "global-ui-plugin:change-schema";
      try {
        await this.pluginInEditorChanged(payload, 'global');
        return this.notifySender(payload, 'done', "change-schema");
      } catch (e) {
        return this.notifySender(payload, DumpStack(LABEL, e), "change-schema", "failed");
      }
    });
    this.onPutMsg('show-hidden', async (payload) => {
      await this.setState('show-hidden', payload['show-hidden']);
    });
    let showHidden = await this.getState('show-hidden');
    if (showHidden == undefined) {
      this.setState('show-hidden', false);
    }
  }

}

module.exports = GlobalUIPlugin;
