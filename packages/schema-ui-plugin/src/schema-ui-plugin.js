window.$ = require('jquery');
window.Popper = require('popper.js');
require('bootstrap/dist/css/bootstrap.min.css');
require('bootstrap/js/dist/tooltip.js');
require('open-iconic/font/css/open-iconic-bootstrap.css');
require('./jsoneditorstyles.js');

const Ajv = require('ajv');
const FileSaver = require('file-saver');
const generateName = require('sillyname');
const JSONEditor = require('jsoneditor');
const request = require('browser-request');
const sha256 = require('sha256');
const Sortable = require('sortablejs');
const yo = require('yo-yo');
const _ = require('lodash');

const UIPlugin = require('@microdrop/ui-plugin');
const MicropedeAsync = require('@micropede/client/src/async.js');

const APPNAME = 'microdrop';
const ajv = new Ajv({useDefaults: true});

const StepMixins = require('./step-mixins');

const unselect = (b) => {
  if (b == null) return;
  b.classList.remove("btn-primary");
  b.classList.add("btn-outline-secondary");
}

const select = (b) => {
  if (b == null) return;
  b.classList.remove("btn-outline-secondary");
  b.classList.add("btn-primary");
}

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

const FindPaths = (object, deepKey) => {
  let paths = [];
  let lastPath = false;
  let _object = _.cloneDeep(object);
  do {
    lastPath = FindPath(_object, deepKey);
    if (lastPath != false) {
      let newPath = _.toPath(lastPath).slice(0,-1);
      newPath.push(`_${deepKey}`);
      let oldObj = _.get(_object, lastPath);
      _.set(_object, newPath, oldObj);
      _.unset(_object, lastPath);
      paths.push(lastPath.replace(new RegExp(`_${deepKey}`, "g"), deepKey));
    }
  } while (lastPath != false);

  return paths;
}

const TabButton = (title, icon, callback, classes="") => {
  return yo`
    <button class="btn btn-sm ${classes}"
      style="${Styles.tabButton};"
      onclick=${callback.bind(this)}
      data-toggle="tooltip" data-placement="bottom" title="${title}">
      <span class="oi ${icon}"></span>
    </button>
  `;
}

_.findPath  = (...args) => {return FindPath(...args)}
_.findPaths = (...args) => {return FindPaths(...args)}

class SchemaUIPlugin extends UIPlugin {
  constructor(elem, focusTracker, ...args) {
    super(elem, focusTracker, ...args);
    _.extend(this, StepMixins);
    this.plugins = ["dropbot", "routes-model", "electrodes-model", "device-model"];

    this.tabs = yo`
      <div style="${Styles.tabs}">
        ${_.map(this.plugins, (n) => yo`
            <button id="tab-${n}"
            class="tab-btn btn btn-sm btn-outline-secondary"
            style="${Styles.tabButton}; font-size: 11px;"
            onclick=${this.changeSchema.bind(this,n)}>
              ${n}
            </button>
          `
        )}
        <span style="float:right;display:inline-block;">
          ${TabButton('Download', 'oi-data-transfer-download',
            this.saveToFile.bind(this), 'btn-outline-secondary')}
          ${TabButton('Save', 'oi-file', this.openFile.bind(this),
            'btn-outline-secondary')}
          ${TabButton('Execute', 'oi-media-play', this.executeSteps.bind(this),
            'btn-outline-success')}
        </span>
      </div>`;

    this.steps = yo`<div></div>`;
    this.content = yo`<div style="zoom:0.8"></div>`;
    this.element.appendChild(yo`
      <div class="container-fluid" style="padding: 0px;">
        <div class="row">
          <div class="col-sm-12">${this.tabs}</div>
        </div>
        <div class="row">
          <div class="col-sm-4" style="padding-right:0px;">
            <div style="${Styles.stepButtonContainer}">
              <button
                class="btn btn-sm btn-outline-info"
                style="width:100%;margin:3px 0px;"
                onclick=${this.showAll.bind(this)}>
                Show All
              </button>

              <button
                class="btn btn-sm btn-outline-success"
                style="width:100%"
                onclick=${this.createStep.bind(this)}>
                Create Step
              </button>
              ${this.steps}
            </div>
          </div>
          <div class="col-sm-8" style="padding-left:0px;margin-left:0px;">${this.content}</div>
        </div>
      </div>
    `);

    this.json = {};
    this.schema_hash = '';
    this.editor = new JSONEditor(this.content, {
      onChange: _.debounce(this.onChange.bind(this), 750).bind(this),
      navigationBar: false,
      statusBar: false,
      search: false,
      indentation: 0
    });
    this.sortable = Sortable.create(this.steps, {onEnd: this.onStepReorder.bind(this)});
    Styles.apply(elem);
  }

  async saveToFile(e) {
    const type = "application/json;charset=utf-8";
    request('/storage-raw', (response, err, body) => {
      const blob = new Blob([body], {type});
      FileSaver.saveAs(blob, `${generateName()}.microdrop`);
    });
  }

  async openFile(e) {
    /* Open a file-browser window to select a microdrop file */
    const handler = (e) => {
      const f = e.target.files[0];
      const ext = f.name.split(".").pop().toLowerCase();

      if (ext !== 'microdrop') {
        alert("Invalid extension, file must be .microdrop");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const body = e.target.result;
        const payload = JSON.parse(body);

        const req = {method:'POST', url:'/load-storage', body: body, json:true};
        request(req, (...args) => {
          location.reload();
        });

        // this.restoreFile(payload);
      };
      reader.readAsText(f);
    }

    const fileinput = yo`<input type='file' onchange=${handler.bind(this)} />`;
    fileinput.click();
  }

  async showAll(e) {
    // Remove client for steps:
    if (this.stepClient) {
      try { await this.stepClient.disconnectClient();} catch (e) {}
      delete this.stepClient;
    }

    // Load all states based on last loaded schema
    this.schema_hash = '';
    this.loadedStep = undefined;
    this.changeSchema(this.pluginName);
  }

  async changeSchema(pluginName) {
    // Reset client
    await this.disconnectClient();
    await this.connectClient(this.clientId, this.host, this.port);

    this.pluginName = pluginName;
    let pluginBtns = [...this.tabs.querySelectorAll('.tab-btn')];
    let selectedBtn = this.tabs.querySelector(`#tab-${this.pluginName}`);

    // Change the select button to the one containing this plugin name
    _.each(pluginBtns, unselect);
    select(selectedBtn);

    await this.loadSchemaByPluginName(pluginName);
  }

  async getStateForPlugin(pluginName, schema) {
    let microdrop;

    // Get all subscriptions for the schema
    microdrop = new MicropedeAsync(APPNAME, undefined, this.port);
    let subs = await microdrop.getSubscriptions(pluginName);

    // Filter subscriptions for those that match a put endpoint
    let puttableProperties = _.compact(_.map(subs, (s) => {
      if (_.includes(s, '/put/')) {
        return s.split(`${APPNAME}/put/${pluginName}/`)[1];
      }
    }));

    // Await the state of every property that has a subscription
    let state = {};
    let dat = _.compact(await Promise.all(_.map(puttableProperties, async (prop) => {
      microdrop = new MicropedeAsync(APPNAME, undefined, this.port);
      try {
        return {k: prop, v: await microdrop.getState(pluginName, prop, 500)};
      } catch (e) {
        return undefined;
      }
    })));
    _.each(dat, (o) => {state[o.k] = o.v});

    // Validate against the schema (which also applies defaults)
    let validate = ajv.compile(schema);
    validate(state);

    // Remove hidden properties, and those that are not changeable on a
    // per step basis
    _.each(_.keys(state), (k) => {
      if (k.slice(0,2) == '__' && k.slice(-2) == '__') {
        delete state[k];
      } else {
        // Get path to prop in schema:
        const p = _.findPath(schema, k);
        if (_.get(schema, `${p}.per_step`) == false)
          delete state[k];
      }
    });
    return state;
  }

  async getSchema(pluginName) {
    const microdrop = new MicropedeAsync(APPNAME, undefined, this.port);
    let schema;
    try {
      schema = await microdrop.getState(pluginName, 'schema', 500);
    } catch (e) {
      console.error(`Failed to get schema for: ${pluginName}`, e);
    }

    const extendSchema = (key) => {
      const keyPaths = _.findPaths(schema, 'properties');
      _.each(keyPaths, (keyPath) => {
        let obj = _.get(schema, keyPath);

        // Remove hidden keys from schema
        obj = _.pickBy(obj, (v,k)=> {
          if (k.slice(0,2) == '__' && k.slice(-2) == '__') return false;
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

    extendSchema('properties');
    extendSchema('items');

    return schema;
  }

  async loadSchemaByPluginName(pluginName) {

    const schema = await this.getSchema(pluginName);

    // Only update when schema has changed
    let hash = sha256(JSON.stringify(schema));
    if (hash == this.schema_hash) return;
    else {
      this.schema_hash = hash;
    }

    // Iterate through properties, and check for a subscription,
    // otherwise add one
    const subscriptions = this.subscriptions;

    this.json = {};
    await Promise.all(_.map(schema.properties, async (v,k) => {
      if (_.includes(this.subscriptions, `${APPNAME}/${pluginName}/state/${k}`)) {
        return
      } else {
        await this.onStateMsg(pluginName, k, (payload, params) => {
          this.json[k] = payload;

          // Only re-draw if the current displayed content differs from
          // the new payload
          let prevHash = sha256(JSON.stringify(this.editor.get()));
          let hash = sha256(JSON.stringify(this.json));

          if (hash != prevHash) {
            this.editor.set(this.json);
          }

        });
        this.json[k] = v.default;
      }
    }));

    // Update the schema and json data in the editor
    this.editor.setSchema(schema);
    this.editor.set(this.json);
    this.editor.schema = schema;
  }

  async listen() {
    await this.onStateMsg(this.name, 'steps', this.onStepState.bind(this));
    // const _topic = 'microdrop/file-launcher/state/last-opened-file';
    await this.onStateMsg('file-launcher', 'last-opened-file', (payload, params) => {
      console.log({payload, params});
    });
  }

  async onChange(...args) {
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
    if (`${val}`[0] == '$') return;

    const topic = `${APPNAME}/put/${this.pluginName}/${key}`;
    const msg = {};

    await this.sendMessage(topic, {[key]: val});
  }

}


const Styles = {
  apply(container) {
    container.style.padding = "0px";
    // Enter all styling that is applied programmably here:

    // Activate tooltips
    $('[data-toggle="tooltip"]').tooltip();

    // Modify the style of the JSON editor to be more compact:
    let editor = container.getElementsByClassName('jsoneditor')[0];
    let menu = container.getElementsByClassName('jsoneditor-menu')[0];
    let elemBody = menu.parentElement.getElementsByClassName('jsoneditor-outer')[0];
    editor.style.border = '1px solid white';
    menu.style.display = 'none';
    elemBody.style.position = 'relative';
    elemBody.style.top = '35px';
    elemBody.style.paddingTop = '0px';
  },
  tabs: `
    background: #eaeaea;
    border-top: 1px solid #b5b5b5;
    border-bottom: 1px solid #b5b5b5;
    padding: 3px;
  `,
  stepButton: `
    margin: 3px 0px;
    width: 100%;
    background: white;
    color: black;
    border: 1px solid #b5b5b5;
  `,
  stepButtonContainer: `
    padding: 3px;
    border-right: 1px solid #a7a7a7;
    height: 100%;
    width: 100%;
  `,
  tabButton: `
    margin: 0px 3px;
  `
}

module.exports = SchemaUIPlugin;
