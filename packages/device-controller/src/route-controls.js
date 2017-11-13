module.exports = exports = {};

const $ = require('jquery');
const _ = require('lodash');
const Backbone = require('backbone');
const THREE = require('three');
const {MeshLine, MeshLineMaterial} = require( 'three.meshline' );

const MicrodropAsync = require('@microdrop/async/MicrodropAsync');
const THREEx = {}; require('threex-domevents')(THREE, THREEx);

const {FindAllNeighbours} = require('./electrode-controls');

class RouteControls extends MicrodropAsync.MqttClient {
  constructor(scene, camera, electrodeControls) {
    super();
    electrodeControls.on("mousedown", this.drawRoute.bind(this));
    electrodeControls.on("mouseup", (e) => this.trigger("mouseup", e));
    electrodeControls.on("mouseover", (e) => this.trigger("mouseover", e));
    this.electrodeControls = electrodeControls;
    this.lines = {};
    this.scene = scene;
    this.model = new Backbone.Model({routes: []});
    this.model.on("change:routes", this.renderRoutes.bind(this));
  }
  listen() {
    this.onStateMsg("routes-model", "routes", this.renderRoutes.bind(this));
    this.bindPutMsg("routes-model", "route", "put-route");
  }
  get routes() {
    return _.cloneDeep(this.model.get("routes"));
  }
  async renderRoutes(routes) {
    const LABEL = "<RouteControls::renderRoutes>";

    const microdrop = new MicrodropAsync();
    const group = this.electrodeControls.svgGroup;
    const absoluteRoutes =  await microdrop.device.electrodesFromPath(routes);

    // Reset all lines to not visited
    _.each(this.lines, (l)=>{l.visited = false});

    // Iterate through all routes
    for (const [uuid, route] of Object.entries(absoluteRoutes)) {
      // If line already exists for route, visit and then continue
      if (this.lines[uuid]) {
        this.lines[uuid].visited = true;
        continue;
      };

      // Otherwise get the electrodeIds from the route, and draw a new line
      const line = GenerateLinesFromIds(absoluteRoutes[uuid], group);
      this.scene.add(line);
      line.visited = true;
      line.uuid = uuid;
      this.lines[uuid] = line;
    }

    // Remove all lines not visited from scene (as they must have been removed)
    for (const [uuid, line] of Object.entries(this.lines)){
      if (line.visited == true) continue;
      this.scene.remove(line);
      delete this.lines[uuid];
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
  createLocalRoute(path) {
    const localRoute = new Object();
    localRoute.start = path[0];
    localRoute.path = [];
    for (var i=0;i<path.length;i++){
      if (i == 0) continue;
      const prev = path[i-1];
      const next = path[i];
      const neighbours = FindAllNeighbours(this.electrodeControls.svgGroup, prev);

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
    const microdrop = new MicrodropAsync();
    const routes = await microdrop.routes.routes();
    const absoluteRoutes = await microdrop.device.electrodesFromPath(routes);

    const selectedRoutes = [];

    const colorSelectedRoutes = (str) => {
      const color = new THREE.Color(str);
      for (const [i, route] of selectedRoutes.entries()){
        this.lines[route.uuid].material = new MeshLineMaterial({color, lineWidth});
      }
    }

    // Check which routes contain the id selected
    for (const [uuid, absoluteRoute] of Object.entries(absoluteRoutes)){
      const selected = _.includes(absoluteRoute, id);
      if (selected)
        selectedRoutes.push(routes[uuid]);
    }

    // Turn selected routes yellow
    colorSelectedRoutes("yellow");

    // Listen for context menu action
    const clearCallback = (e) => {
      microdrop.routes.clear(selectedRoutes);
      this.off("clear-route");
      this.off("execute-route");
    }

    const execCallback = (e) => {
      switch (e.key) {
        case "executeRoute":
          microdrop.routes.execute(selectedRoutes);
          break;
        case "executeRoutes":
          microdrop.routes.execute(routes);
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
          document.removeEventListener("mousedown", listener); resolve(e);
        };
        document.addEventListener("mousedown", listener);
      });
    };

    e = await mousedown();

    colorSelectedRoutes("rgb(99, 246, 255)");
  }
  async drawRoute(e) {
    if (e.origDomEvent.button == 2) {this.selectRoute(e); return}

    /* Draw a route starting with electrode that triggered this event*/
    const lines = [];
    const path = [];
    const routes = _.clone(this.model.get("routes"));
    const group = this.electrodeControls.svgGroup;
    const scene = this.scene;

    // Add start electrode
    var line = AddToPath(e.target.name, path, group);

    // Add all electrodes that are hovered over
    const mouseover = this.on("mouseover", (e) => {
      var line = AddToPath(e.target.name, path, group, lines);
      if (line) {lines.push(line); scene.add(line);}
    });

    // Add last electrode
    const mouseup = () => {
      return new Promise((resolve, reject) => {
        this.on("mouseup", (e) => {resolve(e);});
      });
    };
    e = await mouseup();
    AddToPath(e.target.name, path, group, lines);

    // Remove events
    this.off("mouseup");
    this.off("mouseover");

    // Remove lines from scene
    for (const [i, line] of lines.entries()){
      this.scene.remove(line);
    }

    const localRoute = this.createLocalRoute(path);

    if (path.length > 1) {
      this.trigger("put-route", localRoute);
    }
  }
}

const AddToPath = (name, path, group) => {
  const prev = _.last(path);
  if (name == prev) return;
  let neighbours = [];
  if (prev != undefined)
    neighbours = FindAllNeighbours(group, prev);
  if (!_.invert(neighbours)[name] && prev != undefined) return;

  if (path.length > 0) {
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
  line.setGeometry(geometry)
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
