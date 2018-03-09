require('./jsoneditorstyles.js');
const JSONEditor = require('jsoneditor');
const yo = require('yo-yo');
const _ = require('lodash');

const MicropedeAsync = require('@micropede/client/src/async.js');
const UIPlugin = require('@microdrop/ui-plugin');

const APPNAME = 'microdrop';

const CreateEditor = (container, callback) => {
  return new JSONEditor(container, {
    onChange: _.debounce(callback.bind(this), 750).bind(this),
    navigationBar: false,
    statusBar: false,
    search: false
  });
};

class SelectedUI extends UIPlugin {
  constructor(elem, focusTracker, ...args){
    super(elem, focusTracker, ...args);

    this.menu = yo`<div>
      <button onclick=${this.electrodeView.bind(this)}>
        Selected Electrode
      </button>
      <button onclick=${this.routeView.bind(this)}>
        Selected Routes
      </button>
    </div>`;

    this.deviceJSON = {};
    this.routeJSON = {};

    this.innerContent = yo`<div></div>`;

    this.element.appendChild(yo`<div>
      ${this.menu}
      ${this.innerContent}
    </div>`);

  }

  onChange() {
    console.log("Editor changed!");
    if (this.innerContent.view == 'electrode') this.changeElectrode();
    if (this.innerContent.view == 'route') this.changeRoute();
  }

  changeElectrode() {
    const microdrop = new MicropedeAsync(APPNAME, undefined, this.port)
    let electrodeData = this.editor.get();
    // Modify the deviceJSON objects
    const threeObject = _.get(this.deviceJSON, 'three-object');
    let index = _.findIndex(threeObject, {id: this.selectedElectrode})
    threeObject[index] = electrodeData;
    microdrop.putPlugin('device-model', 'three-object', threeObject);
    console.log(this.deviceJSON);
  }

  changeRoute() {
    const microdrop = new MicropedeAsync(APPNAME, undefined, this.port);
    let routeData = this.editor.get();
    const routes = _.get(this.routeJSON, 'routes');
    let index = _.findIndex(routes, {uuid: this.selectedRoute});
    routes[index] = routeData;
    microdrop.putPlugin('routes-model', 'routes', routes);
    console.log(this.routeJSON);
  }

  listen() {
    this.onStateMsg('electrode-controls', 'selected-electrode', (payload) => {
      this.selectedElectrode = payload;
      if (this.innerContent.view == 'electrode') this.electrodeView();
    });

    this.onStateMsg('route-controls', 'selected-route', (payload) => {
      this.selectedRoute = payload;
      if (this.innerContent.view == 'route') this.routeView();
    });

    this.onStateMsg('device-model', '{key}', (payload, params) => {
      this.deviceJSON[params.key] = payload;
      if (this.innerContent.view == 'electrode') this.electrodeView();
    });

    this.onStateMsg('routes-model', '{key}', (payload, params) => {
      this.routeJSON[params.key] = payload;
      if (this.innerContent.view == 'route') this.routeView();
    });
  }

  electrodeView() {
    this.innerContent.innerHTML = '';
    this.innerContent.view = 'electrode';
    this.editor = CreateEditor(this.innerContent, this.onChange.bind(this));
    const threeObject = _.get(this.deviceJSON, 'three-object');
    let electrodeJSON = _.find(threeObject, {id: this.selectedElectrode});
    this.editor.set(electrodeJSON || {});
  }

  routeView() {
    this.innerContent.innerHTML = '';
    this.innerContent.view = 'route';
    this.editor = CreateEditor(this.innerContent, this.onChange.bind(this));
    const routes = _.get(this.routeJSON, 'routes');
    this._routeJSON = _.find(routes, {uuid: this.selectedRoute});
    this.editor.set(this._routeJSON || {});
  }
}

module.exports = SelectedUI;
