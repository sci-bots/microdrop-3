const lo = require('lodash');

DEFAULT_TIMEOUT = 10000;

class Routes {
  constructor(ms) {
      this.ms = ms;
  }

  async clear(routes, timeout=DEFAULT_TIMEOUT) {
    const LABEL = "<MicrodropAsync::Routes::clear>"; console.log(LABEL);
    try {
      let keys;
      if (!lo.isPlainObject(routes) && !lo.isArray(routes)){
        throw("arg 1 should be array or object");
      }
      if (lo.isPlainObject(routes)) keys = lo.keys(routes);
      if (lo.isArray(routes)) keys = routes;

      let routes = await this.routes(timeout);
      routes = lo.omit(routes, keys);
      const msg = {
        __head__: {plugin_name: this.ms.name},
        routes: routes
      };
      const payload = await this.ms.putPlugin("routes-model", "routes", msg, timeout);
      return payload.response;
    } catch (e) {
      throw(lo.flattenDeep([LABEL, e]));
    }
  }

  async routes(timeout=DEFAULT_TIMEOUT) {
    const LABEL = "<MicrodropAsync::Routes::routes>"; console.log(LABEL);
    try {
      const routes = await this.ms.getState("routes-model", "routes", timeout);
      return routes;
    } catch (e) {
      throw(lo.flattenDeep([LABEL, routes]));
    }
  }

  async execute(routes, timeout=DEFAULT_TIMEOUT) {
    const LABEL = "<MicrodropAsync::Routes::execute>"; console.log(LABEL);
    try {
      if (lo.isArray(routes)) { routes = lo.zipObject(lo.map(routes, "uuid"), routes);}

      if (!lo.isObject(routes)) throw("arg 1 should be an object");
      if (!lo.values(routes)[0].start) { throw("routes should contain 'start' attribute"); }
      if (!lo.values(routes)[0].path) { throw("routes should contain 'path' attribute"); }

      const msg = {
        __head__: {plugin_name: this.ms.name},
        routes: routes
      };

      const d = await this.ms.triggerPlugin("routes-model", "execute", msg, timeout);
      return d;
    } catch (e) {
      throw([LABEL, e, {args: [routes]}]);
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
    const LABEL = "<MicrodropAsync::Routes::putRoutes>";
    try {
      if (!lo.isPlainObject(routes)) throw("arg1 should be a plain object");
      const msg = {
        __head__: {plugin_name: this.ms.name},
        routes: routes
      };
      const payload = await this.ms.putPlugin("routes-model", "routes", msg, timeout);
      return payload.response;
    } catch (e) {
      throw(lo.flattenDeep([LABEL, e]));
    }
  }

  async putRoute(start, path, timeout=DEFAULT_TIMEOUT) {
    const LABEL = "<MicrodropAsync::Routes::putRoute>";
    try {
      const r = start;
      if (lo.isObject(start)) { start = r.start; path = r.path; }
      if (!lo.isString(start)) throw("arg 1 should be string");
      if (!lo.isArray(path)) throw("arg 2 should be array");
      const msg = {
        __head__: {plugin_name: this.ms.name},
        start: start,
        path: path
      };
      const payload = await this.ms.putPlugin("routes-model", "route", msg, timeout);
      return payload.response;
    } catch (e) {
      throw(lo.flattenDeep([LABEL, e]));
    }
  }

}
module.exports = Routes;
