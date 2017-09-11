class ExperimentUI extends UIPlugin {
  constructor(elem, focusTracker){
    super(elem, focusTracker, "Experiment Controller");
    this.controls = this.Controls();
    this.listen();
  }

  // ** Event Listeners **
  listen() {
    // State Routes (Ties to Data Controllers used by plugin):
    this.onStateMsg("protocol-model", "protocol-skeleton", this.onProtocolUpdated.bind(this));
    this.onStateMsg("protocol-model", "protocol-skeletons", this.onProtocolsUpdated.bind(this));
    this.onTriggerMsg("send-protocol", this.onReceivedProtocol.bind(this));

    this.bindTriggerMsg("protocol-model", "new-protocol", "new-protocol");
    this.bindTriggerMsg("protocol-model", "save-protocol", "save");
    this.bindTriggerMsg("protocol-model", "change-protocol", "change-protocol");
    this.bindTriggerMsg("protocol-model", "delete-protocol", "delete-protocol");
    this.bindTriggerMsg("protocol-model", "upload-protocol", "upload-protocol");
    this.bindNotifyMsg("protocol-model", "request-protocol-export", "request-protocol-export");

    this.on("item-clicked", this.onItemClicked.bind(this));
    this.on("delete", this.onDelete.bind(this));
  }
  download(str) {
    const anchor = D('<a style="display:none"></a>');
    const data = "data:text/json;charset=utf-8," + encodeURIComponent(str);
    anchor.setAttribute("href", data);
    anchor.setAttribute("download", "protocol.json");
    anchor.click();
  }
  readFile(input) {
    const file   = input.el.files[0];
    const reader = new FileReader();
    reader.onload = this.onFileUploaded.bind(this);
    reader.readAsText(file);
  }
  upload() {
    const input = D('<input type="file" name="name" style="display: none;" />');
    input.on("change", () => this.readFile(input));
    input.click();
  }
  wrapData(key, value) {
    const msg = new Object();
    msg.__head__ = this.DefaultHeader();
    msg[key] = value;
    return msg;
  }

  // ** Getters and Setters **
  get name() { return "experiment-ui"}

  get protocols() {
    return this._protocols;
  }

  set protocols(protocols) {
    this._protocols = protocols;
    if (!this.protocol)
      this.trigger("change-protocol",
                   this.wrapData("name", _.last(this._protocols).name));
    this.list = this.List(this._protocols);
  }

  get protocol() {
    return this._protocol;
  }

  set protocol(protocol) {
    this._protocol = protocol;
    if (!this.protocols) {
      console.error("Tried setting protocol, but protocols was undefined");
      return;
    }
    this.list = this.List(this.protocols);
  }

  get list() {
    return this._list;
  }

  set list(list) {
    const prevList = this._list;

    // Set
    this._list = list;
    if (list) return;

    // Delete
    const node = prevList.el;
    this.element.removeChild(node);
    this._list = undefined;
    return;
  }

  get style() {
    const style = new Object();
    const border = "1px solid black";
    const highlight = "rgb(34, 80, 155)";
    style.ul = {"list-style": "none", padding: 0};
    style.li_inactive = {border: border};
    style.li_active = {border: border, background: highlight, color: "white"};
    return style;
  }

  get time() {
    return new Date(new Date().getTime()).toLocaleString();
  }

  // ** Event Handlers **
  onDelete(){
    this.trigger("delete-protocol", this.wrapData("protocol", this.protocol));
    this.protocol = undefined;
  }
  onDuplicate(msg){
    const name = "Protocol: " + this.time;
    this.trigger("save", this.wrapData("name", name));
  }
  onExport(msg) {
    console.log("REQUESTING ExPORT!!");
    this.trigger("request-protocol-export", this.wrapData("body", null));
  }
  onImport(msg) {
    this.upload();
  }
  onFileUploaded(msg) {
    const protocol = JSON.parse(msg.target.result);
    protocol.name = "Protocol: " + this.time;
    this.trigger("upload-protocol", this.wrapData("protocol", protocol));
  }
  onProtocolsUpdated(msg) {
    this.protocols = JSON.parse(msg);
  }
  onItemClicked(protocol) {
    this.trigger("change-protocol", this.wrapData("name", protocol.name));
  }
  onNew() {
    this.trigger("new-protocol",
                 this.wrapData("body",null));
  }
  onProtocolUpdated(msg){
    this.protocol = JSON.parse(msg);
  }
  onReceivedProtocol(msg) {
    const str = msg;
    this.download(str);
  }
  onSave(msg){
    this.trigger("save", this.wrapData("name", this.protocol.name));
  }

  // ** Initializers **
  Controls() {
    const controls   = new Object();
    controls.newbtn    = $(`<button type='button'>New</button>`);
    controls.savebtn   = $("<button type='button'>Save</button>");
    controls.dupbtn    = $("<button type='button'>Duplicate</button>");
    controls.exportbtn = $("<button type='button'>Export</button>");
    controls.importbtn = $("<button type='button'>Import</button>");

    // TODO: Should trigger events vs directly calling them
    controls.newbtn.on("click", this.onNew.bind(this));
    controls.savebtn.on("click", this.onSave.bind(this));
    controls.dupbtn.on("click", this.onDuplicate.bind(this));
    controls.exportbtn.on("click", this.onExport.bind(this));
    controls.importbtn.on("click", this.onImport.bind(this));

    this.element.appendChild(controls.newbtn[0]);
    this.element.appendChild(controls.savebtn[0]);
    this.element.appendChild(controls.dupbtn[0]);
    this.element.appendChild(controls.exportbtn[0]);
    this.element.appendChild(controls.importbtn[0]);
    return controls;
  }

  Item(protocol, i) {
    const item = D("<li><li>");
    let style;

    item.innerText = protocol.name;
    item.on("click", () => this.trigger("item-clicked", protocol));

    if (!this.protocol) return item;

    if (protocol.name == this.protocol.name) style = this.style.li_active;
    if (protocol.name != this.protocol.name) style = this.style.li_inactive;
    item.setStyles(style);
    return item;
  }

  List(protocols) {
    const style = this.style.ul;
    // Delete previous list
    if (this.list) this.list = undefined;

    // Append items to list
    const list = D("<ul></ul>");
    list.setStyles(style);
    protocols.forEach((protocol,i) => {
      list.appendChild(this.Item(protocol,i).el);
    });

    // Add list to DOM
    this.element.appendChild(list.el);
    return list;
  }

  // ** Static Methods **
  static position() {
    /* topLeft, topRight, bottomLeft, or bottomRight */
    return "topRight";
  }
}

if (!window.microdropPlugins) window.microdropPlugins = new Map();
window.microdropPlugins.set("ExperimentUI", ExperimentUI);
