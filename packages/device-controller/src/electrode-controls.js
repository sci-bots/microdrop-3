const $ = require('jquery');
const _ = require('lodash');
const Backbone = require('backbone');
const Key = require('keyboard-shortcut');
const THREE = require('three');
const {MeshLine, MeshLineMaterial} = require( 'three.meshline' );

const MicrodropAsync = require('@microdrop/async/MicrodropAsync');

const SVGRenderer = require('./svg-renderer');

const DEFAULT_TIMEOUT = 5000;
const DIRECTIONS = {LEFT: "left", UP: "up", DOWN: "down", RIGHT: "right"};
const MAX_DISTANCE = 0.5;
const NEIGHBOUR_COLOR = "rgb(219, 215, 215)";
const OFF_COLOR = "rgb(175, 175, 175)";
const ON_COLOR = "rgb(245, 235, 164)";
const SELECTED_COLOR = "rgb(120, 255, 168)";

const microdrop = new MicrodropAsync();

class ElectrodeControls extends MicrodropAsync.MqttClient {
  constructor(scene, camera, renderer, container=null) {
    super();
    if (!container) container = document.body;

    this.selectedElectrode = null;
    this.svgGroup = null;
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.container = container;

    Key("left", () => this.move(DIRECTIONS.LEFT));
    Key("right", () => this.move(DIRECTIONS.RIGHT));
    Key("up", () => this.move(DIRECTIONS.UP));
    Key("down", () => this.move(DIRECTIONS.DOWN));

    this.on("mousedown", this.mousedown.bind(this));
  }

  listen() {
    this.onStateMsg("electrodes-model", "active-electrodes", this.drawElectrodes.bind(this));
  }

  drawElectrodes(elec) {
    const objects = this.svgGroup.children;
    const onColor  = new THREE.Color(ON_COLOR);
    const offColor = new THREE.Color(OFF_COLOR);

    // Change previously on electrodes to off color
    const prevOn  = _.filter(objects, ["fill.material.color", onColor]);
    for (const [i, obj] of prevOn.entries()) {
      obj.fill.material.color = offColor;
    }

    // Change currently on electrodes to on color
    const currOn = _.filter(objects, (e)=>{return _.includes(elec, e.name)});
    for (const [i, obj] of currOn.entries()) {
      obj.fill.material.color = onColor;
    }
  }

  async loadSvg(f='default.svg') {
    var d = await SVGRenderer.init(f, this.scene, this.camera, this.renderer, this.container, this);
    this.electrodeObjects = d.objects;
    this.svgGroup = d.container;
  }

  async turnOnElectrode(id) {
    const electrodeObject = this.electrodeObjects[id];
    electrodeObject.on = true;
    const electrodes = await microdrop.electrodes.toggleElectrode(id, true);
  }
  async turnOffElectrode(id) {
    const electrodeObject = this.electrodeObjects[id];
    electrodeObject.on = false;
    const electrodes = await microdrop.electrodes.toggleElectrode(id, false);
  }

  async move(dir='right') {
    if (!this.selectedElectrode) return;
    const id = this.selectedElectrode.name;
    const neighbours = await microdrop.device.getNeighbouringElectrodes(id);
    const neighbour = neighbours[dir];

    if (!neighbour) return;
    await this.turnOffElectrode(id);
    this.selectElectrode(neighbour);
  }

  getNeighbours(electrodeId) {
    const LABEL = "<ElectrodeControls::getNeighbours>";
    if (!this.electrodeObjects[electrodeId]) return [];

    const neighbours = {};
    for (const [k, dir] of Object.entries(DIRECTIONS)) {
      const neighbour = FindNeighbourInDirection(this.svgGroup, electrodeId, dir);
      if (neighbour) {
        neighbours[neighbour.name] = dir;
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

  unselectElectrode() {
    this.selectedElectrode.outline.material = new MeshLineMaterial({
      color: new THREE.Color("black"), lineWidth: 0.2 });
    this.selectedElectrode = null;
  }

  selectElectrode(electrodeId) {
    /* Change the electrode currently being tracked*/

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
  }

  async mousedown(event) {
    /* Called when electrode object is clicked */
    if (event.origDomEvent.button != 0) return;

    // Await for mouse up event
    const mouseUp = () => {
      return new Promise((resolve, reject) => {
        this.on("mouseup",  (e) => {resolve(e);});
        this.on("mouseover", (e) => {resolve(e);})
      });
    };
    const event2 = await mouseUp();

    // If event targets don't match, don't turn on electrode
    if (event.target.uuid != event2.target.uuid) return;

    let activeElectrodes;
    try {
      activeElectrodes = await microdrop.electrodes.activeElectrodes(500);
    } catch (e) {
      activeElectrodes = [];
    }
    const id = event.target.name;
    let isOn = _.includes(activeElectrodes, id);

    // const electrodeObject = this.electrodeObjects[event.target.name];

    // If shiftKey is down, unset selected electrode
    if (event.origDomEvent.shiftKey == true && this.selectedElectrode) {
      this.unselectElectrode();
    }

    // Toggle the state of the target electrode
    if (isOn == true) {
      this.turnOffElectrode(id);

      // If turning off selected electrode, then also unselect
      if (this.selectedElectrode){
        if (id == this.selectedElectrode.name) {
          this.unselectElectrode();
        }
      }
    } else {
      this.turnOnElectrode(id);
    }

    // If shift was pressed, select the target electrode
    if (event.origDomEvent.shiftKey == true) {
      this.selectElectrode(id);
    }
  }

}

const FindAllNeighbours = function(group, object) {
  const LABEL = "<ElectrodeControls::FindAllNeighbours>";

  /* Find neighbours in all directions */
  const neighbours = {};
  if (_.isString(object)) {object = _.filter(group.children, {name: object})[0]};
  for (const [k, dir] of Object.entries(DIRECTIONS)) {
    const n = FindNeighbourInDirection(group, object, dir);
    if (n) neighbours[dir] = n.id;
  }
  return neighbours;
}

const FindNeighbourInDirection = function(group, object, dir) {
  const LABEL = "<ElectrodeControls::FindNeighbourInDirection>";

  /* Find neighbours in a particular direction */
  // XXX: Only returning first intersect (not 100% accuracte since multiple
  // electrodes can be in contact along one edge)
  if (_.isString(object)) {object = _.filter(group.children, {name: object})[0]};

  const intersects = FindIntersectsInDirection(object, dir, group);
  const intersect = intersects[0];
  if (!intersect) return undefined;

  const neighbour = {};
  neighbour.distance = intersect.distance;
  neighbour.object = intersect.object;
  neighbour.id = intersect.object.name;
  return neighbour;
}

function FindNearestIntersectFromEdge(objName, point, direction, group) {
  const LABEL = "<ElectrodeControls::FindNearestIntersectFromEdge>";
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
  var intersects = raycaster.intersectObjects( group.children , true);
  var start = _.filter(intersects, {object: {name: objName}})[0];
  if (!start) return undefined;

  // Cast another ray from the objects edge, ignoring starting object
  raycaster.set(start.point, direction);
  var intersects = raycaster.intersectObjects( group.children , true);
  _.remove(intersects, {distance: 0});

  // Return object with smallest distance from start object
  const intersect = _.min(intersects, "distance");
  if (!intersect) return undefined;
  if (intersect.distance > MAX_DISTANCE) return undefined;
  return intersect;
}

function FindIntersectsInDirection(obj, dir, group ) {
  const LABEL = "<ElectrodeControls::FindIntersectsInDirection>";
  if (_.isString(obj)) {obj = _.filter(group.children, {name: object})[0]};

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

  const numSteps = 20;
  const intersects = {};

  var point = origin.clone();
  var n = obj.name;

  if (direction.y == 0) {
    point.y -= height/2;
    var step = height/numSteps;
    for (var i=0;i<numSteps;i++) {
      point.y += step;
      const intersect = FindNearestIntersectFromEdge(n, point, direction,
        group);
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
        group);
      if (!intersect) continue;
      const uuid = intersect.object.uuid;
      intersects[uuid] = intersect;
    }
  }
  return _.values(intersects);
}

module.exports = {ElectrodeControls, FindAllNeighbours, FindNeighbourInDirection};
