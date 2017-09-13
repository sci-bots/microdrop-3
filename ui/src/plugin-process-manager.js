class PluginProcessManager extends UIPlugin {
  constructor(elem, focusTracker) {
    super(elem, focusTracker, "PluginProcessManager");
    Object.assign(this, CardMixins);

    // ** Init **
    this.listen();
    this.plugins = new Object();
    this.pluginPathField = this.PluginPathField();
  }
  listen() {
    this.onStateMsg("web-server", "new-process-plugins", this.onPluginsUpdated.bind(this));
    this.bindTriggerMsg("web-server", "launch-plugin", "launch-plugin");
    this.bindTriggerMsg("web-server", "close-plugin", "close-plugin");
    this.bindTriggerMsg("web-server", "save-process-plugins", "save-plugins");

    this.on("add-plugin", this.onAddPlugin.bind(this));
    this.on("plugin-action", this.onPluginCardAction.bind(this));
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
  onAddPlugin(msg) {
    // Get path from text field:
    const path = this.pluginPathField.value;
    this.trigger("launch-plugin", path);
  }
  onPluginCardAction(msg) {
    const plugin = msg.plugin;
    const element = $(msg.element);
    element.css({opacity: 0.5});
    if (msg.action == "load") this.trigger("launch-plugin", plugin.dir);
    if (msg.action == "stop") this.trigger("close-plugin", plugin.name);
  }

  onPluginsUpdated(payload){
    const allPlugins = JSON.parse(payload);
    this.list = this.PluginsContainer(allPlugins);
  }
  setPluginToStopped(plugin) {
    plugin.state = "stopped";
  }
  PluginPathField() {
    const controls = D("<div></div>");
    const pluginPathsTextField = D('<input type="text" value="" >');
    const addBtn = D(`<button class="btn btn-secondary">Add Plugin Path</button>`);
    const saveBtn = $(`<button class="btn btn-primary">Save Plugins</button>`);

    addBtn.on("click", (e) => this.trigger("add-plugin", e));
    saveBtn.on("click", () => this.trigger("save-plugins", null));

    controls.appendChild(pluginPathsTextField.el);
    controls.appendChild(addBtn.el);
    controls.appendChild(saveBtn[0]);
    this.element.appendChild(controls.el);
    return pluginPathsTextField;
  }
  PluginListItem(plugin, pluginName) {
    const row = $(`<div class="row"></div>`);
    const col1 = $(`<div class="col-md-3"></div>`).appendTo(row);
    const col2 = $(`<div class="col-md-6"></div>`).appendTo(row);
    const col3 = $(`<div class="col-md-1"></div>`).appendTo(row);
    const col4 = $(`<div class="col-md-1"></div>`).appendTo(row);

    // Label:
    col1.append(`<label class="mr-2">${pluginName}</label>`);

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

    // Set state of running plugins to running state
    _.each(allPlugins, (obj, name) => {
      const dir = obj.path;
      const state = obj.state;
      this.plugins[name] = new Object();
      const plugin = this.plugins[name];
      plugin.dir = dir.toString();
      plugin.name = name;
      plugin.state = obj.state;
    });

    // const container = $("<div></div>");
    //
    _.each(this.plugins, (v,k) => container.append(this.PluginListItem(v,k)));
    // list.append(container[0]);

    return container[0];
  }
};
