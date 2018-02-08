require('style-loader!css-loader!jquery-contextmenu/dist/jquery.contextMenu.css');
const $ = require('jquery'); require('jquery-contextmenu');
const Key = require('keyboard-shortcut');
const Dat = require('dat.gui/build/dat.gui');
const uuid = require('uuid/v4');
const yo = require('yo-yo');

const DeviceController = require('@microdrop/device-controller/src/device-controller');
const MicropedeAsync = require('@micropede/client/src/async.js');
const {MicropedeClient} = require('@micropede/client/src/client.js')
const UIPlugin = require('@microdrop/ui-plugin');

const {
  ParseSVGFromString,
  ConstructObjectsFromSVG
} = require('@microdrop/device-controller/src/svg-renderer');

const DIRECTIONS = {LEFT: "left", UP: "up", DOWN: "down", RIGHT: "right"};
window.MicropedeAsync = MicropedeAsync;
window.MicropedeClient = MicropedeClient;

class DeviceUIPlugin extends UIPlugin {
  constructor(elem, focusTracker, ...args) {
    super(elem, focusTracker, ...args);
    this.controls = null;
    this.contextMenu = null;
    this.gui = null;
    this.element.style.padding = "0px";
  }

  listen() {
    this.on("updateRequest", this.onUpdateRequest.bind(this));
    this.onStateMsg('device-model', 'three-object', this.renderDevice.bind(this));
    this.bindPutMsg('device-model', 'three-object', 'put-device');

    // XXX: Sometimes updateRequest doesn't fire on page reload (thus force it with timeout)
    setTimeout(()=>this.trigger("updateRequest"), 1000);

    Key("left", this.move.bind(this, DIRECTIONS.LEFT));
    Key("right", this.move.bind(this, DIRECTIONS.RIGHT));
    Key("up", this.move.bind(this, DIRECTIONS.UP));
    Key("down", this.move.bind(this, DIRECTIONS.DOWN));

    this.element.focus();
    this.contextMenu = CreateContextMenu(this.element, this.contextMenuClicked.bind(this));
    this.element.onclick = () => this.element.focus();
  }

  move(...args) {
    if (!this.controls) return;
    if (document.activeElement != this.element) return;
    this.controls.electrodeControls.move(...args);
  }

  onUpdateRequest(msg) {
    if (!this.controls) return;
    this.controls.cameraControls.trigger("updateRequest", this);
  }

  async renderDevice(payload) {
    if (this.sceneContainer) {
      this.sceneContainer.innerHTML = '';
    } else  {
      this.sceneContainer = yo`
        <div style="width:100%;height:100%;overflow:hidden;"></div>`;
      this.element.appendChild(this.sceneContainer);
    }

    const bbox = this.element.getBoundingClientRect();
    if (bbox.width == 0) return;

    this.controls = await DeviceController.createScene(this.sceneContainer, payload);
    this.gui = CreateDatGUI(this.sceneContainer, this.controls);
  }

  changeDevice() {
    const handler = (e) => {
      const f = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        const svg = ParseSVGFromString(content);
        const objects = ConstructObjectsFromSVG(svg);
        this.trigger('put-device', {'three-object': objects});
      };
      reader.readAsText(f);
    }

    const fileinput = yo`<input type='file' onchange=${handler.bind(this)} />`;
    fileinput.click();
  }

  contextMenuClicked(key, options) {
    const microdrop = new MicropedeAsync('microdrop');
    switch (key) {
      case "changeDevice":
        this.changeDevice();
        break;
      case "clearElectrodes":
        microdrop.putPlugin('electrodes-model', 'active-electrodes', []);
        break;
      case "clearRoutes":
        microdrop.putPlugin('routes-model', 'routes', []);
        break;
      case "clearRoute":
        if (!this.controls) return true;
        this.controls.routeControls.trigger("clear-route", {key, options});
        break;
      case "executeRoute":
        if (!this.controls) return true;
        this.controls.routeControls.trigger("execute-route", {key, options});
        break;
      case "executeRoutes":
        if (!this.controls) return true;
        microdrop.getState('routes-model', 'routes').then((routes) => {
          microdrop.triggerPlugin('routes-model', 'execute', {routes}, -1);
        });
        break;
    }
    return true;
  }

  static CreateContextMenu(element, callback) {
    const id = uuid();
    element.setAttribute("id", id);
    return $.contextMenu({
        selector: `#${id}`,
        callback: callback,
        items: {
            clearElectrodes: {name: "Clear Electrodes"},
            "sep1": "---------",
            clearRoute: {name: "Clear Route"},
            executeRoute: {name: "Execute Route"},
            "sep2": "---------",
            clearRoutes: {name: "Clear Routes"},
            executeRoutes: {name: "Execute Routes"},
            "sep3": "---------",
            changeDevice: {name: "Change Device"},
            "sep4": "----------",
            "select1": {name: "Select Electrode: Shift-Click", disabled: true},
            "select2": {name: "Select Route: Alt-Click", disabled: true}
        }
    });
  }

  static CreateDatGUI(container=null, menu={}) {
    if (!container) container = document.body;
    const gui = new Dat.GUI({autoPlace: false});
    gui.add(menu.cameraControls, 'enableRotate');
    gui.add(menu.videoControls, "display_anchors");
    gui.add(menu.electrodeControls, "showElectrodeIds");
    gui.domElement.style.position = "absolute";
    gui.domElement.style.top = "0px";
    gui.domElement.style.right = "0px";
    container.appendChild(gui.domElement);
  }
}

const CreateContextMenu = DeviceUIPlugin.CreateContextMenu;
const CreateDatGUI = DeviceUIPlugin.CreateDatGUI;

module.exports = DeviceUIPlugin;
