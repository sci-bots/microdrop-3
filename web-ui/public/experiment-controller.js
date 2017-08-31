class ExperimentController extends PluginController {
  constructor(elem, focusTracker){
    super(elem, focusTracker, "Experiment Controller");
    this.controls = this.Controls();
    this.listen();
  }

  // ** Event Listeners **
  listen() {
    // State Routes (Ties to Data Controllers used by plugin):
    this.addGetRoute("microdrop/put/experiment-controller/state/protocol-skeleton", this.onProtocolUpdated.bind(this));
    this.addGetRoute("microdrop/data-controller/protocol-skeletons", this.onGetProtocols.bind(this));
    this.addGetRoute("microdrop/data-controller/send-protocol", this.onReceivedProtocol.bind(this));

    this.addPostRoute("/save-protocol", "save");
    this.addPostRoute("/change-protocol", "change-protocol");
    this.addPostRoute("/delete-protocol", "delete-protocol");
    this.addPostRoute("/request-protocol-export", "request-protocol-export");
    this.addPostRoute("/upload-protocol", "upload-protocol");

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

  // ** Getters and Setters **
  get protocols() {
    return this._protocols;
  }

  set protocols(protocols) {
    this._protocols = protocols;
    if (!this.protocol)
      this.trigger("change-protocol", _.last(this._protocols).name);
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
    this.trigger("delete-protocol", this.protocol);
    this.protocol = undefined;
  }
  onDuplicate(msg){
    const name = "Protocol: " + this.time;
    this.trigger("save", name);
  }
  onExport(msg) {
    this.trigger("request-protocol-export", null);
  }
  onImport(msg) {
    this.upload();
  }
  onFileUploaded(msg) {
    const protocol = JSON.parse(msg.target.result);
    protocol.name = "Protocol: " + this.time;
    this.trigger("upload-protocol", protocol);
  }
  onGetProtocols(msg) {
    console.log("Getting protocols...");
    console.log(JSON.parse(msg));
    this.protocols = JSON.parse(msg);
  }
  onItemClicked(protocol) {
    this.trigger("change-protocol", protocol.name);
  }
  onProtocolUpdated(msg){
    this.protocol = JSON.parse(msg);
  }
  onReceivedProtocol(msg) {
    const str = msg;
    this.download(str);
  }
  onSave(msg){
    this.trigger("save", this.protocol.name);
  }

  // ** Initializers **
  Controls() {
    const controls   = new Object();
    controls.savebtn = D("<button type='button'>Save</button>");
    controls.dupbtn = D("<button type='button'>Duplicate</button>");
    controls.exportbtn = D("<button type='button'>Export</button>");
    controls.importbtn = D("<button type='button'>Import</button>");

    // TODO: Should trigger events vs directly calling them
    controls.savebtn.on("click", this.onSave.bind(this));
    controls.dupbtn.on("click", this.onDuplicate.bind(this));
    controls.exportbtn.on("click", this.onExport.bind(this));
    controls.importbtn.on("click", this.onImport.bind(this));

    this.element.appendChild(controls.savebtn.el);
    this.element.appendChild(controls.dupbtn.el);
    this.element.appendChild(controls.exportbtn.el);
    this.element.appendChild(controls.importbtn.el);
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

}
