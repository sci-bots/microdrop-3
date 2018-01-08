const Key = require('keyboard-shortcut');
const MQTTClient = require('@mqttclient/web');

if (!window.microdropPlugins)
  window.microdropPlugins = new Map();

class UIPlugin extends MQTTClient {
  constructor(element, focusTracker) {
    super();
    this.element = element;
    this.focusTracker = focusTracker;
    this._listen();
  }

  // ** Event Listeners **
  _listen() {
    Key("delete", this._onDelete.bind(this));
  }

  // ** Event Handlers **
   _onDelete(){
     if (this.hasFocus) this.trigger("delete");
   }

  // ** Getters and Setters **
  set element(element) {
    // XXX: Must set tabIndex property for FocusTracker to work
    element.tabIndex = 0;
    this._element = element;
  }
  get element() {return this._element}
  get hasFocus() {return this.element == this.focusTracker.currentWidget.node}
  get version() {return "0.0"}

  // ** Methods **
  changeElement(k,item) {
    if (this[k]) this.element.removeChild(this[k]);
    this.element.appendChild(item);
    this[`_${k}`] = item;
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

  // ** Initializers **
  DefaultHeader() {
    const header = new Object();
    header.plugin_name = this.name;
    header.plugin_version = this.version;
    return header;
  }

  // ** Static Methods **
  static Widget(panel, dock, focusTracker) {
    /* Add plugin to specified dock panel */
    const widget = new PhosphorWidgets.Widget();
    widget.addClass("content");
    const plugin = new this(widget.node,focusTracker);
    widget.title.label = plugin.name;
    widget.title.closable = true;
    widget.plugin = plugin;
    panel.addWidget(widget,  {mode: "tab-before", ref: dock});
    panel.activateWidget(widget);
    focusTracker.add(widget);
    return widget;
  }

  static position() {
    /* topLeft, topRight, bottomLeft, or bottomRight */
    return "topLeft";
  }

};

module.exports = UIPlugin;
