class DeviceLoader extends PluginController {
  constructor(elem, focusTracker) {
    super(elem, focusTracker, "DeviceLoader");
    this.controls = this.Controls();
    this.listen();
  }
  listen() {
    this.addPostRoute("/load-device", "send-file", false);
    this.on("open-file-upload", this.onOpenFileUpload.bind(this));
    this.on("load-file", this.onLoadFile.bind(this));
  }
  get controls() {return this._controls}
  set controls(controls) {
    if (controls == undefined) this.element.removeChild(this.controls.el);
    if (controls != undefined) this.element.appendChild(controls.el);
    this._controls = controls;
  }
  onLoadFile(file) {
    const reader = new FileReader();
    reader.onload = () => this.trigger("send-file", this.File(file,reader));
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
}
