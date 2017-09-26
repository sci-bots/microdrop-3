const _ = require('lodash');

const PluginModel = require('./PluginModel');

class RoutesModel extends PluginModel {
  constructor() {
    super();
  }

  // ** Event Listeners **
  listen() {
    this.onPutMsg("route-options", this.onPutRouteOptions.bind(this));
    this.onPutMsg("routes", this.onPutRoutes.bind(this));
    // TODO: Move schema generator from droplet-planning-plugin to RoutesModel
    this.onTriggerMsg("update-schema", this.onUpdateSchema.bind(this));
    this.bindSignalMsg("update-schema", "update-schema");

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
  // ** Event Handlers **
  onPutRoutes(payload) {
    this.dropRoutes = payload.drop_routes;
    this.trigger("set-route-options", this.wrapData(null,this.state));
    this.trigger("set-routes",
      this.wrapData("drop_routes", {drop_routes: this.dropRoutes}));
  }

  onPutRouteOptions(payload) {
    this.updateRouteOptions(payload);
    this.trigger("set-route-options", this.wrapData(null,this.state));
    this.trigger("set-routes",
      this.wrapData("drop_routes", {drop_routes: this.dropRoutes}));
  }

  onUpdateSchema(payload) {
    this.trigger("update-schema", payload);
  }

}

module.exports = RoutesModel;
