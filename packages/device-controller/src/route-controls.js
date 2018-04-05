module.exports = exports = {};

const $ = require('jquery');
const _ = require('lodash');
const Backbone = require('backbone');
const sha256 = require('sha256');
const THREE = require('three');
const {MeshLine, MeshLineMaterial} = require( 'three.meshline' );

const MicropedeAsync = require('@micropede/client/src/async.js');
const {MicropedeClient, DumpStack} = require('@micropede/client/src/client.js');

const THREEx = {}; require('threex-domevents')(THREE, THREEx);

const Arrow = require('./arrow')(THREE);
const ElectrodeControls = require('./electrode-controls');

const FindAllNeighbours = ElectrodeControls.FindAllNeighbours;
const MAX_DISTANCE = ElectrodeControls.MAX_DISTANCE;

const APPNAME = 'microdrop';

const DEFAULT_HOST = 'localhost';

let mouseDown = false;

const RouteSchema = {
  type: "object",
  properties: {
    start: {set_with: "selected-routes", type: "string"},
    path:  {set_with: "selected-routes", type: "array"},
    trailLength: {set_with: "selected-routes", type: "integer", minimum: 1, default: 1},
    repeatDurationSeconds: {set_with: "selected-routes", type: "number", minium: 0, default: 1},
    transitionDurationMilliseconds: {set_with: "selected-routes", type: "integer", minimum: 100, default: 1000},
    routeRepeats: {set_with: "selected-routes", type: "integer", minimum: 1, default: 1}
  },
  required: ['start', 'path']
}

const RouteControlSchema = {
  type: "object",
  properties: {
    "selected-routes": {
      type: "array",
      default: [],
      "items": RouteSchema,
    }
  },
};

class RouteControls extends MicropedeClient {
  constructor(scene, camera, electrodeControls, port=undefined) {
    let options = {resubscribe: false};
    if (window) options.storageUrl = window.location.origin;
    super(APPNAME, DEFAULT_HOST, port, undefined, undefined, options);

    if (window) {
      // Listen for mouse down only on electrodes:
      electrodeControls.on("mousedown", async (e) => {
        mouseDown = true;
        this.drawRoute(e);
      });

      // Listen for mouseup anywhere on the page window:
      window.addEventListener("mouseup", (e) => {
        mouseDown = false;
        this.trigger("mouseup", e);
      });

    };

    electrodeControls.on("mouseover", (e) => this.trigger("mouseover", e));
    this.electrodeControls = electrodeControls;
    this.lines = {};
    this.scene = scene;
    this.model = new Backbone.Model({routes: []});
    this.model.on("change:routes", this.renderRoutes.bind(this));
    this.port = port;
    this.selectedRoutes = [];
    this.schema = RouteControlSchema;
  }

  async putSelectedRoutes(payload, params) {
    const LABEL = "RouteControls::putSelectedRoutes";
    try {
      // Get prev routes:
      let routes = await this.getState('routes', 'routes-model');
      const updatedRoutes = payload['selected-routes'];

      // Update prev routes based on changes:
      _.each(updatedRoutes, (r) => {
        let route = _.find(routes, {uuid: r.uuid});
        _.extend(route, r);
      });

      // Call put request to routes-model:
      const microdrop = new MicropedeAsync('microdrop', undefined, this.port);
      await microdrop.putPlugin('routes-model', 'routes', routes);

      return this.notifySender(payload, 'updated', 'selected-routes');
    } catch (e) {
      return this.notifySender(payload, DumpStack(LABEL, e),
        'selected-routes', 'failed');
    }
  }

  listen() {
    this.onStateMsg("routes-model", "routes", this.renderRoutes.bind(this));
    this.bindPutMsg("routes-model", "route", "put-route");
    this.onPutMsg("selected-routes", this.putSelectedRoutes.bind(this));
  }

  get routes() {
    return _.cloneDeep(this.model.get("routes"));
  }
  async renderRoutes(routes) {
    const LABEL = "<RouteControls::renderRoutes>";

    let selectedRoutes = await this.getState('selected-routes');
    
    // Remove selected routes if now longer presetn
    if (_.intersection(_.map(routes, 'uuid'), _.map(selectedRoutes, 'uuid')).length <= 0){
      await this.setState('selected-routes', []);
    }

    const group = this.electrodeControls.svgGroup;
    const microdrop = new MicropedeAsync(APPNAME, DEFAULT_HOST, this.port);
    const electrodes = (await microdrop.triggerPlugin('device-model',
      'electrodes-from-routes', {routes}, 1002)).response;

    const removeLine = (line) => {
      if (line.arrow) this.scene.remove(line.arrow);
      this.scene.remove(line);
      delete this.lines[line.uuid];
    }

    // Reset all lines to not visited
    _.each(this.lines, (l)=>{l.visited = false});

    // Iterate through all routes
    for (const [i, sequence] of electrodes.entries()) {
      const uuid = sequence.uuid;
      const ids = sequence.ids;

      // Generate a hash based on the electrode ids;
      const hash = sha256(JSON.stringify(ids));

      // If line already exists for route,
      if (this.lines[uuid]) {
        // check if its path has changed (via a change in the id hash)
        if (this.lines.hash == hash) {
          this.lines[uuid].visited = true;
          continue;
        } else {
          removeLine(this.lines[uuid]);
        }
      }

      // Otherwise get the electrodeIds from the route, and draw a new line
      const line = GenerateLinesFromIds(ids, group);
      this.scene.add(line);
      line.arrow = Arrow(ids, group);
      this.scene.add( line.arrow );

      line.visited = true;
      line.uuid = uuid;
      line.hash = hash;
      this.lines[uuid] = line;
    }

    // Remove all lines not visited from scene (as they must have been removed)
    for (const [uuid, line] of Object.entries(this.lines)){
      if (line.visited == true) continue;
      removeLine(line);
    }

  }

  addRoute(localRoute) {
    const route = _.cloneDeep(localRoute);
    if (RouteIsValid(localRoute, this.electrodeControls)) {
      const routes = _.clone(this.model.get("routes"));
      routes.push(localRoute);
      this.model.set("routes", routes);
    }
  }
  createLocalRoute(path, maxDistance=MAX_DISTANCE) {
    const localRoute = new Object();
    localRoute.start = path[0];
    localRoute.path = [];
    for (var i=0;i<path.length;i++){
      if (i == 0) continue;
      const prev = path[i-1];
      const next = path[i];
      const neighbours = FindAllNeighbours(this.electrodeControls.svgGroup, prev, maxDistance);
      if (_.invert(neighbours)[next]) {
        localRoute.path.push(_.invert(neighbours)[next]);
      } else {
        // Path is invalid
        return undefined;
      }
    }
    return localRoute;
  }
  async selectRoute(id) {
    const lineWidth = 0.3;
    const microdrop = new MicropedeAsync(APPNAME, DEFAULT_HOST, this.port);
    let routes = await this.getState('routes', 'routes-model');
    const absoluteRoutes = (await microdrop.triggerPlugin('device-model',
        'electrodes-from-routes', {routes})).response;

    const colorSelectedRoutes = (str, routes) => {
      routes = routes || this.selectedRoutes;
      const color = new THREE.Color(str);
      for (const [i, route] of routes.entries()){
        if (this.lines[route.uuid]) {
          this.lines[route.uuid].material = new MeshLineMaterial({color, lineWidth});
        } else {
          console.error('route with id:', route.uuid, 'no longer exists');
        }
      }
    }

    colorSelectedRoutes("rgb(99, 246, 255)");
    this.selectedRoutes = [];

    // Check which routes contain the id selected
    for (const [i, electrodes] of absoluteRoutes.entries()){
      const selected = _.includes(electrodes.ids, id);
      const uuid = electrodes.uuid;
      if (selected)
        this.selectedRoutes.push(_.find(routes, {uuid}));
    }

    if (this.selectedRoutes.length < 1) return;

    // Turn selected routes yellow
    colorSelectedRoutes("yellow");

    // Write selected routes to microdrop state
    await microdrop.triggerPlugin('step-ui-plugin', 'change-schema', {name: 'route-controls'});
    await this.setState('selected-routes', this.selectedRoutes);

    // Listen for context menu action
    const clearCallback = (e) => {
      const uuids = _.map(this.selectedRoutes, 'uuid');
      routes = _.filter(routes, (r) => !_.includes(uuids, r.uuid));
      const microdrop = new MicropedeAsync(APPNAME, DEFAULT_HOST, this.port);
      microdrop.putPlugin('routes-model', 'routes', routes);
      this.off("clear-route");
      this.off("execute-route");
    }

    const execCallback = (e) => {
      const microdrop = new MicropedeAsync(APPNAME, DEFAULT_HOST, this.port);
      if (this.selectedRoutes.length <= 0 ) return;
      switch (e.key) {
        case "executeRoute":
          microdrop.triggerPlugin('routes-model', 'execute',
            {routes: this.selectedRoutes}, -1);
          break;
        case "executeRoutes":
          microdrop.triggerPlugin('routes-model', 'execute',
            {routes: this.selectedRoutes}, -1);
          break;
      }
      this.off("clear-route");
      this.off("execute-route");
    }

    this.on("clear-route", clearCallback.bind(this));
    this.on("execute-route", execCallback.bind(this));

    // Wait for another click before returning to original color
    const mousedown = () => {
      return new Promise((resolve, reject) => {
        let listener;
        listener = (e) => {
          // remove listener once mouse down (i.e. listen once), then resolve
          document.removeEventListener("mousedown", listener);
          resolve(e);
        };
        document.addEventListener("mousedown", listener);
      });
    };

    const e = await mousedown();
    // colorSelectedRoutes("rgb(99, 246, 255)");
    // XXX: Find a better way to identify if should execute...
    if (e.target.innerText == 'Execute Route') return;
    if (e.target.innerText == 'Clear Route') return;
  }

  async drawRoute(e) {
    if (this.electrodeControls.enabled == false) return;
    if (e.origDomEvent.button == 2) {
      this.selectRoute(e.target.name);
      return;
    }

    /* Draw a route starting with electrode that triggered this event*/
    const lines = [];
    const path = [];
    const routes = _.clone(this.model.get("routes"));
    const group = this.electrodeControls.svgGroup;
    const scene = this.scene;
    let lastElectrode;

    let maxDistance;
    let microdrop = new MicropedeAsync('microdrop', undefined, this.port);
    try {
      maxDistance = await this.getState('max-distance', 'device-model');
    } catch (e) {
      maxDistance = MAX_DISTANCE;
    }

    // Add start electrode
    if (!mouseDown) return;
    lastElectrode = e.target.name;
    path.push(e.target.name);
    var line = AddToPath(e.target.name, path, group, maxDistance);

    const drawHandler = _.extend({}, Backbone.Events);

    const mouseup = () => {
      return new Promise((resolve, reject) => {
        drawHandler.listenTo(this, "mouseup", (e) => {
          resolve(e);
        });
      });
    };

    // Add all electrodes that are hovered over
    const mouseover = drawHandler.listenTo(this.electrodeControls, "mouseover", (e) => {
      if (!mouseDown) {
        this.trigger("mouseup");
        return;
      }
      lastElectrode = e.target.name;
      var line = AddToPath(e.target.name, path, group, maxDistance);
      if (line) {lines.push(line); scene.add(line);}
    });

    // Stop here until mouse is up:
    e = await mouseup();

    // Remove events
    drawHandler.stopListening();

    // Remove lines from scene
    for (const [i, line] of lines.entries()){
      if (line.arrow) this.scene.remove(line.arrow);
      this.scene.remove(line);
    }

    const localRoute = this.createLocalRoute(path, maxDistance);

    if (path.length > 1) {
      this.trigger("put-route", localRoute);
    } else {
      if (e.altKey) {
        console.log("SELECTING ROUTE!!");
        this.selectRoute(lastElectrode);
      }
    }
  }
}

const AddToPath = (name, path, group, maxDistance=MAX_DISTANCE) => {
  const prev = _.last(path);
  if (name == prev) return;
  let neighbours = [];
  // if (prev != undefined) {
  //   neighbours = FindAllNeighbours(group, prev, maxDistance);
  // }
  // if (!_.invert(neighbours)[name] && prev != undefined) return;
  if (path.length > 0) {
    // validate path before pushing:
    neighbours = FindAllNeighbours(group, prev, maxDistance);
    if (!_.invert(neighbours)[name]) return undefined;
    const line = GenerateLineFromElectrodeIds(prev, name, group);
    path.push(name);
    return line;
  }
  path.push(name);
  return undefined;
};

function GenerateLineFromElectrodeIds(id1, id2, group, resolution) {
  const color = new THREE.Color("rgb(99, 246, 255)");
  const lineWidth = 0.3;
  const material = new MeshLineMaterial({color, lineWidth, resolution});

  var geometry = new THREE.Geometry();
  for (const [i, id] of [id1, id2].entries()) {
    const obj = _.filter(group.children, {name: id})[0];
    const point = new THREE.Vector3();
    point.setFromMatrixPosition(obj.matrixWorld);
    point.z = 1;
    geometry.vertices.push(point);
  }

  const line = new MeshLine();
  line.setGeometry(geometry)
  return new THREE.Mesh(line.geometry, material);
}

function GenerateLinesFromIds(ids, group) {
  const LABEL = "<RouteControls::GenerateLinesFromIds>";

  /* Create line from list of electrodeIds */
  const color = new THREE.Color("rgb(99, 246, 255)");
  const lineWidth = 0.3;

  const material = new MeshLineMaterial({color, lineWidth});
  const geometry = new THREE.Geometry();

  const addPoint = (name) => {
    const obj = _.filter(group.children, {name})[0];
    const point = new THREE.Vector3();
    point.setFromMatrixPosition(obj.matrixWorld);
    point.z = 1;
    geometry.vertices.push(point);
  }

  for (const [i, id] of ids.entries()){
    addPoint(id);
  }

  const line = new MeshLine();
  line.setGeometry(geometry);

  return new THREE.Mesh(line.geometry, material);
}

function RouteIsValid(localRoute, electrodeControls) {
  const objects = electrodeControls.electrodeObjects;
  let prev = localRoute.start;
  for (const [i, dir] of localRoute.path.entries()){
    const neighbours = electrodeControls.getNeighbours(prev);
    const id = _.invert(neighbours)[dir];
    if (!id) return false;
    prev = id;
  }
  return true;
}
module.exports = {
  RouteControls: RouteControls,
  GenerateLineFromElectrodeIds: GenerateLineFromElectrodeIds,
  GenerateLinesFromIds: GenerateLinesFromIds,
  RouteIsValid: RouteIsValid
};
