module.exports = exports = {};

const $ = require('jquery');
const _ = require('lodash');
const Backbone = require('backbone');
const THREE = require('three');
const {MeshLine, MeshLineMaterial} = require( 'three.meshline' );

function GenerateLineFromElectrodeIds(id1, id2, objects) {
  const color = new THREE.Color("rgb(190, 97, 91)");
  const lineWidth = 0.2;
  const bbox = document.body.getBoundingClientRect();
  const resolution = new THREE.Vector2( bbox.width, bbox.height );

  const material = new MeshLineMaterial({color, lineWidth, resolution});

  var geometry = new THREE.Geometry();
  for (const [i, id] of [id1, id2].entries()) {
    const obj = objects[id];
    const point = new THREE.Vector3();
    point.setFromMatrixPosition(obj.matrixWorld);
    point.z = 1;
    geometry.vertices.push(point);
  }

  const line = new MeshLine();
  line.setGeometry(geometry)
  return new THREE.Mesh(line.geometry, material);
}

function GenerateRoute(localRoute, electrodeControls) {
  /* Create line from list of electrodeIds */
  const color = new THREE.Color("rgb(194, 12, 0)");
  const lineWidth = 0.2;

  const material = new MeshLineMaterial({color, lineWidth});
  const geometry = new THREE.Geometry();
  const objects = electrodeControls.electrodeObjects;

  const addPoint = (id) => {
    const obj = objects[id];
    const point = new THREE.Vector3();
    point.setFromMatrixPosition(obj.matrixWorld);
    point.z = 1;
    geometry.vertices.push(point);
  }

  let prev = localRoute.start;

  addPoint(localRoute.start);
  for (const [i, dir] of localRoute.path.entries()){
    const neighbours = this.electrodeControls.getNeighbours(prev);
    const id = _.invert(neighbours)[dir];
    addPoint(id);
    prev = id;
  }

  const line = new MeshLine();
  line.setGeometry(geometry)
  return new THREE.Mesh(line.geometry, material);
}

function RouteIsValid(localRoute, electrodeControls) {
  const objects = electrodeControls.electrodeObjects;
  let prev = localRoute.start;
  for (const [i, dir] of localRoute.path.entries()){
    const neighbours = this.electrodeControls.getNeighbours(prev);
    const id = _.invert(neighbours)[dir];
    if (!id) return false;
    prev = id;
  }
  return true;
}

class RouteControls {
  constructor(scene, camera, electrodeControls) {
    _.extend(this, Backbone.Events);
    electrodeControls.on("mousedown", this.drawRoute.bind(this));
    electrodeControls.on("mouseup", (e) => this.trigger("mouseup", e));
    electrodeControls.on("mouseover", (e) => this.trigger("mouseover", e));
    this.electrodeControls = electrodeControls;
    this._lines = null;
    this._scene = scene;
    this.model = new Backbone.Model({routes: []});
    this.model.on("change:routes", this.renderRoutes.bind(this));
  }
  get routes() {
    return _.cloneDeep(this.model.get("routes"));
  }
  renderRoutes() {
    const routes = this.model.get("routes");
    // Remove previous lines (TODO: Maybe only render new lines?)
    if (this._lines) {
      this._scene.remove(this._lines);
      this._lines = null;
    }
    // Create ThreeJS object containing all the routes
    this._lines = new THREE.Group();
    for (const [i, route] of routes.entries()){
      const line = GenerateRoute(route, this.electrodeControls);
      this._lines.add(line);
    }
    // Add to scene
    this._scene.add(this._lines);
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
      const neighbours = this.electrodeControls.getNeighbours(prev);
      if (neighbours[next]) {
        localRoute.path.push(neighbours[next]);
      } else {
        // Path is invalid
        return undefined;
      }
    }
    return localRoute;
  }
  async drawRoute(e) {
    /* Draw a route starting with electrode that triggered this event*/
    const lines = [];
    const path = [];
    const routes = _.clone(this.model.get("routes"));
    const objects = this.electrodeControls.electrodeObjects;

    const add = (name) => {
      const prev = _.last(path);
      if (name == prev) return;
      const neighbours = this.electrodeControls.getNeighbours(prev);
      if (!neighbours[name] && prev != undefined) return;

      if (path.length > 0) {
        const line = GenerateLineFromElectrodeIds(prev, name, objects);
        lines.push(line);
        this._scene.add(line);
      }
      path.push(name);
    };

    // Add start electrode
    add(e.target.name);

    // Add all electrodes that are hovered over
    const mouseover = this.on("mouseover", (e) => {
      add(e.target.name);
    });

    // Add last electrode
    const mouseup = () => {
      return new Promise((resolve, reject) => {
        this.on("mouseup", (e) => {resolve(e);});
      });
    };
    e = await mouseup();
    add(e.target.name);

    // Remove events
    this.off("mouseup");
    this.off("mouseover");

    // Remove lines from scene
    for (const [i, line] of lines.entries()){
      this._scene.remove(line);
    }

    const localRoute = this.createLocalRoute(path);

    if (path.length > 1) {routes.push(localRoute);}
    this.model.set("routes", routes);
  }
}

module.exports = {
  RouteControls: RouteControls,
  GenerateLineFromElectrodeIds: GenerateLineFromElectrodeIds,
  GenerateRoute: GenerateRoute,
  RouteIsValid: RouteIsValid
};
