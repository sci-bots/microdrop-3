const DeviceController = require('@microdrop/device-controller');
class DeviceUIPlugin extends UIPlugin {
  constructor(elem, focusTracker) {
    super(elem, focusTracker, "DeviceUIPlugin");
    // this.render();
  }
  listen() {
    console.log("LISTENING!!");
    this.render();
  }
  async render() {
    // this.element.innerHTML = `<b>Hello World</b>`;
    const controls = await DeviceController.createScene(this.element);
    console.log("controls", controls);
    const gui = DeviceController.createDatGUI(this.element, controls);
  }
}

module.exports = DeviceUIPlugin;
