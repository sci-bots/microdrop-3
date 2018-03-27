module.exports = exports = {};

const $ = require('jquery');
const _ = require('lodash');
const Backbone = require('backbone');
const sha256 = require('sha256');
const THREE = require('three');
const {MeshLine, MeshLineMaterial} = require( 'three.meshline' );

const MicropedeAsync = require('@micropede/client/src/async.js');
const {MicropedeClient} = require('@micropede/client/src/client.js');

const THREEx = {}; require('threex-domevents')(THREE, THREEx);

const Arrow = require('./arrow')(THREE);
const ElectrodeControls = require('./electrode-controls');

const FindAllNeighbours = ElectrodeControls.FindAllNeighbours;
const MAX_DISTANCE = ElectrodeControls.MAX_DISTANCE;

const APPNAME = 'microdrop';

const DEFAULT_HOST = 'localhost';

let mouseDown = 0;
class RouteControls extends MicropedeClient {
  constructor(scene, camera, electrodeControls, port=undefined) {
    super(APPNAME, DEFAULT_HOST, port);

    electrodeControls.on("mousedown", async (e) => {
      ++mouseDown;
      this.drawRoute(e);
    });

    electrodeControls.on("mouseup", (e) => {
      --mouseDown;
      this.trigger("mouseup", e);
    });

    electrodeControls.on("mouseover", (e) => this.trigger("mouseover", e));
    this.electrodeControls = electrodeControls;
    this.lines = {};
    this.scene = scene;
    this.model = new Backbone.Model({routes: []});
    this.model.on("change:routes", this.renderRoutes.bind(this));
    this.port = port;
    this.selectedRoutes = [];
  }

  listen() {
    this.onStateMsg("routes-model", "routes", this.renderRoutes.bind(this));
    this.bindPutMsg("routes-model", "route", "put-route");
    this.bindStateMsg("selected-routes", "set-selected-routes");
  }
  get routes() {
    return _.cloneDeep(this.model.get("routes"));
  }
  async renderRoutes(routes) {
    const LABEL = "<RouteControls::renderRoutes>";

    const group = this.electrodeControls.svgGroup;
    const microdrop = new MicropedeAsync(APPNAME, DEFAULT_HOST, this.port);
    const electrodes = (await microdrop.triggerPlugin('device-model',
      'electrodes-from-routes', {routes})).response;

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

    let lines = this.lines;

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
  async selectRoute(e) {
    const id = e.target.name;
    const lineWidth = 0.3;
    const microdrop = new MicropedeAsync(APPNAME, DEFAULT_HOST, this.port);
    let routes = await microdrop.getState('routes-model', 'routes', 500);
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
    this.trigger("set-selected-routes", this.selectedRoutes);

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

    e = await mousedown();
    // colorSelectedRoutes("rgb(99, 246, 255)");
    // XXX: Find a better way to identify if should execute...
    if (e.target.innerText == 'Execute Route') return;
    if (e.target.innerText == 'Clear Route') return;
  }

  async drawRoute(e) {
    if (this.electrodeControls.enabled == false) return;
    if (e.origDomEvent.button == 2) {
      this.selectRoute(e);
      return;
    }

    /* Draw a route starting with electrode that triggered this event*/
    const lines = [];
    const path = [];
    const routes = _.clone(this.model.get("routes"));
    const group = this.electrodeControls.svgGroup;
    const scene = this.scene;

    let maxDistance;
    let microdrop = new MicropedeAsync('microdrop', undefined, this.port);
    try {
      maxDistance = await microdrop.getState('device-model', 'max-distance', 300);
    } catch (e) {
      maxDistance = MAX_DISTANCE;
    }

    // Add start electrode
    if (!mouseDown) return;
    path.push(e.target.name);
    var line = AddToPath(e.target.name, path, group, maxDistance);

    const drawHandler = _.extend({}, Backbone.Events);

    const mouseup = () => {
      return new Promise((resolve, reject) => {
        drawHandler.listenTo(this.electrodeControls, "mouseup", (e) => {
          resolve(e);
        });
      });
    };

    // Add all electrodes that are hovered over
    const mouseover = drawHandler.listenTo(this.electrodeControls, "mouseover", (e) => {
      if (!mouseDown) {
        this.electrodeControls.trigger("mouseup");
        return;
      }
      var line = AddToPath(e.target.name, path, group, maxDistance);
      if (line) {lines.push(line); scene.add(line);}
    });

    // Add last electrode on mouse up
    e = await mouseup();

    // Remove events
    drawHandler.stopListening();

    AddToPath(e.target.name, path, group, maxDistance);

    // Remove lines from scene
    for (const [i, line] of lines.entries()){
      if (line.arrow) this.scene.remove(line.arrow);
      this.scene.remove(line);
    }

    const localRoute = this.createLocalRoute(path, maxDistance);

    if (path.length > 1) {
      this.trigger("put-route", localRoute);
    } else {
      if (e.origDomEvent.altKey)
        this.selectRoute(e);
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
