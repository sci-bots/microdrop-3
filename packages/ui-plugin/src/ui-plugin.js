const Key = require('keyboard-shortcut');
const {MicropedeClient} = require('@micropede/client/src/client.js');

if (!window.microdropPlugins)
  window.microdropPlugins = new Map();

const APPNAME = 'microdrop';

class UIPlugin extends MicropedeClient {
  constructor(element, focusTracker) {
    super(APPNAME);
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

}

module.exports = UIPlugin;
