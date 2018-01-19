require('style-loader!css-loader!jquery-contextmenu/dist/jquery.contextMenu.css');
const $ = require('jquery'); require('jquery-contextmenu');
const Key = require('keyboard-shortcut');
const Dat = require('dat.gui/build/dat.gui');
const uuid = require('uuid/v4');
const yo = require('yo-yo');

const DeviceController = require('@microdrop/device-controller/src/device-controller');
const MicropedeAsync = require('@micropede/client/src/async.js');
const UIPlugin = require('@microdrop/ui-plugin');

const DIRECTIONS = {LEFT: "left", UP: "up", DOWN: "down", RIGHT: "right"};
window.MicropedeAsync = MicropedeAsync;

class DeviceUIPlugin extends UIPlugin {
  constructor(elem, focusTracker) {
    super(elem, focusTracker);
    this.controls = null;
    this.contextMenu = null;
    this.gui = null;
  }

  listen() {
    this.on("updateRequest", this.onUpdateRequest.bind(this));

    // XXX: Sometimes updateRequest doesn't fire on page reload (thus force it with timeout)
    setTimeout(()=>this.trigger("updateRequest"), 1000);

    Key("left", this.move.bind(this, DIRECTIONS.LEFT));
    Key("right", this.move.bind(this, DIRECTIONS.RIGHT));
    Key("up", this.move.bind(this, DIRECTIONS.UP));
    Key("down", this.move.bind(this, DIRECTIONS.DOWN));
  }

  move(...args) {
    if (!this.controls) return;
    if (document.activeElement != this.element) return;
    this.controls.electrodeControls.move(...args);
  }

  onUpdateRequest(msg) {
    if (!this.controls) { this.render(); }
    else {
      this.controls.cameraControls.trigger("updateRequest", this);
    }
  }

  contextMenuClicked(key, options) {
    if (!this.controls) return true;
    const microdrop = new MicropedeAsync('microdrop');
    switch (key) {
      case "clearElectrodes":
        microdrop.putPlugin('electrodes-model', 'active-electrodes', []);
        break;
      case "clearRoutes":
        microdrop.putPlugin('routes-model', 'routes', []);
        break;
      case "clearRoute":
        this.controls.routeControls.trigger("clear-route", {key, options});
        break;
      case "executeRoute":
        this.controls.routeControls.trigger("execute-route", {key, options});
        break;
      case "executeRoutes":
        microdrop.getState('routes-model', 'routes').then((routes) => {
          microdrop.triggerPlugin('routes-model', 'execute', {routes}, -1);
        });
        break;
    }
    return true;
  }

  async render() {
    const LABEL = "DeviceUIPlugin::render";
    try {
      // Don't render if not visible or already rendererd
      const bbox = this.element.getBoundingClientRect();
      const children = _.filter(this.element.children, (c)=>c.tagName != "SCRIPT");
      if (bbox.width == 0) return;
      if (children.length != 0) return;

      const controls = await DeviceController.createScene(this.element);
      const gui = CreateDatGUI(this.element, controls);
      const contextMenu = CreateContextMenu(this.element, this.contextMenuClicked.bind(this));

      const dat = await DeviceController.SVGRenderer.ConstructObjectsFromSVG("/default.svg");
      const microdrop = new MicropedeAsync('microdrop');
      await microdrop.putPlugin('device-model', 'three-object', dat);

      this.controls = controls;
      this.gui = gui;
      this.contextMenu = contextMenu;

      this.element.onclick = () => this.element.focus();

    } catch (e) {
      console.error(LABEL, e.toString());
    }
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
    gui.domElement.style.position = "absolute";
    gui.domElement.style.top = "0px";
    gui.domElement.style.right = "0px";
    container.appendChild(gui.domElement);
  }
}

const CreateContextMenu = DeviceUIPlugin.CreateContextMenu;
const CreateDatGUI = DeviceUIPlugin.CreateDatGUI;

module.exports = DeviceUIPlugin;
