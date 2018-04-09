require('./jsoneditor-styles.js');
const Ajv = require('ajv');
const JSONEditor = require('jsoneditor');
const sha256 = require('sha256');
const _ = require('lodash');

const ajv = new Ajv({useDefaults: true});
const {FindPath, FindPaths} = require('@microdrop/helpers');
const {TabMenu, select, unselect} = require('@microdrop/ui-mixins/src/TabMenu.js');
_.findPath  = (...args) => {return FindPath(...args)}
_.findPaths = (...args) => {return FindPaths(...args)}

const APPNAME = 'microdrop';
const JsonEditorMixins = {};

JsonEditorMixins.schemaHasChanged = function (schema) {
  // Only update when schema has changed
  let hash = sha256(JSON.stringify(schema));
  if (hash == this.schema_hash) return false;
  else {
    this.schema_hash = hash;
    return true;
  }
}

JsonEditorMixins.getSchema = async function (name) {
  let schema;
  try {
    schema = await this.getState('schema', name);
    if (schema == undefined) throw `Failed to get schema for: ${name}`;
  } catch (e) {
    console.error(e);
  }
  let showHidden = await this.getState('show-hidden');
  await this.extendSchema(schema, 'properties', showHidden);
  await this.extendSchema(schema, 'items', showHidden);
  return schema;
}

JsonEditorMixins.extendSchema = function (schema, key, showHidden=false) {
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
      if (v.type == undefined) return;
      if (_.includes(v.type, 'string')) return;
      if (_.isArray(v.type))  v.type.push("string");
      if (!_.isArray(v.type)) v.type = [v.type, "string"];
      obj[k].type = _.compact(_.uniq(v.type));
      obj[k].pattern = v.pattern || '^[\$]';
    });

    _.set(schema, keyPath, obj);
  });
}

JsonEditorMixins.createEditor = function (container, callback) {
  callback = callback || this.publishEditorChanges.bind(this);
  return new JSONEditor(container, {
    onChange: () => {
      this.editorUpdating = true;
      _.debounce(callback.bind(this), 750)()
    },
    navigationBar: false,
    statusBar: false,
    search: false,
    expand_height: true,
    collapsed: false
  });
};

JsonEditorMixins.getEditorData = function () {
  const last = _.last(_.get(this.editor, 'history.history'));
  const data = this.editor.get();
  const validate = ajv.compile(this.editor.schema);
  if (!validate(data)) throw(validate.errors);

  let key = _.get(last, 'params.node.field');
  // If no key found, check for it in other locations:
  if (key == undefined || key == "") key = _.get(last, 'params.node.parent.field');
  if (key == undefined || key == "") key = _.get(last, 'params.parent.field');
  if (key == undefined || key == "") key = _.get(last, 'params.nodes[0].field');
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
  if (`${val}`[0] == '$') return;

  return {plugin: this.pluginName, key: key, val: val};
};

JsonEditorMixins.publishEditorChanges = async function () {
  // Get data changed in editor:
  this.editorUpdating = true;
  try {
    const {plugin, key, val} = this.getEditorData();

    // Make put request to modify microdrop state:
    const topic = `${APPNAME}/put/${plugin}/${key}`;
    const msg = {};
    await this.sendMessage(topic, {[key]: val});
  } catch (e) {
    console.error(e);
  }
  setTimeout(()=>{
    this.editorUpdating = false;
    this.trigger("editor-updated");
  }, 501);
};

JsonEditorMixins.addEditorListeners = function () {
  let prevHeight;

  this.on("updateRequest", () => {
    let h = this.element.style.height;
    if (h == prevHeight) return;
    if (h != prevHeight) prevHeight = h;
    this.editor.frame.parentElement.style.height = `${parseInt(h)-50}px`;
  });
}

JsonEditorMixins.pluginInEditorChanged = async function (item, mode='global') {
  this.pluginName = item.name;
  let schema = await this.getSchema(item.name);

  // Only update when schema has changed (XXX: Sometimes this may be necessary)
  if (!this.schemaHasChanged(schema)) return;

  // Reset client
  await this.disconnectClient();
  await this.connectClient(this.clientId, this.host, this.port);

  // Connect client removes prev listeners, so must re-add them here:
  this.addEditorListeners();

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

      // If showing globals hide per_step properties:
      if (_.get(schema, `${p}.per_step`) != false && mode == 'global') return;
      // If showing step properties, hide global properties
      if (_.get(schema, `${p}.per_step`) == false && mode != 'global') return;

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
  }));

  // Update the schema and json data in the editor
  this.editor.setSchema(schema);
  this.editor.set(this.json);
  if (this.pluginName != 'device-model')
    this.editor.expandAll();
  this.editor.schema = schema;
}


module.exports = JsonEditorMixins;
module.exports.JsonEditorMixins = JsonEditorMixins;
