const _ = require('lodash');

const DataController = require('./DataController');

class RoutesDataController extends DataController {
  constructor() {
    super();
  }

  // ** Event Listeners **
  listen() {
    this.addRoute("microdrop/droplet-planning-plugin/routes",  this.onRoutesUpdated.bind(this));
    this.addRoute("microdrop/data-controller/route-options", this.onUpdateRouteOptions.bind(this));

    this.addPutRoute("data-controller", "route-options", "route-options-set");
    this.addPutRoute("droplet-planning-plugin", "routes","routes-set");
    this.addPutRoute("dmf-device-ui", "routes", "routes-set");

    this.addPutRoute("droplet-planning-plugin", "route-repeats", "route-repeats-set");
    this.addPutRoute("droplet-planning-plugin", "repeat-duration-s", "repeat-duration-s-set");
    this.addPutRoute("droplet-planning-plugin", "trail-length", "trail-length-set");
    this.addPutRoute("droplet-planning-plugin", "transition-duration-ms", "transition-duration-ms-set");
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
    this.trigger("repeat-duration-s-set", this.repeatDurationSeconds);
  }
  get routeRepeats() {
    return this._routeRepeats;
  }
  set routeRepeats(routeRepeats) {
    this._routeRepeats = routeRepeats;
    this.trigger("route-repeats-set", this.routeRepeats);
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
    this.trigger("transition-duration-ms-set", this.transitionDurationMilliseconds);
  }
  get trailLength() {
    return this._trailLength;
  }
  set trailLength(trailLength) {
    this._trailLength = trailLength;
    this.trigger("trail-length-set", this.trailLength);
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

  // ** Event Handlers **
  onRoutesUpdated(payload) {
    this.dropRoutes = payload;
    this.trigger("route-options-set", this.state);
    this.trigger("routes-set", this.dropRoutes);
  }

  onStepSwapped(payload) {
    const data = payload.stepData;
    this.stepNumber = payload.stepNumber;

    if (data.droplet_planning_plugin)
      this.updateDropletPlanningPlugin(data.droplet_planning_plugin);
  }

  onUpdateRouteOptions(payload) {
    this.updateDropletPlanningPlugin(payload);
    this.trigger("routes-set", this.dropRoutes);
  }

}

module.exports = RoutesDataController;
