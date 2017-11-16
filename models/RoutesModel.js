const _ = require('lodash');
const uuid4 = require('uuid/v4');
const Ajv = require('ajv');

const MicrodropAsync = require('@microdrop/async/MicrodropAsync');
const PluginModel = require('./PluginModel');

const ajv = new Ajv({ useDefaults: true });

class RoutesModel extends PluginModel {
  constructor() {
    super();
  }

  // ** Event Listeners **
  listen() {
    this.onPutMsg("routes", this.putRoutes.bind(this));
    this.onPutMsg("route", this.putRoute.bind(this));
    this.onTriggerMsg("execute", this.execute.bind(this));
    this.bindStateMsg("routes", "set-routes");
    this.bindStateMsg("status", "set-status");
  }

  // ** Getters and Setters **
  get channel() {return "microdrop/routes-data-controller";}
  get filepath() {return __dirname;}

  async executeStep(step, prev) {
    const LABEL = "<RoutesModel::executeStep>";
    try {
      const microdrop = new MicrodropAsync();

      for (const [i, id] of step.entries()) {
        if (id == undefined) continue;
        if (prev != undefined) {
          await microdrop.electrodes.toggleElectrode(prev[i], false);
        }
        await microdrop.electrodes.toggleElectrode(id, true);
      }
      return {status: 'success'};
    } catch (e) {
      e =  e.toString().split(",").join("\n");
      throw([LABEL, e]);
    }
  }

  async execute(payload, interval=1000) {
    const LABEL = "<RoutesModel::execute>";
    try {
      const routes = payload.routes;
      const tms = "transitionDurationMilliseconds";
      if (!routes) throw("missing routes in payload");
      if (!routes[0].start) throw("missing start in route");
      if (!routes[0].path) throw("missing path in route");

      const microdrop = new MicrodropAsync();
      let seq = [];

      for (const [i, route] of routes.entries()) {
        const times = await ActiveElectrodeIntervals(route);
        seq = seq.concat(times);
      }

      const lengths  = _.map(routes, (r)=>r.path.length);
      const interval = _.min(_.map(routes, tms)) / routes.length;
      const maxInterval = _.max(_.map(routes, tms));
      const maxTime = maxInterval * _.max(lengths) * 2;

      this.trigger("set-status", "running");

      const complete = () => {
        return new Promise((resolve, reject) => {
          const onComplete = () => {
            resolve("complete");
          }
          ExecutionLoop(seq, interval, 0, maxTime, onComplete);
        });
      };

      await complete();

      this.trigger("set-status", "stopped");

      return this.notifySender(payload, {status: 'running'}, 'execute');
    } catch (e) {
      e =  e.toString().split(",").join("\n");
      return this.notifySender(payload, [LABEL, e], 'execute', 'failed');
    }
  }

  async putRoute(payload) {
    const LABEL = "<RoutesModel::putRoute>"; console.log(LABEL);
    try {
      const microdrop = new MicrodropAsync();
      const schema = microdrop.routes.RouteSchema;

      // Validate route schema
      const validate = ajv.compile(schema);
      if (!validate(payload)) throw(validate.errors);
      var route = _.omit(payload, "__head__");

      // Validate path by checking if electrodesFromRoutes throws error
      var e = await microdrop.device.electrodesFromRoute(route.start, route.path);

      // Get previously stored routes (if failure then set to empty array)
      let routes
      try { routes = await microdrop.routes.routes(500);
      } catch (e) { routes = []; }

      // Check if route exists, and if so override
      var index = _.findIndex(routes, {uuid: route.uuid});

      // Add route to routes
      if (index != -1) {
        routes[index] = route;
      } else {
        route.uuid = uuid4();
        routes.push(route);
      }

      // Update state of microdrop
      routes = await microdrop.routes.putRoutes(routes);
      return this.notifySender(payload, {routes, route}, 'route');
    } catch (e) {
      console.log(LABEL, "ERRORS:::", e);
      e =  e.toString().split(",").join("\n");

      return this.notifySender(payload, [LABEL, e], 'route', 'failed');
    }
  }

  async putRoutes(payload) {
    const LABEL = "<RoutesModel::putRoutes>"; console.log(LABEL);
    try {
      if (!payload.routes) throw("missing payload.routes");
      if (!_.isArray(payload.routes)) throw("payload.routes not an array");

      const microdrop = new MicrodropAsync();
      const routes = payload.routes;

      this.trigger("set-routes", routes);
      return this.notifySender(payload, routes, 'routes');
    } catch (e) {
      e =  e.toString().split(",").join("\n");
      return this.notifySender(payload, [LABEL,e], 'routes', 'failed');
    }
  }
}

const wait = (interval) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve("wait-complete"), interval);
  });
}

function ActiveElectrodesAtTime(elecs, t) {
  // Return active electrodes for a given time (t)
  const active = _.filter(elecs, (e) => t >= e.on && t < e.off);
  const remaining = _.filter(elecs, (e) => t < e.on);
  return {active, remaining}
}

async function ActiveElectrodeIntervals(r) {
  // Get electrode intervals based on a routes time properties
  const microdrop = new MicrodropAsync();
  const seq = await microdrop.device.electrodesFromRoute(r.start, r.path);
  // ids, uuid
  const times = [];
  for (const [i, id] of seq.ids.entries()) {
    const on  = r.transitionDurationMilliseconds * (i-r.trailLength+1);
    const off = r.transitionDurationMilliseconds * (i+1);
    const index = i;
    times.push({id, on, off, index});
  }
  return times;
}

async function ExecutionLoop(elecs, interval, currentTime, maxTime, callback) {
  // Execute Loop continuously until maxTime is reached
  const microdrop = new MicrodropAsync();
  await wait(interval);
  const {active, remaining} = ActiveElectrodesAtTime(elecs, currentTime);
  await microdrop.electrodes.putActiveElectrodes(_.map(active, "id"));
  console.log({remaining, currentTime, maxTime, callback, interval}, remaining.length);

  if (remaining.length == 0) {callback(); return}
  if (currentTime+interval >= maxTime) {callback(); return}

  ExecutionLoop(elecs, interval, currentTime+interval, maxTime, callback);
}

module.exports = RoutesModel;
