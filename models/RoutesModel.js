const _ = require('lodash');

const PluginModel = require('./PluginModel');

class RoutesModel extends PluginModel {
  constructor() {
    super();
  }

  // ** Event Listeners **
  listen() {
    this.onPutMsg("route-options", this.onUpdateRouteOptions.bind(this));
    this.onPutMsg("routes", this.onRoutesUpdated.bind(this));
    this.bindPutMsg("protocol-model", "route-options", "put-route-options");
    this.bindPutMsg("ui-controller", "routes", "put-routes");

    this.bindPutMsg("droplet_planning_plugin", "routes", "put-routes");
    this.bindPutMsg("droplet_planning_plugin", "route-repeats", "put-route-repeats");
    this.bindPutMsg("droplet_planning_plugin", "repeat-duration-s", "put-repeat-duration");
    this.bindPutMsg("droplet_planning_plugin", "trail-length", "put-trail-length");
    this.bindPutMsg("droplet_planning_plugin", "transition-duration-ms", "put-transition-duration-ms");
  }

  // ** Getters and Setters **
  get channel() {
    return "microdrop/routes-data-controller";
  }
  get state() {
    const state = new Object();
    state.drop_routes = this.dropRoutes;
    state.repeat_duration_s = this.repeatDurationSeconds;
    state.route_repeats = this.routeRepeats;
    state.transition_duration_ms = this.transitionDurationMilliseconds;
    state.trail_length = this.trailLength;
    return state;
  }
  get dropRoutes() {
    return this._dropRoutes;
  }
  set dropRoutes(dropRoutes) {
    // XXX: Be careful not to override _routes class variable (used by crossroads)
    this._dropRoutes = dropRoutes;
  }
  get repeatDurationSeconds() {
    return this._repeatDurationSeconds;
  }
  set repeatDurationSeconds(repeatDurationSeconds) {
    this._repeatDurationSeconds = repeatDurationSeconds;
    this.trigger("put-repeat-duration-s",
      this.wrapData("repeatDurationSeconds", this.repeatDurationSeconds)
    );
  }
  get routeRepeats() {
    return this._routeRepeats;
  }
  set routeRepeats(routeRepeats) {
    this._routeRepeats = routeRepeats;
    this.trigger("put-route-repeats",
      this.wrapData("routeRepeats", this.routeRepeats)
    );
  }
  get stepNumber() {
    return this._stepNumber;
  }
  set stepNumber(stepNumber) {
    this._stepNumber = stepNumber;
  }
  get transitionDurationMilliseconds() {
    return this._transitionDurationMilliseconds;
  }
  set transitionDurationMilliseconds(transitionDurationMilliseconds) {
    this._transitionDurationMilliseconds = transitionDurationMilliseconds;
    this.trigger("put-transition-duration-ms",
      this.wrapData("transitionDurationMilliseconds",
                    this.transitionDurationMilliseconds)
    );
  }
  get trailLength() {
    return this._trailLength;
  }
  set trailLength(trailLength) {
    this._trailLength = trailLength;
    this.trigger("put-trail-length",
                 this.wrapData("trailLength",this.trailLength));
  }

  // ** Methods **
  updateDropletPlanningPlugin(d) {
    // XXX: Assuming no dropRoutes in options means to set to undefined
    this.dropRoutes = null;
    if ("drop_routes" in d) this.dropRoutes = d.drop_routes;
    if ("trail_length" in d) this.trailLength = d.trail_length;
    if ("transition_duration_ms" in d) this.transitionDurationMilliseconds = d.transition_duration_ms;
    if ("repeat_duration_s" in d) this.repeatDurationSeconds = d.repeat_duration_s;
    if ("route_repeats" in d) this.routeRepeats = d.route_repeats;
  }
  wrapData(key, value) {
    let msg = new Object();
    // Convert message to object if not already
    if (typeof(value) == "object" && value !== null) msg = value;
    else msg[key] = value;
    // Add header
    msg.__head__ = this.DefaultHeader();
    return msg;
  }
  // ** Event Handlers **
  onRoutesUpdated(payload) {
    this.dropRoutes = payload;
    this.trigger("put-route-options", this.wrapData(null, this.state));
    this.trigger("put-routes", this.wrapData(null, this.dropRoutes));
  }

  onStepSwapped(payload) {
    const data = payload.stepData;
    this.stepNumber = payload.stepNumber;

    if (data.droplet_planning_plugin)
      this.updateDropletPlanningPlugin(data.droplet_planning_plugin);
  }

  onUpdateRouteOptions(payload) {
    this.updateDropletPlanningPlugin(payload);
    this.trigger("put-routes", this.wrapData(null, this.dropRoutes));
  }

}

module.exports = RoutesModel;
