const DeviceController = require('@microdrop/device-controller');
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
    const bbox = this.element.getBoundingClientRect();
    if (bbox.width == 0) return;

    this.controls = await DeviceController.createScene(this.element);
    this.gui = DeviceController.createDatGUI(this.element, this.controls);
  }
}

module.exports = DeviceUIPlugin;
