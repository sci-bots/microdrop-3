require('./jsoneditor-styles.js');
const Ajv = require('ajv');
const {diff} = require('deep-object-diff');
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


JsonEditorMixins.listEditablePlugins = async function() {
  let pluginNames = await this.listPlugins();
  let plugins = {};
  let schemas = {};

  await Promise.all(_.map( pluginNames, async (pluginName) => {
    // Check if the plugin contains a schema
    let s = await this.getState('schema', pluginName);
    schemas[pluginName] = s;
    if (_.get(s, 'properties') == undefined) return;
    plugins[pluginName] = {};
    // If it does, check if the plugin has global and step based
    // modifiable properties
    _.each(s.properties, (v, k) => {
      if (v.per_step == false) plugins[pluginName].global = true;
      if (v.per_step != false) plugins[pluginName].step = true;
    });
  }));

  return {plugins, schemas};
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

    _.each(obj, (v,k) => {
      // Extend schema obj to include variables:
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

JsonEditorMixins.getSchemaForNode = function (node) {
  let pluginName = this.pluginName;
  let key = node.field;
  let s = _.get(this.schemas, pluginName);
  if (s == undefined) return true;

  // let s = await this.getState('schema', pluginName);
  let paths = [..._.findPaths(s, 'properties'), ..._.findPaths(s, 'items')];

  let isEditable = true;
  for (const p of paths) {
    let props = _.get(s, p);
    if (_.get(props, key) != undefined) {
      if (props[key].editable == false) isEditable = false;
      break;
    }
  }
  return isEditable;
}

JsonEditorMixins.createEditor = function (container, callback) {
  callback = callback || this.publishEditorChanges.bind(this);
  return new JSONEditor(container, {
    onChange: () => {
      if (this.editorUpdating == true) return;
      this.editorUpdating = true;
      _.debounce(callback.bind(this), 750)()
    },
    onEditable: (node) => {
      let isEditable = this.getSchemaForNode(node);
      return isEditable;
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

  // Find the differences (will pick up this change and also hidden keys)
  let diffs = diff(this._json, this.editor.get());

  // Merge diffs using _.merge (as this won't extend to things being set
  // to undefined [ie hidden keys wont be removed])
  _.merge(this._json, diffs);
  const data = this._json;

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

  const removeHidden = (obj) => {
    _.each(obj, (v,k) => {
      let _path = _.findPath(schema, k);
      if (_.get(schema, `${_path}.hidden`)) {
        delete obj[k];
      }
    });
  };

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
  this._json = {};

  await Promise.all(_.map(schema.properties, async (v,k) => {
    if (_.includes(this.subscriptions, `${APPNAME}/${item.name}/state/${k}`)) {
      return
    } else {
      const p = _.findPath(schema, k);
      let perStep = _.get(schema, `${p}.per_step`);

      let hidden = _.get(schema, `${p}.hidden`);
      // If showing globals hide per_step properties:
      if (perStep != false && mode == 'global') return;
      // If showing step properties, hide global properties
      if (perStep == false && mode != 'global') return;

      await this.onStateMsg(item.name, k, (payload, params) => {
        this._json[k] = _.cloneDeep(payload);

        // Remove hidden properties from payload before setting json
        if (_.isPlainObject(payload)) removeHidden(payload);
        if (_.isArray(payload)) {
          _.each(payload, (item) => removeHidden(item));
        }

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
      this._json[k] = v.default;
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
