require('style-loader!css-loader!jquery-contextmenu/dist/jquery.contextMenu.css');
const $ = require('jquery'); require('jquery-contextmenu');
const Dat = require('dat.gui/build/dat.gui');
const uuid = require('uuid/v4');

const SVGRenderer = require('@microdrop/device-controller/src/svg-renderer');

const DeviceController = require('@microdrop/device-controller/src/device-controller');
const MicrodropAsync = require('@microdrop/async');


class DeviceUIPlugin extends UIPlugin {
  constructor(elem, focusTracker) {
    super(elem, focusTracker, "DeviceUIPlugin");
    this.controls = null;
    this.gui = null;
  }

  listen() {
    this.on("updateRequest", this.onUpdateRequest.bind(this));
    this.render();
  }

  onUpdateRequest(msg) {
    if (!this.controls) this.render();
    else {
      this.controls.cameraControls.trigger("updateRequest", this);
    }
  }

  contextMenuClicked(key, options) {
    const microdrop = new MicrodropAsync();
    switch (key) {
      case "clearElectrodes":
        microdrop.electrodes.putActiveElectrodes([]);
        break;
      case "clearRoutes":
        microdrop.routes.putRoutes({});
        break;
      case "clearRoute":
        this.controls.routeControls.trigger("clear-route", {key, options});
        break;
      case "executeRoute":
        this.controls.routeControls.trigger("execute-route", {key, options});
        break;
      case "executeRoutes":
        this.controls.routeControls.trigger("execute-route", {key, options});
        break;
    }
  }

  async render() {
    const bbox = this.element.getBoundingClientRect();
    if (bbox.width == 0) return;

    this.controls = await DeviceController.createScene(this.element);
    this.gui = CreateDatGUI(this.element, this.controls);
    this.contextMenu = CreateContextMenu(this.element, this.contextMenuClicked.bind(this));

    const dat = await SVGRenderer.ConstructObjectsFromSVG("default.svg");
    const microdrop = new MicrodropAsync();
    await microdrop.device.putThreeObject(dat);
  }

  static CreateContextMenu(element, callback) {
    const microdrop = new MicrodropAsync();
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
            executeRoutes: {name: "Execute Routes"}
        }
    });
  }

  static CreateDatGUI(container=null, menu={}) {
    if (!container) container = document.body;
    const gui = new Dat.GUI({autoPlace: false});
    gui.add(menu.cameraControls || cameraControls, 'enableRotate');
    gui.add(menu.videoControls || videoControls, "display_anchors");
    gui.domElement.style.position = "absolute";
    gui.domElement.style.top = "0px";
    gui.domElement.style.right = "0px";
    container.appendChild(gui.domElement);
  }
}

const CreateContextMenu = DeviceUIPlugin.CreateContextMenu;
const CreateDatGUI = DeviceUIPlugin.CreateDatGUI;

module.exports = DeviceUIPlugin;
