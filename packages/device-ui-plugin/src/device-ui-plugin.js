const DeviceController = require('@microdrop/device-controller');
class DeviceUIPlugin extends UIPlugin {
  constructor(elem, focusTracker) {
    super(elem, focusTracker, "DeviceUIPlugin");
    // this.render();
  }
  listen() {
    this.render();
  }
  async render() {
    // this.element.innerHTML = `<b>Hello World</b>`;
    const controls = await DeviceController.createScene(this.element);
    const gui = DeviceController.createDatGUI(this.element, controls);
  }
}

module.exports = DeviceUIPlugin;
