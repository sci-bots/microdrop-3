require('!style-loader!css-loader!jsoneditor/src/css/index.css');
const JSONEditor = require('jsoneditor');
const key = require('keyboard-shortcut');
const FileSaver = require('file-saver');
const generateName = require('sillyname');
const yo = require('yo-yo');
const _ = require('lodash');

const MicropedeAsync = require('@micropede/client/src/async.js');
const UIPlugin = require('@microdrop/ui-plugin');

const ElectrodeMixins = require('./electrode-mixins');
const RouteMixins = require('./route-mixins');
const StepMixins = require('./step-mixins');

const APPNAME = 'microdrop';

class StateSaverUI extends UIPlugin {
  constructor(elem, focusTracker) {
    super(elem, focusTracker);
    _.extend(this, ElectrodeMixins);
    _.extend(this, StepMixins);
    _.extend(this, RouteMixins);

    this.json = {};
    _.set(this.element.style, "overflow", "auto");

    this.view = "top";
    this.container = yo`<div style="zoom: 0.8; height:1000px"></div>`;
    this.infoBar = yo`<div></div>`;
    const onChange = this.onChange.bind(this);
    this.editor = new JSONEditor(this.container, {onChange});

    console.log(this);
  }

  async listen() {
    this.bindStateMsg("steps", "set-steps");
    this.bindStateMsg("step-index", "set-step-index");
    this.bindPutMsg('device-model', 'three-object', 'put-device');
    await this.onStateMsg("{pluginName}", "{val}", this.render.bind(this));
    await this.onStateMsg("file-launcher", "last-opened-file", this.restoreFile.bind(this));

    // Listen for keyboard presses
    key('down', this.keypressed.bind(this));
    key('up', this.keypressed.bind(this));
    this.draw();
  }

  onChange() {
    if (this.view == "steps") this.changeSteps();
    if (this.view == "route") this.changeRoute();
  }

  changeView(e) {
    this.view  = e.target.value;
    this.render();
  }

  async restoreFile(payload, params) {
    let shouldRestore = confirm(`
      Restore file?\n
      This will override your current working environment`);
    if (shouldRestore == false) return;

    // Restore device, routes, and electrodes
    let device = _.get(payload, 'device-model.three-object');
    let routes = _.get(payload, 'routes-model.routes');
    let electrodes = _.get(payload, 'electrodes-model.active-electrodes');
    let steps = _.get(payload, 'state-saver-ui.steps');

    routes = routes ? routes : [];
    electrodes = electrodes ? electrodes : [];

    const microdrop = new MicropedeAsync('microdrop');
    if (device) {
      await microdrop.putPlugin('device-model', 'three-object', device);
    }
    await microdrop.putPlugin('routes-model', 'routes', routes);
    await microdrop.putPlugin('electrodes-model', 'active-electrodes', electrodes);

    if (steps) {
      this.trigger("set-step-index", 0);
      this.trigger("set-steps", steps);
    }
    
    console.log("File restored :)", {payload, params});
  }

  render(payload, params) {
    var pluginName, val;

    if (typeof(params) === 'object') { var {pluginName, val} = params;}
    if (pluginName == "web-server") return;
    if (payload != undefined && payload != null) _.set(this.json, [pluginName, val], payload);

    this.infoBar.innerHTML = '';
    _.set(this.element.style, "overflow", "auto");

    if (this.view == "top") this.renderTopView();
    if (this.view == "steps") this.renderStepView();
    if (this.view == "electrode") this.renderSelectedElectrode();
    if (this.view == "route") this.renderSelectedRoute();
  }

  saveJson() {
    console.log(this.editor.get());
    const type = "application/json;charset=utf-8";
    const blob = new Blob([JSON.stringify(this.editor.get())], {type});
    FileSaver.saveAs(blob, `${generateName()}.microdrop`);
  }

  renderTopView() {
    this.infoBar.appendChild(yo`
      <button onclick=${this.saveJson.bind(this)}> Save to file </save>
    `)
    this.editor.set(this.json);
  }

  draw() {
    const name = `radios-${generateName()}`;
    this.element.innerHTML = "";
    this.element.appendChild(yo`
      <div>
        <div>
           <input onclick=${this.changeView.bind(this)}
             name="${name}" type="radio" value="top" checked>
           <label>Top</label>

           <input onclick=${this.changeView.bind(this)}
             name="${name}" type="radio" value="steps">
           <label>Steps</label>

           <input onclick=${this.changeView.bind(this)}
             name="${name}" type="radio" value="electrode">
           <label>Selected Electrode</label>

           <input onclick=${this.changeView.bind(this)}
             name="${name}" type="radio" value="route">
           <label>Selected Route</label>

         </div>
        ${this.infoBar}
        ${this.container}
      </div>
    `);
  }
}

module.exports = StateSaverUI;
