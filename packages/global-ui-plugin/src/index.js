require('./jsoneditorstyles.js');
const Ajv = require('ajv');
const JSONEditor = require('jsoneditor');
const yo = require('yo-yo');
const _ = require('lodash');
const sha256 = require('sha256');

const MicropedeAsync = require('@micropede/client/src/async.js');
const UIPlugin = require('@microdrop/ui-plugin');
const {TabMenu, select, unselect} = require('@microdrop/ui-mixins/src/TabMenu.js');
const {FindPath, FindPaths} = require('@microdrop/helpers');
_.findPath  = (...args) => {return FindPath(...args)}
_.findPaths = (...args) => {return FindPaths(...args)}

const APPNAME = 'microdrop';
const ajv = new Ajv({useDefaults: true});

const GlobalSchema = {
  type: "object",
  properties: {
    "show-hidden": {
      type: "boolean",
      default: false
    }
  },
};

const CreateEditor = (container, callback) => {
  return new JSONEditor(container, {
    onChange: _.debounce(callback.bind(this), 750).bind(this),
    navigationBar: false,
    statusBar: false,
    search: false,
    expand_height: true,
    collapsed: false
  });
};

const ExtendSchema = (schema, key, showHidden=false) => {
  const keyPaths = _.findPaths(schema, key);

  _.each(keyPaths, (keyPath) => {
    let obj = _.get(schema, keyPath);

    // Remove hidden keys from schema
    obj = _.pickBy(obj, (v,k)=> {
      if (k.slice(0,2) == '__' && k.slice(-2) == '__' && !showHidden) return false;
      if (_.get(v, 'hidden') == true && !showHidden) return false;
      return true;
    });

    // Extend schema obj to include variables:
    _.each(obj, (v,k) => {
      if (_.includes(v.type, 'string')) return;
      if (_.isArray(v.type))  v.type.push("string");
      if (!_.isArray(v.type)) v.type = [v.type, "string"];
      obj[k].type = _.uniq(v.type);
      obj[k].pattern = v.pattern || '^[\$]';
    });

    _.set(schema, keyPath, obj);
  });
}


class GlobalUIPlugin extends UIPlugin {
  constructor(elem, focusTracker, ...args){
    super(elem, focusTracker, ...args);

    let items = [
      {name: 'dropbot', onclick: this.pluginChanged.bind(this)},
      {name: 'electrode-controls', onclick: this.pluginChanged.bind(this)},
      {name: 'device-model', onclick: this.pluginChanged.bind(this)},
      {name: 'global-ui-plugin', onclick: this.pluginChanged.bind(this)}
    ];

    this.menu = TabMenu(items);
    this.innerContent = yo`<div></div>`;
    this.editor = CreateEditor(this.innerContent, this.editorChanged.bind(this));

    this.element.appendChild(yo`<div>
      ${this.menu}
      ${this.innerContent}
    </div>`);

    this.addListeners();
    this.schema = GlobalSchema;
  }

  async addListeners() {
    let prevHeight, showHidden;

    this.on("updateRequest", () => {
      let h = this.element.style.height;
      if (h == prevHeight) return;
      if (h != prevHeight) prevHeight = h;
      this.editor.frame.parentElement.style.height = `${parseInt(h)-50}px`;
    });

    try {
      showHidden = await this.getState('show-hidden');
    } catch (e) {
      console.error(e);
    }
    if (showHidden == undefined) {
      this.setState('show-hidden', false);
    }
  }

  getEditorData() {
    const last = _.last(_.get(this.editor, 'history.history'));
    const data = this.editor.get();
    const validate = ajv.compile(this.editor.schema);
    if (!validate(data)) throw(validate.errors);

    let key = _.get(last, 'params.node.field');
    // If no key, then likely dealing with a list property
    if (key == undefined) key = _.get(last, 'params.node.parent.field');
    let val = data[key];

    // Find path to key in schema (subSchema):
    let path = _.findPath(this.editor.schema, key);
    const subSchema = _.get(this.editor.schema, path);

    // If subSchema depends on parent prop, change key accordingly
    if (_.get(subSchema, 'set_with')) {
      key = subSchema.set_with;
      val = data[key];
    }

    // Ignore variables for now
    if (`${val}`[0] == '$') return undefined;

    return {plugin: this.pluginName, key: key, val: val};
  }

  async editorChanged(...args) {
    // Get data changed in editor:
    const {plugin, key, val} = this.getEditorData();

    // Make put request to modify microdrop state:
    const topic = `${APPNAME}/put/${plugin}/${key}`;
    const msg = {};
    await this.sendMessage(topic, {[key]: val});
  }

  async getSchema(name) {
    let schema;
    try {
      schema = await this.getState('schema', name);
    } catch (e) {
      console.error(`Failed to get schema for: ${name}`, e);
    }
    let showHidden = await this.getState('show-hidden');
    await ExtendSchema(schema, 'properties', showHidden);
    await ExtendSchema(schema, 'items', showHidden);
    return schema;
  }

  schemaHasChanged(schema) {
    // Only update when schema has changed
    let hash = sha256(JSON.stringify(schema));
    if (hash == this.schema_hash) return false;
    else {
      this.schema_hash = hash;
      return true;
    }
  }

  async pluginChanged(item) {
    this.pluginName = item.name;
    let schema = await this.getSchema(item.name);

    // Only update when schema has changed (XXX: Sometimes this may be necessary)
    if (!this.schemaHasChanged(schema)) return;

    // Reset client
    await this.disconnectClient();
    await this.connectClient(this.clientId, this.host, this.port);
    // Connect client removes prev listeners, so must re-add them here:
    this.addListeners();

    let pluginBtns = [...this.menu.querySelectorAll('.tab-btn')];
    let selectedBtn = this.menu.querySelector(`#tab-${this.pluginName}`);
    _.each(pluginBtns, unselect);
    select(selectedBtn);

    // Iterate through properties, and check for a subscription,
    // otherwise add one
    const subscriptions = this.subscriptions;
    this.json = {};

    await Promise.all(_.map(schema.properties, async (v,k) => {
      if (_.includes(this.subscriptions, `${APPNAME}/${item.name}/state/${k}`)) {
        return
      } else {
        const p = _.findPath(schema, k);

        // Ignore keys marked as (TODO) hidden or where per_step != false
        if (_.get(schema, `${p}.per_step`) != true) {

          await this.onStateMsg(item.name, k, (payload, params) => {
            delete payload.__head__;
            this.json[k] = payload;
            // Only re-draw if the current displayed content differs from
            // the new payload
            let prevHash = sha256(JSON.stringify(this.editor.get()));
            let hash = sha256(JSON.stringify(this.json));

            if (hash != prevHash) {
              this.editor.set(this.json);
              // XXX: Too large of json objects crash w/ expand all
              if (this.pluginName != 'device-model')
                this.editor.expandAll();
            }

          });
          this.json[k] = v.default;
        }
      }
    }));

    // Update the schema and json data in the editor
    this.editor.setSchema(schema);
    this.editor.set(this.json);
    if (this.pluginName != 'device-model')
      this.editor.expandAll();
    this.editor.schema = schema;
  }


  listen() {
    this.onTriggerMsg('change-schema', async (payload) => {
      const LABEL = "global-ui-plugin:change-schema";
      try {
        await this.pluginChanged(payload);
        return this.notifySender(payload, 'done', "change-schema");
      } catch (e) {
        return this.notifySender(payload, DumpStack(LABEL, e), "change-schema", "failed");
      }
    });
    this.onPutMsg('show-hidden', async (payload) => {
      await this.setState('show-hidden', payload['show-hidden']);
    });
  }

}

module.exports = GlobalUIPlugin;
