const yo = require('yo-yo');
const _ = require('lodash');

const MicropedeAsync = require('@micropede/client/src/async.js');
const UIPlugin = require('@microdrop/ui-plugin');
const {TabMenu, select, unselect} = require('@microdrop/ui-mixins/src/TabMenu.js');
const JsonEditorMixins = require('@microdrop/jsoneditor-mixins');

const APPNAME = 'microdrop';
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

    this.menu = yo`<div></div>`;
    this.innerContent = yo`<div></div>`;
    this.editor = this.createEditor(this.innerContent);

    this.element.style.padding = '0px';
    this.element.appendChild(yo`<div>
      ${this.menu}
      ${this.innerContent}
    </div>`);

    this.addEditorListeners();
    this.schema = GlobalSchema;

    this.once("listening", async () => {
      // Setup meny using plugins with global properties:
      let {plugins, schemas} = await this.listEditablePlugins();
      this.plugins = _.keys(_.pickBy(plugins, {global: true}));
      this.schemas = schemas;
      let args = ['global'];
      let onclick = this.pluginInEditorChanged.bind(this);
      let items = _.map(this.plugins, name => {return {name, args, onclick}});
      this.menu.innerHTML = '';
      this.menu.appendChild(TabMenu(items));
    });
  }

  async listen() {
    this.trigger("listening");

    this.onTriggerMsg('change-schema', async (payload) => {
      const LABEL = "global-ui-plugin:change-schema";
      try {
        this.trigger("activate-tab");
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
