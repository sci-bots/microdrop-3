const request = require('browser-request');
const Key = require('keyboard-shortcut');
const {MicropedeClient} = require('@micropede/client/src/client.js');

if (!window.microdropPlugins)
  window.microdropPlugins = new Map();

const APPNAME = 'microdrop';

class UIPlugin extends MicropedeClient {
  constructor(element, focusTracker, port) {
    super(APPNAME, undefined, port);
    this.element = element;
    this.focusTracker = focusTracker;
    Key("delete", () => {
      if (this.hasFocus) this.trigger("delete");
    });
  }

  get isPlugin() { return true }
  get element() {return this._element}
  get hasFocus() {return this.element == this.focusTracker.currentWidget.node}
  set element(element) {
    element.tabIndex = 0; this._element = element;
  }

  changeElement(k,item) {
    if (this[k]) this.element.removeChild(this[k]);
    this.element.appendChild(item);
    this[`_${k}`] = item;
  }

  static Widget(panel, dock, focusTracker) {
    /* Add plugin to specified dock panel */
    return new Promise((resolve, reject) => {
      request('/mqtt-ws-port', (er, response, body) => {
        const widget = new PhosphorWidgets.Widget();
        widget.addClass("content");
        const port = parseInt(body);
        const plugin = new this(widget.node,focusTracker, port);
        widget.title.label = plugin.name;
        widget.plugin = plugin;
        widget.title.closable = true;
        panel.addWidget(widget,  {mode: "tab-before", ref: dock});
        panel.activateWidget(widget);
        focusTracker.add(widget);
        resolve(widget);
      });
    });
  }

}

module.exports = UIPlugin;
