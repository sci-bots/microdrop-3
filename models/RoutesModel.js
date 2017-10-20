const _ = require('lodash');

const MicrodropAsync = require('@microdrop/async');
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
    throw([LABEL, e]);
  }
}

class RoutesModel extends PluginModel {
  constructor() {
    super();
  }

  // ** Event Listeners **
  listen() {
    this.onPutMsg("route-options", this.onPutRouteOptions.bind(this));
    this.onPutMsg("routes", this.putRoutes.bind(this));
    // TODO: Move schema generator from droplet-planning-plugin to RoutesModel
    this.onTriggerMsg("update-schema", this.onUpdateSchema.bind(this));
    this.onTriggerMsg("add-dataframe", this.addDataframe.bind(this));
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
      throw([LABEL, e]);
    }
  }

  async addDataframe(payload) {
    const LABEL = "<RoutesModel::addDataframe>";
    try {
      if (!payload.drop_routes) throw ("payload.drop_routes missing");
      const routes = DataFrameToRoutes(payload.drop_routes);
      const microdrop = new MicrodropAsync();
      await microdrop.routes.putRoutes(routes);
      return this.notifySender(payload, routes, 'add-dataframe');
    } catch (e) {
      return this.notifySender(payload, [LABEL, e], 'add-dataframe', 'failed');
    }
  }

  // ** Methods **
  updateRouteOptions(d) {
    // XXX: Assuming no dropRoutes in options means to set to undefined
    this.dropRoutes = null;
    if ("drop_routes" in d) this.dropRoutes = d.drop_routes;
    if ("trail_length" in d) this.trailLength = d.trail_length;
    if ("transition_duration_ms" in d) this.transitionDurationMilliseconds = d.transition_duration_ms;
    if ("repeat_duration_s" in d) this.repeatDurationSeconds = d.repeat_duration_s;
    if ("route_repeats" in d) this.routeRepeats = d.route_repeats;
  }


  async putRoutes(payload) {
    const LABEL = "<RoutesModel::putRoutes>"; console.log(LABEL);
    try {
      if (!payload.routes) throw("missing payload.routes");
      const microdrop = new MicrodropAsync();
      const routes = payload.routes;
      const stepNumber = await microdrop.steps.currentStepNumber();
      await microdrop.steps.updateStep('routes', routes, stepNumber);
      this.trigger("set-routes", payload.routes);
      return this.notifySender(payload, payload.routes, 'routes');
    } catch (e) {
      return this.notifySender(payload, [LABEL, e], 'routes', 'failed');
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
