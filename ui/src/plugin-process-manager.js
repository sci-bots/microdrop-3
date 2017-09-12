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
  get list() {return this._list;}
  set list(list) {
    if (list == undefined) this.element.removeChild(this._list.el);
    if (list != undefined) this.element.appendChild(list.el);
    this._list = list;
  }
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
    const element = msg.element;
    element.setStyles({opacity: 0.5});
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
  PluginCard(plugin, pluginName) {
    const styles = this.Styles();

    // Init Card (Item):
    const item = D("<div class='card'></div>");
    item.setStyles(styles.card);
    item.appendChild(this.Title(pluginName));
    item.appendChild(this.InputField("Plugin Location", plugin.dir));

    // Button Events:
    const loadMsg = {action: "load", plugin: plugin, element: item};
    const load = () => {this.trigger("plugin-action", loadMsg)};
    const stopMsg = {action: "stop", plugin: plugin, element: item};
    const stop = () => {this.trigger("plugin-action", stopMsg)};

    // Buttons:
    const buttonGroup = document.createElement("div");
    const loadBtn = this.Button(load, "load","btn-primary");
    const stopBtn = this.Button(stop, "stop","btn-secondary");
    if (plugin.state == "running") loadBtn.addClasses("disabled");
    if (plugin.state == "stopped") stopBtn.addClasses("disabled");
    buttonGroup.appendChild(loadBtn);
    buttonGroup.appendChild(stopBtn);
    item.appendChild(buttonGroup);

    // Badge:
    const statusBadge = new Object();
    const runningBadge = this.Badge("Running","badge-success");
    const stoppedBadge = this.Badge("Stopped","badge-danger");
    if (plugin.state == "running") item.appendChild(runningBadge);
    if (plugin.state == "stopped") item.appendChild(stoppedBadge);

    return item;
  }
  PluginsContainer(allPlugins) {
    if (this.list) this.list = undefined;
    const list = D("<div></div>");
    list.appendChild(D("<b>Plugins:</b>").el);

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

    const container = D("<div></div>");

    _.each(this.plugins, (v,k) => container.appendChild(this.PluginCard(v,k).el));
    list.appendChild(container.el);

    return list;
  }
};
