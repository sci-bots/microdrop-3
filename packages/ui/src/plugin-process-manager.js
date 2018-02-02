const $ = require('jquery');
const {WrapData} = require('@micropede/client/src/client.js');
const UIPlugin = require('@microdrop/ui-plugin/src/ui-plugin.js');

class PluginProcessManager extends UIPlugin {
  constructor(elem, focusTracker) {
    super(elem, focusTracker, "PluginProcessManager");
  }
  listen() {
    this.onStateMsg("web-server", "process-plugins", this.onPluginsUpdated.bind(this));
    this.bindTriggerMsg("web-server", "add-plugin-path", "add-plugin-path");
    this.bindTriggerMsg("web-server", "launch-plugin", "launch-plugin");
    this.bindTriggerMsg("web-server", "close-plugin", "close-plugin");
    this.bindTriggerMsg("web-server", "remove-plugin-path", "remove-plugin-path");

    this.on("add-path", this.onAddPath.bind(this));
    this.on("plugin-action", this.onPluginCardAction.bind(this));
    this.plugins = new Object();
    this.pluginPathField = this.PluginPathField();
  }
  get channel() {return "microdrop/plugin-manager"}

  get list(){return this._list}
  set list(item) {this.changeElement("list", item)}

  get pluginPathField() {
    return this._pluginPathField;
  }
  set pluginPathField(pluginPathField) {
    this._pluginPathField = pluginPathField;
  }
  get styles() {
    const styles = new Object();
    styles.list = {"list-style": "none", margin: 0, padding: 0};
    styles.card = {width: "250px", "min-height": "200px", float: "left",
                   margin: "5px", padding: "5px", "text-align": "center"};
    return styles;
  }
  onAddPath(path) {
    this.trigger("add-plugin-path", WrapData("path", path, this.name));
  }
  onPluginCardAction(msg) {
    const plugin = msg.plugin;
    const element = $(msg.element);
    element.css({opacity: 0.5});

    if (msg.action == "load") this.trigger("launch-plugin", plugin.dir);
    if (msg.action == "stop") this.trigger("close-plugin", plugin.name);
  }
  onPluginsUpdated(payload){
    const allPlugins = payload;
    this.list = this.PluginsContainer(allPlugins);
  }
  setPluginToStopped(plugin) {
    plugin.state = "stopped";
  }
  PluginPathField() {
    const controls = $("<div></div>");
    const field = $('<input type="text" value="" >');
    const addPathBtn =
      $(`<button class="btn btn-secondary">Add Search Path</button>`);
    const linkPluginBtn =
      $(`<button class="btn btn-primary">Register Plugin</button>`);
    const removePathBtn =
      $(`<button class="btn btn-danger">Remove Search Path</button>`);

    addPathBtn.on("click", () =>
      this.trigger("add-path", field[0].value));
    removePathBtn.on("click", () =>
      this.trigger("remove-plugin-path",
      WrapData("path", field[0].value, this.name)));
    linkPluginBtn.on("click", () =>
      this.trigger("add-plugin-path", WrapData("path", field[0].value, this.name)));

    controls.append(field);
    controls.append(addPathBtn);
    controls.append(linkPluginBtn);
    controls.append(removePathBtn);

    this.element.appendChild(controls[0]);
    return field;
  }
  PluginListItem(plugin, id) {
    const row = $(`<div class="row"></div>`);
    const col1 = $(`<div class="col-md-3"></div>`).appendTo(row);
    const col2 = $(`<div class="col-md-6"></div>`).appendTo(row);
    const col3 = $(`<div class="col-md-1"></div>`).appendTo(row);
    const col4 = $(`<div class="col-md-1"></div>`).appendTo(row);

    // Label:
    col1.append(`<label class="mr-2">${plugin.name}</label>`);

    // Badge:
    let cls, text;
    if (plugin.state == "running") {cls = "badge-success"; text = "Running"}
    if (plugin.state == "stopped") {cls = "badge-danger"; text = "Stopped"}
    col1.append(`<span class='badge ${cls} mt-2'>${text}</span>`);

    // Input Field:
    col2.append(`
      <input type="text" class="form-control form-control-sm mt-1"
        value="${plugin.dir}">
    `);

    // Start Btn:
    const startBtn = $(
      `<button type="submit" class="btn btn-primary btn-sm mt-1">
        Start Plugin
      </button>
    `).appendTo(col3);
    startBtn.on("click", () => {this.trigger("plugin-action",
      {action: "load", plugin: plugin, element: startBtn[0]});
    });

    // Stop Btn:
    const stopBtn = $(`
      <button type="submit" class="btn btn-secondary btn-sm mt-1">
        Stop Plugin
      </button>
    `).appendTo(col4);
    stopBtn.on("click", () => { this.trigger("plugin-action",
      {action: "stop", plugin: plugin, element: stopBtn[0]});
    });

    return row[0];
  }
  PluginsContainer(allPlugins) {
    const container = $(`<div class="container"></div>`);

    // Set all plugins to stopped state
    _.each(this.plugins, (plugin) => plugin.state = "stopped");
    this.plugins = new Object();

    // Set state of running plugins to running state
    _.each(allPlugins, (obj, id) => {
      const dir = obj.path;
      const name = obj.name;
      const state = obj.state;
      this.plugins[id] = new Object();
      const plugin = this.plugins[id];
      plugin.dir = dir.toString();
      plugin.name = name;
      plugin.state = obj.state;
    });

    _.each(this.plugins, (v,k) => container.append(this.PluginListItem(v,k)));

    return container[0];
  }
};

module.exports = PluginProcessManager;
