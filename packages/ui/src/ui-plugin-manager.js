const $ = require('jquery');
const request = require('browser-request');

const UIPlugin = require('@microdrop/ui-plugin/src/ui-plugin.js');
const {WrapData} = require('@micropede/client/src/client.js');

class UIPluginManager extends UIPlugin {
  constructor(element, focusTracker) {
    super(element, focusTracker);
    this.pluginCards = new Backbone.Model();
  }
  listen() {
    this.pluginCards.on("all", this.onPluginCardsChanged.bind(this));
    this.bindTriggerMsg("web-server", "remove-plugin", "remove-plugin");
    this.bindTriggerMsg("web-server", "update-ui-plugin-state", "update-state");
    this.on("state-btn-clicked", this.onStateBtnClicked.bind(this));

    this.onStateMsg("web-server", "web-plugins", this.onWebPluginsChanged.bind(this));
  }
  get list(){return this._list}
  set list(item) {this.changeElement("list", item)}
  get controls(){return this._controls}
  set controls(item) {this.changeElement("controls", item)}

  onPluginCardsChanged(msg) {
    this.list = this.List(this.pluginCards);
  }
  onStateBtnClicked(plugin) {
    let newState = "";
    if (plugin.state == "enabled") plugin.state = "disabled";
    else plugin.state = "enabled";

    this.trigger("update-state", WrapData(null, plugin, this.name));
  }
  onWebPluginsChanged(payload) {
    console.log("WebPlugins changed!", payload);
    const webPlugins = payload; delete webPlugins.__head__;

    this.pluginCards.clear();
    for (const [filepath, plugin] of Object.entries(webPlugins)){
      this.pluginCards.set(filepath, plugin);
    }
  }
  ListItem(filepath, plugin) {
    const row = $(`<div class="row"></div>`);
    const col1 = $(`<div class="col-md-3"></div>`).appendTo(row);
    const col2 = $(`<div class="col-md-6"></div>`).appendTo(row);
    const col3 = $(`<div class="col-md-1"></div>`).appendTo(row);
    const col4 = $(`<div class="col-md-1"></div>`).appendTo(row);

    col1.append(`<label class="mr-2">${plugin.name}</label>`);

    // Input Field:
    col2.append(`
      <input type="text" class="form-control form-control-sm mt-1"
        value="${filepath}">
    `);

    let cls, txt = "";
    if (plugin.state == "disabled") {cls="btn-success"; txt="Enable"}
    if (plugin.state == "enabled") {cls="btn-danger"; txt="Disable"}

    const stateBtn = $(
      `<button type="submit" class="btn ${cls} btn-sm mt-1">
        ${txt}
      </button>
    `).appendTo(col3);
    stateBtn.on("click", () => {this.trigger("state-btn-clicked",plugin)})

    return row[0];
  }
  List(pluginCards) {
    const entries = Object.entries(pluginCards.attributes);
    const cards = $(`<div class="container"></div>`)[0];
    for (const [filepath, plugin] of entries)
      cards.appendChild(this.ListItem(filepath, plugin));
    return cards;
  }
  static Init(node, focusTracker) {
    return new Promise((resolve, reject) => {
      request('/mqtt-ws-port', (er, response, body) => {
        const port = parseInt(body);
        resolve(new this(node, focusTracker, port));
      });
    });
  }
}

module.exports = UIPluginManager;
