const $ = require('jquery');
const _ = require('lodash');
const Backbone = require('backbone');

const Key = require('keyboard-shortcut');
const Two = require('two.js'); const two = new Two();
const THREE = require('three');
const {MeshLine, MeshLineMaterial} = require( 'three.meshline' );

const RenderSVG = require('./svg-renderer');

const DEFAULT_TIMEOUT = 5000;
const DIRECTIONS = {LEFT: "left", UP: "up", DOWN: "down", RIGHT: "right"};
const MAX_DISTANCE = 0.5;
const NEIGHBOUR_COLOR = "rgb(219, 215, 215)";
const OFF_COLOR = "rgb(175, 175, 175)";
const ON_COLOR = "rgb(245, 235, 164)";
const SELECTED_COLOR = "rgb(120, 255, 168)";

function FindNearestIntersectFromEdge(objName, point, direction,
  collisionObjects) {
  /* Find neighbour of an object along an edge normal to the rays direction */
  /*  objName: name of currentObject
      point: any point inside currentObject (changes start location along edge)
      direction: direction towards edge
      collisionObjects: list of possible objects to collide with
  */

  // Cast ray in direction (to find the edge)
  const raycaster = new THREE.Raycaster();
  raycaster.set(point, direction);

  // Filter the intersections for that of the current object (from objName);
  var intersects = raycaster.intersectObjects( collisionObjects , true);

  var start = _.filter(intersects, {object: {parent: {name: objName}}})[0];
  if (!start) return undefined;

  // Cast another ray from the objects edge, ignoring starting object
  raycaster.set(start.point, direction);
  var intersects = raycaster.intersectObjects( collisionObjects , true);
  _.remove(intersects, {distance: 0});

  // Return object with smallest distance from start object
  const intersect = _.min(intersects, "distance");
  if (!intersect) return undefined;
  if (intersect.distance > MAX_DISTANCE) return undefined;
  return intersect;
}

function FindIntersectsInDirection(obj, dir, collisionObjects ) {
  /* Get all neighbouring objects around an objects axis*/
  let direction;
  if (dir == DIRECTIONS.RIGHT) direction = new THREE.Vector3(1,0,0);
  if (dir == DIRECTIONS.LEFT)  direction = new THREE.Vector3(-1,0,0);
  if (dir == DIRECTIONS.UP)    direction = new THREE.Vector3(0,1,0);
  if (dir == DIRECTIONS.DOWN)  direction = new THREE.Vector3(0,-1,0);

  // Get the origin of the selected electrode (accounting for displacement)
  const origin = new THREE.Vector3();
  origin.setFromMatrixPosition( obj.matrixWorld );

  obj.geometry.computeBoundingBox();
  const bbox   = obj.geometry.boundingBox;
  const width  = bbox.max.x - bbox.min.x;
  const height = bbox.max.y - bbox.min.y;

  const numSteps = 10;
  const intersects = {};

  var point = origin.clone();
  var n = obj.parent.name;

  if (direction.y == 0) {
    point.y -= height/2;
    var step = height/numSteps;
    for (var i=0;i<numSteps;i++) {
      point.y += step;
      const intersect = FindNearestIntersectFromEdge(n, point, direction,
        collisionObjects);
      if (!intersect) continue;
      const uuid = intersect.object.uuid;
      intersects[uuid] = intersect;
    }
  }
  else if (direction.x == 0) {
    point.x -= width/2;
    var step = width/numSteps;
    for (var i=0;i<numSteps;i++) {
      point.x += step;
      const intersect = FindNearestIntersectFromEdge(n, point, direction,
        collisionObjects);
      if (!intersect) continue;
      const uuid = intersect.object.uuid;
      intersects[uuid] = intersect;
    }
  }
  return _.values(intersects);
}

class ElectrodeControls {
  constructor(scene, camera, renderer) {
    _.extend(this, Backbone.Events);

    this.selectedElectrode = null;
    this.svgGroup = null;
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    Key("left", () => this.move(DIRECTIONS.LEFT));
    Key("right", () => this.move(DIRECTIONS.RIGHT));
    Key("up", () => this.move(DIRECTIONS.UP));
    Key("down", () => this.move(DIRECTIONS.DOWN));

    this.on("mousedown", this.mousedown.bind(this));
  }

  async loadSvg(f='default.svg') {
    var d = await RenderSVG(f, this.scene, this.camera, this.renderer, this);
    this.electrodeObjects = d.objects;
    this.svgGroup = d.container;
  }

  turnOnElectrode(id) {
    const electrodeObject = this.electrodeObjects[id];
    electrodeObject.on = true;
    electrodeObject.fill.material.color = new THREE.Color(ON_COLOR);
    electrodeObject.outline.material.color = new THREE.Color("black");
  }
  turnOffElectrode(id) {
    const electrodeObject = this.electrodeObjects[id];
    electrodeObject.on = false;
    electrodeObject.fill.material.color = new THREE.Color(OFF_COLOR);
    electrodeObject.outline.material.color = new THREE.Color("black");
  }

  move(dir='right') {
    if (!this.selectedElectrode) return;
    const electrodeId = this.selectedElectrode.name;
    const neighbour = this.findNeighbour(dir, electrodeId);
    if (!neighbour) return;
    this.turnOffElectrode(this.selectedElectrode.name);
    this.selectElectrode(neighbour.electrodeId);
  }

  getNeighbours(electrodeId) {
    if (!this.electrodeObjects[electrodeId]) return [];

    const neighbours = {};
    for (const [k, dir] of Object.entries(DIRECTIONS)) {
      const neighbour = this.findNeighbour(dir, electrodeId);
      if (neighbour) {
        neighbours[neighbour.electrodeId] = dir;
      }
    }
    return neighbours;
  }

  findNeighbour(dir='right', electrodeId) {
    /* Find neighbours of given electrode */
    let obj = this.electrodeObjects[electrodeId];
    const collisionObjects = _.map(_.values(this.electrodeObjects), "fill");

    // If the user didn't pass in an electrode, use the selectedElectrode
    if (!electrodeId && this.selectedElectrode)
      obj = this.selectedElectrode;

    const intersects = FindIntersectsInDirection(obj.fill, dir, collisionObjects);
    // Use first intersect for now:
    const intersect = intersects[0];
    if (!intersect) return undefined;

    const neighbour = new Object();
    neighbour.distance = intersect.distance;
    neighbour.electrodeObject = intersect.object.parent;
    neighbour.electrodeId = neighbour.electrodeObject.name;
    return neighbour;
  }

  _clearNeighbourColors() {
    /* Update opacity of neighbours back to 0.4 */
    const n = _.filter(this.electrodeObjects, {fill:{material:{opacity: 0.3}}});
    for (const [i, obj] of n.entries()) {
      obj.fill.material.opacity = 0.4;
    }
  }

  unselectElectrode() {
    this.selectedElectrode.outline.material = new MeshLineMaterial({
      color: new THREE.Color("black"), lineWidth: 0.2 });
    this.selectedElectrode = null;
    this._clearNeighbourColors();
  }

  selectElectrode(electrodeId) {
    /* Change the electrode currently being tracked*/

    // Reset the fill color of neighbours
    this._clearNeighbourColors();

    // Reset the outline of the previously selected electrode
    if (this.selectedElectrode) {
      this.unselectElectrode();
    }

    // Turn on and color the selected electrode
    this.turnOnElectrode(electrodeId);
    const electrodeObject = this.electrodeObjects[electrodeId];
    electrodeObject.outline.material = new MeshLineMaterial({
      color: new THREE.Color("red"), lineWidth: 0.2 });

    this.selectedElectrode = electrodeObject;

    // Change opacity of neighbour electrodes to guide user
    for (const [k, dir] of Object.entries(DIRECTIONS)) {
      const neighbour = this.findNeighbour(dir);
      if (!neighbour) continue;
      const material = neighbour.electrodeObject.fill.material;
      material.opacity = 0.3;
    }
  }

  async mousedown(event) {
    if (event.origDomEvent.button != 0) return;
    /* Called when electrode object is clicked */

    // Await for mouse up event
    const mouseUp = () => {
      return new Promise((resolve, reject) => {
        this.on("mouseup",  (e) => {resolve(e);});
        this.on("mouseover", (e) => {resolve(e);})
      });
    };
    const event2 = await mouseUp();
    // console.log("event", event, "event2", event2);

    // If event targets don't match, don't turn on electrode
    if (event.target.uuid != event2.target.uuid) return;

    const electrodeObject = this.electrodeObjects[event.target.name];

    // If shiftKey is down, unset selected electrode
    if (event.origDomEvent.shiftKey == true && this.selectedElectrode) {
      this.unselectElectrode();
    }

    // Toggle the state of the target electrode
    if (electrodeObject.on) {
      electrodeObject.on = false;
      electrodeObject.fill.material.color = new THREE.Color(OFF_COLOR);

      // If turning off selected electrode, then also unset & clear neighbours
      if (this.selectedElectrode){
        if (electrodeObject.name == this.selectedElectrode.name) {
          this.unselectElectrode();
        }
      }
    } else {
      electrodeObject.on = true;
      electrodeObject.fill.material.color = new THREE.Color(ON_COLOR);
    }

    // If shift was pressed, select the target electrode
    if (event.origDomEvent.shiftKey == true) {
      this.selectElectrode(electrodeObject.name);
    }
  }

}

module.exports = ElectrodeControls;
