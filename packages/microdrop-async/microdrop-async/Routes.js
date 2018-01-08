const Ajv = require('ajv');
const lo = require('lodash');

const DEFAULT_TIMEOUT = 10000;
const ajv = new Ajv({useDefaults: true});

class Routes {
  constructor(ms) {
      this.ms = ms;
  }

  async clear(routes, timeout=DEFAULT_TIMEOUT) {
    const LABEL = "<MicrodropAsync::Routes::clear>"; //console.log(LABEL);
    try {
      if (!lo.isArray(routes)) throw("expected arg1 to be array of routes")

      const uuids = lo.map(routes, 'uuid');
      routes = await this.routes(timeout);
      routes = lo.filter(routes, (r)=>!lo.includes(uuids, r.uuid));

      const msg = {
        __head__: {plugin_name: this.ms.name},
        routes: routes
      };
      const payload = await this.ms.putPlugin("routes-model", "routes", msg, timeout);
      return payload.response;
    } catch (e) {
      throw(this.ms.dumpStack(LABEL, e));
    }
  }

  async routes(timeout=DEFAULT_TIMEOUT) {
    const LABEL = "<MicrodropAsync::Routes::routes>"; //console.log(LABEL);
    try {
      const routes = await this.ms.getState("routes-model", "routes", timeout);
      return routes;
    } catch (e) {
      throw(this.ms.dumpStack(LABEL, e));
    }
  }

  async execute(routes, timeout=null) {
    const LABEL = "<MicrodropAsync::Routes::execute>"; //console.log(LABEL);
    const msg = {};
    try {
      if (!lo.isArray(routes)) throw("arg 1 should be an array");

      const numSteps = lo.zip(lo.map(routes, "path")).length;
      if (!timeout) timeout =  2 * numSteps * DEFAULT_TIMEOUT;

      const validate = ajv.compile(this.RouteSchema);
      if (!validate(routes[0])) throw(validate.errors);

      lo.set(msg, "__head_.plugin_name", this.ms.name);
      lo.set(msg, "routes", routes);

      const d = await this.ms.triggerPlugin("routes-model", "execute", msg, timeout);
      return d;
    } catch (e) {
      throw(this.ms.dumpStack(LABEL, e));
    }
  }

  async putRoutes(routes, timeout=DEFAULT_TIMEOUT) {
    const LABEL = "<MicrodropAsync::Routes::putRoutes>";
    try {
      if (!lo.isArray(routes)) throw("arg1 should be an array");
      const msg = {
        __head__: {plugin_name: this.ms.name},
        routes: routes
      };
      const payload = await this.ms.putPlugin("routes-model", "routes", msg, timeout);
      return payload.response;
    } catch (e) {
      throw(this.ms.dumpStack(LABEL, e));
    }
  }

  async putRoute(start, path, timeout=DEFAULT_TIMEOUT) {
    const LABEL = "<MicrodropAsync::Routes::putRoute>";
    try {
      let msg;

      if (lo.isString(start))  { msg = {start, path} }
      if (!lo.isString(start)) { msg = start }

      lo.set(msg, "__head_lo.plugin_name", this.ms.name);

      const validate = ajv.compile(this.RouteSchema);
      if (!validate(msg)) throw(validate.errors);

      const payload = await this.ms.putPlugin("routes-model", "route", msg, timeout);
      return payload.response;
    } catch (e) {
      throw(this.ms.dumpStack(LABEL, e));
    }
  }

  get RouteSchema(){
    return {
      type: "object",
      properties: {
        start: {type: "string"},
        path:  {type: "array"},
        trailLength: {type: "integer", minimum: 1, default: 1},
        repeatDurationSeconds: {type: "number", minium: 0, default: 1},
        transitionDurationMilliseconds: {type: "integer", minimum: 100, default: 1000},
        routeRepeats: {type: "integer", minimum: 1, default: 1}
      },
      required: ['start', 'path']
    }
  }

}

module.exports = Routes;
