class DeviceLoader extends UIPlugin {
  constructor(elem, focusTracker) {
    super(elem, focusTracker, "DeviceLoader");
    this.controls = this.Controls();
    this.listen();
  }
  listen() {
    this.bindTriggerMsg("device-model", "load-device", "send-file");
    this.on("open-file-upload", this.onOpenFileUpload.bind(this));
    this.on("load-file", this.onLoadFile.bind(this));
  }
  wrapData(key, value) {
    let msg = new Object();
    // Convert message to object if not already
    if (typeof(value) == "object" && value !== null) msg = value;
    else msg[key] = value;
    // Add header
    msg.__head__ = this.DefaultHeader();
    return msg;
  }
  get controls() {return this._controls}
  set controls(controls) {
    if (controls == undefined) this.element.removeChild(this.controls.el);
    if (controls != undefined) this.element.appendChild(controls.el);
    this._controls = controls;
  }
  onLoadFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      this.trigger("send-file", this.wrapData(null, this.File(file,reader)))}
    reader.readAsText(file);
  }
  onOpenFileUpload() {
    const input = D("<input type='file'/>");
    input.on("change", (e)=> this.trigger("load-file", input.el.files[0]));
    input.click();
  }
  File(file, reader) {
    return {name: file.name, file: reader.result};
  }
  Controls() {
    // Textfield:
    const uploadTextfield = D("<input type='text' disabled />");
    const uploadButton = D("<button>Upload</button>");
    const container = D("<div></div");
    uploadButton.on("click", () => this.trigger("open-file-upload"));
    container.appendChild(uploadTextfield.el);
    container.appendChild(uploadButton.el);
    return container;
  }
  // ** Static Methods **
  static position() {
    /* topLeft, topRight, bottomLeft, or bottomRight */
    return "bottomLeft";
  }
}

if (!window.microdropPlugins) window.microdropPlugins = new Map();
window.microdropPlugins.set("DeviceLoader", DeviceLoader);
