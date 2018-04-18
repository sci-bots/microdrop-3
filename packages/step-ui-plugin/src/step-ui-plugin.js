window.$ = require('jquery');
window.Popper = require('popper.js');
require('bootstrap/dist/css/bootstrap.min.css');
require('bootstrap/js/dist/tooltip.js');
require('open-iconic/font/css/open-iconic-bootstrap.css');

const FileSaver = require('file-saver');
const generateName = require('sillyname');
const key = require("keyboard-shortcut");
const request = require('browser-request');
const Sortable = require('sortablejs');
const yo = require('yo-yo');
const _ = require('lodash');

const UIPlugin = require('@microdrop/ui-plugin');
const {TabMenu, select, unselect} = require('@microdrop/ui-mixins/src/TabMenu.js');
const MicropedeAsync = require('@micropede/client/src/async.js');
const {DumpStack} = require('@micropede/client/src/client.js');
const APPNAME = 'microdrop';

const JsonEditorMixins = require('@microdrop/jsoneditor-mixins');
const StepMixins = require('./step-mixins');

const {FindPath, FindPaths} = require('@microdrop/helpers');
_.findPath  = (...args) => {return FindPath(...args)}
_.findPaths = (...args) => {return FindPaths(...args)}

class StepUIPlugin extends UIPlugin {
  constructor(elem, focusTracker, ...args) {
    super(elem, focusTracker, ...args);
    _.extend(this, StepMixins);
    _.extend(this, JsonEditorMixins);
    const changeSchema = (item) => this.pluginInEditorChanged(item, 'step');

    let btns = [];
    if (!_.includes(window.navigator.userAgent, "Electron")){
      btns = [
        {name: 'Download', onclick:  this.saveToFile.bind(this), stat: "secondary"},
        {name: 'Upload', onclick: this.openFile.bind(this), stat: "secondary"},
      ];
    };

    btns = [...btns, ...[
      {name: 'Execute', onclick: this.executeSteps.bind(this), stat: "primary"},
      {name: 'Create Step', onclick: this.createStep.bind(this), stat: "success"}
    ]];

    this.menu = yo`<div></div>`;
    this.steps = yo`<div id="step-container" style="overflow-y: auto"></div>`;
    this.content = yo`<div></div>`;

    this.element.appendChild(yo`
      <div class="container-fluid" style="padding: 0px;">
        <div class="row">
          <div class="col-sm-12">${this.menu}</div>
        </div>
        <div class="row">
          <div class="col-sm-4" style="padding-right:0px;">
            <div style="${Styles.stepButtonContainer}">
              ${_.map(btns, (b) => {
                let btn;
                btn = yo`
                  <button
                    id="btn-${b.name}"
                    class="btn btn-sm btn-outline-${b.stat}"
                    style="width:100%;margin-bottom:2px;"
                    onclick=${()=>b.onclick(btn)}>
                    ${b.name}
                  </button>
                `;
                return btn;
              })}
              ${this.steps}
            </div>
          </div>
          <div class="col-sm-8" style="padding-left:0px;margin-left:0px;">${this.content}</div>
        </div>
      </div>
    `);

    this.json = {};
    this.schema_hash = '';
    this.editor = this.createEditor(this.content);
    this.prevHiddenState = undefined;

    let prevHeight;
    this.addEditorListeners = () => {
      /* Override default editor listeners to include step */
      this.on("updateRequest", () => {
        let h = this.element.style.height;
        if (h == prevHeight) return;
        if (h != prevHeight) prevHeight = h;
        this.editor.frame.parentElement.style.height = `${parseInt(h)-50}px`;
        this.steps.style.height = `${parseInt(h)-190}px`;
      });
    }
    this.addEditorListeners();

    this.sortable = Sortable.create(this.steps, {onEnd: this.onStepReorder.bind(this)});
    Styles.apply(elem);

    this.once("listening", async () => {
      // Setup meny using plugins with global properties:]
      let {schema, plugins} = await this.listEditablePlugins();

      this.plugins = _.keys(_.pickBy(plugins, {step: true}));
      this.schema = schema;

      let args = ['step'];
      let onclick = this.pluginInEditorChanged.bind(this);
      let items = _.map(this.plugins, name => {return {name, args, onclick}});
      this.menu.innerHTML = '';
      this.menu.appendChild(TabMenu(items));
    });
  }

  async saveToFile(e) {
    const type = "application/json;charset=utf-8";
    request('/storage-raw', (response, err, body) => {
      const blob = new Blob([body], {type});
      FileSaver.saveAs(blob, `${generateName()}.udrp`);
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
      };
      reader.readAsText(f);
    }

    const fileinput = yo`<input type='file' onchange=${handler.bind(this)} />`;
    fileinput.click();
  }

  async listen() {
    this.trigger("listening");

    let toggleHandler = (state) => {
      let btn = document.querySelector("#btn-Execute");
      this.toggleExecuteButton(btn, state);
    };

    let sub1 = `${APPNAME}/trigger/routes-model/execute`;
    let sub2 = `${APPNAME}/trigger/routes-model/stop`;
    this.addSubscription(sub1, toggleHandler.bind(this, "running"));
    this.addSubscription(sub2, toggleHandler.bind(this, "stopped"));
    this.onSignalMsg("routes-model", "complete", toggleHandler.bind(this, "stopped"));

    await this.onStateMsg(this.name, 'steps', this.onStepState.bind(this));
    await this.onStateMsg('file-launcher', 'last-opened-file', (payload, params) => {
      console.log({payload, params});
    });
    this.onStateMsg('global-ui-plugin', 'show-hidden', (showHidden) => {
      console.log("GLOBAL UI PLUGIN CHANGED!");
      if (this.prevHiddenState != showHidden) {
        this.prevHiddenState = showHidden;
        this.pluginInEditorChanged({name: this.pluginName, override: true}, 'step');
      }
    });
    this.onTriggerMsg('change-schema', async (payload) => {
      const LABEL = "step-ui-plugin:change-schema";
      try {
        this.trigger("activate-tab")
        await this.pluginInEditorChanged(payload, 'step');
        return this.notifySender(payload, 'done', "change-schema");
      } catch (e) {
        return this.notifySender(payload, DumpStack(LABEL, e), "change-schema", "failed");
      }
    });

    let stepContainer = document.querySelector("#step-container");
    key('up', async (e) => {
      if (!this.hasFocus) return;
      let loadedStep = await this.getState('loaded-step') || 0;
      if (loadedStep <= 0) {
        loadedStep = (await this.getState('steps')).length-1;
      } else {
        loadedStep -= 1;
      }
      this.loadStep(loadedStep);
      let stepItem =  document.querySelector(`#step-${loadedStep}`);
      stepItem.focus();
      let {top} = stepItem.getBoundingClientRect();
      stepContainer.scrollTop = top;
    });

    key('down', async (e) => {
      if (!this.hasFocus) return;
      let loadedStep = await this.getState('loaded-step') || 0;
      if (loadedStep >= (await this.getState('steps')).length-1) {
        loadedStep = 0;
      } else {
        loadedStep += 1;
      }
      this.loadStep(loadedStep);
      let stepItem =  document.querySelector(`#step-${loadedStep}`);
      stepItem.focus();
      let {top} = stepItem.getBoundingClientRect();
      stepContainer.scrollTop = top;
    });

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

module.exports = StepUIPlugin;
