const lo = require('lodash');

DEFAULT_TIMEOUT = 10000;

class Routes {
  constructor(ms) {
      this.ms = ms;
  }

  async routes() {
    const LABEL = "<MicrodropAsync::Routes::routes>"; console.log(LABEL);
    const routes = await this.ms.getState("routes-model", "routes");
    return routes;
  }

  async execute(props={}, onComplete=lo.noop, timeout=DEFAULT_TIMEOUT) {
    const LABEL = "<MicrodropAsync::Routes::execute>"; console.log(LABEL);
    const dpp = "droplet_planning_plugin";
    try {
      if (!lo.isPlainObject(props)) throw("arg 1 should be plain object");
      if (!lo.isFunction(onComplete)) throw("arg 2 should be function");
      // Ensure Droplet Planning Plugin is Running
      await this.startDropletPlanningPlugin();
      // Trigger execution to start
      const msg = { __head__: {plugin_name: this.ms.name}, props: props };
      this.ms.triggerPlugin(dpp, "execute-routes",msg, timeout);
      // Attach completion handler
      this.ms.onSignalMsg(dpp, "step-complete", onComplete);
      return;
    } catch (e) {
      // TODO: Add sendNotification method to python library
      throw([LABEL, e]);
    }
  }
  async startDropletPlanningPlugin() {
    return (await this.ms.pluginManager.
      startProcessPluginByName("droplet_planning_plugin"))
  }

  async stopDropletPlanningPlugin() {
    return (await this.ms.pluginManager.
      stopProcessPluginByName("droplet_planning_plugin"))
  }

  async putRoutes(routes, timeout=DEFAULT_TIMEOUT) {
    const msg = {
      __head__: {plugin_name: this.ms.name},
      routes: routes
    };
    const response = await this.ms.putPlugin("routes-model", "routes", msg, timeout);
    return response;
  }

}
module.exports = Routes;
