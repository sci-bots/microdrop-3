const _ = require('lodash');
const uuid4 = require('uuid/v4');

const MicrodropAsync = require('@microdrop/async/MicrodropAsync');
const PluginModel = require('./PluginModel');

function DataFrameToRoutes(dataframe) {
  const LABEL = "<RoutesModel::DataFrameToRoutes>";
  try {
    if (!dataframe.columns) throw("dataframe.columns missing");
    if (!dataframe.values) throw("dataframe.values missing");
    const columns = dataframe.columns;
    const values = dataframe.values;
    const routes = new Array(values.length);

    for (const [i, val] of values.entries()) {
      if (val.length < 3) throw(`dataframe.values[${i}] should be length 3`);
      const route = new Object();
      route[columns[0]] = val[0]; // electrode id
      route[columns[1]] = val[1]; // route index
      route[columns[2]] = val[2]; // transition index
      routes[i] = route;
    }
    return routes;
  } catch (e) {
    throw([LABEL, e.toString()]);
  }
}

class RoutesModel extends PluginModel {
  constructor() {
    super();
  }

  // ** Event Listeners **
  listen() {
    // TODO: Move schema generator from droplet-planning-plugin to RoutesModel
    // Depricated:
    this.onTriggerMsg("add-dataframe", this.addDataframe.bind(this));

    this.onPutMsg("route-options", this.onPutRouteOptions.bind(this));
    this.onPutMsg("routes", this.putRoutes.bind(this));
    this.onPutMsg("route", this.putRoute.bind(this));
    this.onTriggerMsg("update-schema", this.onUpdateSchema.bind(this));
    this.onTriggerMsg("execute", this.execute.bind(this));
    this.onStateMsg("step-model", "step-number", this.onStepChanged.bind(this));
    this.bindPutMsg("schema-model" ,"schema", "put-schema");
    this.bindStateMsg("route-options", "set-route-options");
    this.bindStateMsg("routes", "set-routes");
  }

  // ** Getters and Setters **
  get channel() {return "microdrop/routes-data-controller";}
  get filepath() {return __dirname;}
  get state() {
    const state = new Object();
    state.drop_routes = this.dropRoutes;
    state.repeat_duration_s = this.repeatDurationSeconds;
    state.route_repeats = this.routeRepeats;
    state.transition_duration_ms = this.transitionDurationMilliseconds;
    state.trail_length = this.trailLength;
    return state;
  }

  async onStepChanged(stepNumber) {
    const LABEL = "<RouteModel::onStepChanged>"; console.log(LABEL);
    try {
      const microdrop = new MicrodropAsync();
      const steps = await microdrop.steps.steps();
      const routes = steps[stepNumber].routes;
      if (routes) this.trigger("set-routes", routes);
    } catch (e) {
      throw([LABEL, e.toString()]);
    }
  }

  async addDataframe(payload) {
    const LABEL = "<RoutesModel::addDataframe>";
    try {
      // if (!payload.drop_routes) throw ("payload.drop_routes missing");
      // const routes = DataFrameToRoutes(payload.drop_routes);
      // const microdrop = new MicrodropAsync();
      // await microdrop.routes.putRoutes(routes);
      // return this.notifySender(payload, routes, 'add-dataframe');
      throw("addDataframe is depricated");
    } catch (e) {
      return this.notifySender(payload, [LABEL, e.toString()], 'add-dataframe', 'failed');
    }
  }

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
      throw([LABEL, e.toString()]);
    }
  }

  async execute(payload, interval=500) {
    const LABEL = "<RoutesModel::execute>";
    try {
      const routes = payload.routes;
      if (!routes) throw("missing routes in payload");
      if (!_.values(routes)[0].start) throw("missing start in route");
      if (!_.values(routes)[0].path) throw("missing path in route");

      const microdrop = new MicrodropAsync();

      const wait = () => {
        return new Promise((resolve, reject) => {
          setTimeout(() => resolve("step-complete"), interval);
        });
      }

      let absoluteRoutes = await microdrop.device.electrodesFromPath(routes);
      const steps = _.zip(..._.values(absoluteRoutes));

      let prev;

      for (const [i, step] of steps.entries()) {
        await this.executeStep(step, prev);
        await wait();
        prev = step;
      }

      return this.notifySender(payload, {status: 'running'}, 'execute');
    } catch (e) {
      return this.notifySender(payload, [LABEL, e.toString()], 'execute', 'failed');
    }
  }

  updateRouteOptions(d) {
    // XXX: Assuming no dropRoutes in options means to set to undefined
    this.dropRoutes = null;
    if ("drop_routes" in d) this.dropRoutes = d.drop_routes;
    if ("trail_length" in d) this.trailLength = d.trail_length;
    if ("transition_duration_ms" in d) this.transitionDurationMilliseconds = d.transition_duration_ms;
    if ("repeat_duration_s" in d) this.repeatDurationSeconds = d.repeat_duration_s;
    if ("route_repeats" in d) this.routeRepeats = d.route_repeats;
  }

  async putRoute(payload) {
    const LABEL = "<RoutesModel::putRoute>"; console.log(LABEL);
    try {
      const start = payload.start;
      const path  = payload.path;

      if (!start) throw("expected 'start' in payload");
      if (!path) throw("expected 'path' in payload");
      if (!_.isString(start)) throw("payload.start should be string");
      if (!_.isArray(path)) throw("payload.path should be array");

      const microdrop = new MicrodropAsync();
      // Validate route through electrodesFromPath function
      const {ids} = await microdrop.device.electrodesFromPath(start, path);

      // Get previously stored routes (if failure then set to empty array)
      let routes
      try { routes = await microdrop.routes.routes(500);
      } catch (e) { routes = {}; }

      // Push new route w/ a newly created unique id
      const uuid = uuid4();
      const route = {start, path, uuid};
      routes[uuid] = route;

      // Update state of microdrop
      routes = await microdrop.routes.putRoutes(routes);
      return this.notifySender(payload, {routes, route}, 'route');
    } catch (e) {
      return this.notifySender(payload, [LABEL, e.toString()], 'route', 'failed');
    }
  }

  async putRoutes(payload) {
    const LABEL = "<RoutesModel::putRoutes>"; console.log(LABEL);
    try {
      if (!payload.routes) throw("missing payload.routes");
      if (!_.isPlainObject(payload.routes)) throw("routes should be plain object");

      const microdrop = new MicrodropAsync();
      const routes = payload.routes;

      this.trigger("set-routes", routes);
      return this.notifySender(payload, routes, 'routes');
    } catch (e) {
      return this.notifySender(payload, [LABEL, e.toString()], 'routes', 'failed');
    }
  }

  onPutRouteOptions(payload) {
    this.updateRouteOptions(payload);
    this.trigger("set-route-options", this.wrapData(null,this.state));
    this.trigger("set-routes",
      this.wrapData("drop_routes", {drop_routes: this.dropRoutes}));
  }
  onUpdateSchema(payload) {
    this.trigger("put-schema", {schema: payload, pluginName: "routes-model"});
  }

}

module.exports = RoutesModel;
