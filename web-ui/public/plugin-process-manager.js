class PluginProcessManager extends PluginController {
  constructor(elem, focusTracker) {
    super(elem, focusTracker, "PluginProcessManager");
    Object.assign(this, CardMixins);
    
    // ** Init **
    this.listen();
    this.plugins = new Object();
    this.pluginPathField = this.PluginPathField();
  }
  listen() {
    this.addPostRoute("/launch-plugin", "launch-plugin", false);
    this.addPostRoute("/close-plugin", "close-plugin", false);
    this.addGetRoute("microdrop/broker/running-plugins", this.onRunningPluginsUpdated.bind(this));
    this.on("add-plugin", this.onAddPlugin.bind(this));
    this.on("disconnect-plugin", this.onDisconnectPlugin.bind(this));
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
  onDisconnectPlugin(plugin) {
    const state = plugin.state;
    if (state == "running") this.trigger("close-plugin",  plugin.name);
    if (state == "stopped") this.trigger("launch-plugin", plugin.dir);
  }
  onRunningPluginsUpdated(payload){
    const runningPlugins = JSON.parse(payload);
    this.list = this.RunningPluginsContainer(runningPlugins);
  }
  setPluginToStopped(plugin) {
    plugin.state = "stopped";
  }
  PluginPathField() {
    const controls = D("<div></div>");
    const pluginPathsTextField = D('<input type="text" value="" >');
    const addBtn = D("<button>Add Plugin Path </button>");
    addBtn.on("click", (e) => this.trigger("add-plugin", e));
    controls.appendChild(pluginPathsTextField.el);
    controls.appendChild(addBtn.el);
    this.element.appendChild(controls.el);
    return pluginPathsTextField;
  }
  PluginCard(plugin, pluginName) {
    console.log(this);
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
  RunningPluginsContainer(runningPlugins) {
    if (this.list) this.list = undefined;
    const list = D("<div></div>");
    list.appendChild(D("<b>Plugins:</b>").el);

    // Set all plugins to stopped state

    _.each(this.plugins, (plugin) => plugin.state = "stopped");

    // Set state of running plugins to running state
    _.each(runningPlugins, (dir, name) => {
      this.plugins[name] = new Object();
      const plugin = this.plugins[name];
      plugin.dir = dir.toString();
      plugin.name = name;
      plugin.state = "running";
    });

    const container = D("<div></div>");
    _.each(this.plugins, (v,k) => container.appendChild(this.PluginCard(v,k).el));
    list.appendChild(container.el);

    return list;
  }
  RunningPluginsList(runningPlugins) {
    const list = D("<ul></ul>");
    list.setStyles(this.styles.list);
    list.appendChild(D("<b>Plugins:</b>").el);

    // Delete previous list,
    // Set all previous plugins to stopped state,
    // Set running plugins to running state
    if (this.list) this.list = undefined;
    _.each(this.plugins, this.setPluginToStopped.bind(this));
    _.each(runningPlugins, this.Plugin.bind(this));

    // Add list items to dom
    const listItems = _.map(this.plugins, (v) => {return v.listItem});
    _.each(listItems, (item) => list.appendChild(item.el));
    this.element.appendChild(list.el);
    return list;
  }
};
