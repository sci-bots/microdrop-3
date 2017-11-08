const DeviceController = require('@microdrop/device-controller');
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
  
  async render() {
    const microdrop = new MicrodropAsync();

    const bbox = this.element.getBoundingClientRect();
    if (bbox.width == 0) return;

    this.controls = await DeviceController.createScene(this.element);
    this.gui = DeviceController.createDatGUI(this.element, this.controls);

    var dat = await DeviceController.SVGRenderer.GenerateSvgGroup("default.svg");
    microdrop.device.putThreeSvgGroup(dat);

    console.log("dat", dat);
  }
}

module.exports = DeviceUIPlugin;
