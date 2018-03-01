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

class SchemaUIPlugin extends UIPlugin {
  constructor(elem, focusTracker, ...args) {
    super(elem, focusTracker, ...args);

    this.plugins = ["dropbot"];

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
          <div class="col-sm-9">${this.tabs}</div>
        </div>
        <div class="row">
          <div class="col-sm-9">${this.content}</div>
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

    this.pluginName = pluginName;
    await this.getSchema(pluginName);

    console.log("changeSchema", ...args);
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

    const key = _.get(last, 'params.node.field');
    const val = data[key];

    if (`${val}`[0] == '$') return;

    const topic = `${APPNAME}/put/${this.pluginName}/${key}`;
    const msg = {};

    await this.sendMessage(topic, {[key]: val});
    console.log("Message sent!");
    console.log({key, val});
  }

}

module.exports = SchemaUIPlugin;
