require('./jsoneditorstyles.js');
const JSONEditor = require('jsoneditor');
const yo = require('yo-yo');
const _ = require('lodash');
const sha256 = require('sha256');

const MicropedeAsync = require('@micropede/client/src/async.js');
const UIPlugin = require('@microdrop/ui-plugin');

const APPNAME = 'microdrop';

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

const ELECTRODE_MENU_INDEX = 0;
const ROUTE_MENU_INDEX = 1;

class GlobalUIPlugin extends UIPlugin {
  constructor(elem, focusTracker, ...args){
    super(elem, focusTracker, ...args);

    this.menu = yo`<div>
      <button onclick=${this.electrodeView.bind(this)}>
        Selected Electrode
      </button>
      <button onclick=${this.routeView.bind(this)}>
        Selected Route
      </button>
    </div>`;

    this.deviceJSON = {};
    this.routeJSON = {};
    this.innerContent = yo`<div></div>`;

    this.element.appendChild(yo`<div>
      ${this.menu}
      ${this.innerContent}
    </div>`);

    this.editor = CreateEditor(this.innerContent, this.onChange.bind(this));

    let prevHeight;
    this.on("updateRequest", () => {
      let h = this.element.style.height;
      if (h == prevHeight) return;
      if (h != prevHeight) prevHeight = h;
      this.editor.frame.parentElement.style.height = `${parseInt(h)-50}px`;
    });

  }

  onChange() {
    if (this.innerContent.view == 'electrode') this.changeElectrode();
    if (this.innerContent.view == 'route') this.changeRoute();
  }

  changeElectrode() {
    const microdrop = new MicropedeAsync(APPNAME, undefined, this.port)
    let electrodeData = this.editor.get();
    // Modify the deviceJSON objects
    const threeObject = _.get(this.deviceJSON, 'three-object');
    let index = _.findIndex(threeObject, {id: this.selectedElectrode})
    _.extend(threeObject[index], electrodeData);
    let payload = {threeObject, electrodeId: this.selectedElectrode};
    microdrop.putPlugin('device-model', 'three-object', payload);
  }

  changeRoute() {
    const microdrop = new MicropedeAsync(APPNAME, undefined, this.port);
    let routeData = this.editor.get();

    const routes = _.get(this.routeJSON, 'routes');
    _.each(routeData, (route) => {
      let index = _.findIndex(routes, {uuid: route.uuid});
      _.extend(routes[index], route);
    });
    microdrop.putPlugin('routes-model', 'routes', routes);
  }

  listen() {
    this.onStateMsg('electrode-controls', 'selected-electrode', (payload) => {
      this.selectedElectrode = payload;
      this.electrodeView();
    });

    this.onStateMsg('route-controls', 'selected-routes', (payload) => {
      this.selectedRoutes = payload;
      this.routeView();
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

  electrodeView(e) {
    _.each([...this.menu.children], (c) => c.style.fontWeight = 'normal');
    this.menu.children[ELECTRODE_MENU_INDEX].style.fontWeight = 'bold';

    // this.innerContent.innerHTML = '';
    this.innerContent.view = 'electrode';

    // this.editor = CreateEditor(this.innerContent, this.onChange.bind(this));
    const threeObject = _.get(this.deviceJSON, 'three-object');
    let electrodeJSON = _.find(threeObject, {id: this.selectedElectrode});

    electrodeJSON = _.omit(electrodeJSON, ['translation', 'shape']);
    const prev = sha256(JSON.stringify(this.editor.get()));
    const next = sha256(JSON.stringify(electrodeJSON || {}));

    if (prev == next) return;
    this.editor.set(electrodeJSON || {});
    this.editor.expandAll();
  }

  routeView(e) {
    _.each([...this.menu.children], (c) => c.style.fontWeight = 'normal');
    this.menu.children[ROUTE_MENU_INDEX].style.fontWeight = 'bold';

    // this.innerContent.innerHTML = '';
    this.innerContent.view = 'route';

    // this.editor = CreateEditor(this.innerContent, this.onChange.bind(this));
    const routes = _.get(this.routeJSON, 'routes');
    let uuids = _.map(this.selectedRoutes, 'uuid');
    this._routeJSON = _.filter(routes, (r) => _.includes(uuids, r.uuid));
    this._routeJSON = _.map(this._routeJSON, (r) => {
      return _.omit(r, [])
    });

    const prev = sha256(JSON.stringify(this.editor.get()));
    const next = sha256(JSON.stringify(this._routeJSON || {}));
    if (prev == next) return;
    this.editor.set(this._routeJSON || {});
    this.editor.expandAll();
  }
}

module.exports = GlobalUIPlugin;
