require('bootstrap/dist/css/bootstrap.min.css');

const UIPlugin = require('@microdrop/ui-plugin');
const MicropedeAsync = require('@micropede/client/src/async.js');

const Ajv = require('ajv');
const JSONEditor = require('jsoneditor');
const sha256 = require('sha256');
const yo = require('yo-yo');
const _ = require('lodash');
const APPNAME = 'microdrop';
const ajv = new Ajv({useDefaults: true});

let schema_hash = '';

function FindPath(object, deepKey, path="") {
  /* Get path to nested key (only works if key is unique) */

  // If object contains key then return path
  if (_.get(object, deepKey)){
    return `${path}.${deepKey}`.slice(1);
  }

  // Otherwise, search all child objects:
  else {
    let keys =  _.keys(object);
    let _path;
    _.each(keys, (k) => {
      // Skip keys that are not objects:
      if (!_.isObject(object[k])) return true;
      // Check if key found along path:
      let p = FindPath(object[k], deepKey, `${path}.${k}`);
      // If path isn't false, exit each loop (path has been found):
      if (p) { _path = p; return false; }
    });

    // Return path if defined
    if (_path) return _path;
  }
  return false;
};

_.findPath = (...args) => {return FindPath(...args)}

class SchemaUIPlugin extends UIPlugin {
  constructor(elem, focusTracker, ...args) {
    super(elem, focusTracker, ...args);

    this.plugins = ["dropbot", "routes-model"];

    this.tabs = yo`
      <div>
        ${_.map(this.plugins, (n) => yo`
          <button onclick=${this.changeSchema.bind(this,n)}>${n}</button>
        `)}
      </div>`;
    this.content = yo`<div></div>`;
    this.element.appendChild(yo`
      <div class="container-fluid">
        <div class="row">
          <div class="col-sm-12">${this.tabs}</div>
        </div>
        <div class="row">
          <div class="col-sm-12">${this.content}</div>
        </div>
      </div>
    `);

    this.json = {};
    this.editor = new JSONEditor(this.content, {
      onChange: _.debounce(this.onChange.bind(this), 750).bind(this)
    });

  }

  async changeSchema(pluginName, e) {
    // Reset client
    await this.disconnectClient();
    await this.connectClient(this.clientId, this.host, this.port);
    // console.log("CLIENT:");
    // console.log(this.client);

    this.pluginName = pluginName;
    await this.getSchema(pluginName);

    console.log("changeSchema", pluginName);
  }

  async getSchema(pluginName) {
    const microdrop = new MicropedeAsync(APPNAME, undefined, this.port);
    let schema;
    try {
      schema = await microdrop.getState(pluginName, 'schema', 500);
      console.log({schema});
    } catch (e) {
      console.error("Failed to get schema from dropbot plugin:", e);
    }

    // Only update when schema has changed
    let hash = sha256(JSON.stringify(schema));
    if (hash == schema_hash) return;
    else {
      schema_hash = hash;
    }

    // Hide __hidden__ properties
    let properties = schema.properties;
    properties = _.pickBy(properties, (v,k)=> {
      if (k.slice(0,2) == '__' && k.slice(-2) == '__') return false;
      return true;
    });

    // Extend schema properties to include variables:
    _.each(properties, (v,k) => {
        properties[k].type = _.uniq([v.type, "string"]);
        properties[k].pattern = v.pattern || '^[\$]';
    });

    // Iterate through properties, and check for a subscription,
    // otherwise add one
    const subscriptions = this.subscriptions;

    this.json = {};
    await Promise.all(_.map(properties, async (v,k) => {
      if (_.includes(this.subscriptions, `${APPNAME}/${pluginName}/state/${k}`)) {
        return
      } else {
        await this.onStateMsg(pluginName, k, (payload, params) => {
          console.log("STATE MSG::");
          console.log(pluginName, k, payload);
          this.json[k] = payload;
          this.editor.set(this.json);
        });
        this.json[k] = v.default;
      }
    }));

    // Update the schema and json data in the editor
    this.editor.setSchema(schema);
    this.editor.set(this.json);
    this.editor.schema = schema;
  }

  listen() {
    // this.getSchema();
  }

  async onChange(...args) {
    const last = _.last(_.get(this.editor, 'history.history'));
    const data = this.editor.get();
    const validate = ajv.compile(this.editor.schema);
    if (!validate(data)) throw(validate.errors);

    let key = _.get(last, 'params.node.field');
    let val = data[key];

    // Ignore variables for now
    if (`${val}`[0] == '$') return;

    // Find path to key in schema (subSchema):
    let path = _.findPath(this.editor.schema, key);
    const subSchema = _.get(this.editor.schema, path);

    // If subSchema depends on parent prop, change key accordingly
    if (subSchema.set_with) {
      key = subSchema.set_with;
      val = data[key];
    }

    const topic = `${APPNAME}/put/${this.pluginName}/${key}`;
    const msg = {};

    console.log("CLIENT:");
    console.log(this.client);
    await this.sendMessage(topic, {[key]: val});
    console.log("Message sent!");
    console.log({key, val});
  }

}

module.exports = SchemaUIPlugin;
