class PluginManager {
  constructor(ms) {
    this.ms = ms;
  }

  getProcessPlugins() {
    return this.ms.getState("web-server", "process-plugins");
  }

  async getRunningProcessPlugins() {
    const plugins = await this.getProcessPlugins();
    const runningPlugins = new Array();
    for (const [id, plugin] of Object.entries(plugins)) {
      if (plugin.state == 'running')
        runningPlugins.push(plugin);
    }
    return runningPlugins;
  }

  async findProcessPluginByName(name) {
    const plugins = await this.getProcessPlugins();
    const pluginInstances = new Array();
    for (const [id, plugin] of Object.entries(plugins)){
      if (plugin.name == name)
        pluginInstances.push(plugin);
    }
    return pluginInstances;
  }

  async checkStatusOfPluginWithName(name) {
    const plugins = await this.findProcessPluginByName(name);
    let runningState = false;
    for (const [i, plugin] of plugins.entries()){
      if (plugin.state == "running") {
        runningState = true;
      }
    }
    return runningState;
  }
  async startProcessPluginById(id, timeout=10000){
    const LABEL = "<PluginManager#startProcessPluginById>";
    const plugin = (await this.getProcessPlugins())[id];
    if (plugin.state == 'running'){
      const response = `${name} already running`;
      console.warn(response);
      return {success: true, response: response};
    }
    const msg = {
      __head__: {plugin_name: this.ms.name},
      path: plugin.path
    };
    return (await this.ms.triggerPlugin("web-server", "launch-plugin",
            msg, timeout));
  }

  async stopProcessPluginById(id, timeout) {
    const LABEL = "<PluginManager#stopProcessPluginById>";
    const plugin = (await this.getProcessPlugins())[id];
    if (plugin.state == 'stopped'){
      const response = ` ${name} already stopped`;
      console.warn(response);
      return {success: true, response: response};
    }
    const msg = {
      __head__: {plugin_name: this.ms.name},
      name: plugin.name
    };
    return (await this.ms.triggerPlugin("web-server", "close-plugin",
            msg, timeout));
  }

  async stopProcessPluginByName(name) {
    const LABEL = "<PluginManager#stopProcessPluginByName>";
    const pluginInstances = await this.findProcessPluginByName(name);
    const runningState = await this.checkStatusOfPluginWithName(name);
    if (runningState == false) {
      const response = `${name} already stopped`;
      return {success: true, response: response};
    }
    if (pluginInstances.length == 0) {
      throw(`${LABEL} could node find ${name}.
      Have you added ${name} to the plugin manager?`);
    }
    for (const [i, plugin] of pluginInstances.entries()){
      if (plugin.state == "running"){
        const pluginId = `${plugin.name}:${plugin.path}`;
        return (await this.stopProcessPluginById(pluginId));
      }
    }
    throw(`${LABEL} Failed to stop ${name}`);
  }

  async startProcessPluginByName(name) {
    const LABEL = "<PluginManager#startProcessPluginByName>";
    const pluginInstances = await this.findProcessPluginByName(name);
    let runningState = await this.checkStatusOfPluginWithName(name);
    if (runningState == true) {
      const response = `${name} already running`;
      console.warn(response);
      return {success: true, response: response};
    }
    if (pluginInstances.length > 1) {
      console.warn(`${LABEL} More than one instance of ${name} running
        Recommend starting plugin by id vs. name`);
    }
    if (pluginInstances.length == 0) {
      const exception = `${LABEL} could node find ${name}.
      Have you added ${name} to the plugin manager?`;
      throw(exception);
    }
    for (const [i, plugin] of pluginInstances.entries()){
      if (plugin.state == "stopped"){
        const pluginId = `${plugin.name}:${plugin.path}`;
        return (await this.startProcessPluginById(pluginId));
      }
    }
    throw(`${LABEL} plugin ${name} not started`);
  }

}

module.exports = PluginManager;
