const $ = require('jquery');
const _ = require('lodash');
const _fp = require('lodash/fp');
const Key = require('keyboard-shortcut');
const THREE = require('THREE');

const THREEx = {}
require('threex-domevents')(THREE, THREEx);

const ThreeHelpers = require('three-helpers.svg-paths-group')(THREE);
const PlaneTransform = require('../lib/three.planetransform/three.planetransform')(THREE);
const MouseEventHandler = require('three-helpers.mouse-event-handler')(THREE);

window.THREEx = THREEx;

function GetBoundingBox(object) {
  const bbox = new THREE.Box3().setFromObject(object);
  const width  = bbox.max.x - bbox.min.x;
  const height = bbox.max.y - bbox.min.y;

  const origin = new THREE.Vector3();
  origin.setFromMatrixPosition( object.matrixWorld );

  const left = origin.x;
  const right = origin.x + width;
  const bottom = origin.y;
  const top = origin.y + height;

  return {left, right, bottom, top, width, height};
}

function GetSize(object) {
  const bbox = GetBoundingBox(object);
  return [bbox.width, bbox.height];
}

class VideoControls {
  constructor(scene, camera, renderer, updateFcts, svgGroup) {
    const [width, height] = GetSize(svgGroup);

    const bbox = GetBoundingBox(svgGroup);
    this.anchors = new Anchors(bbox);
    // scene.add(this.anchors.group);

    var plane = new PlaneTransform(scene, camera, renderer, {width, height});
    updateFcts.push(function(delta, now){
      plane.update(delta, now);
    });
    this.plane = plane;
    this.svgGroup = svgGroup;
    this.scene = scene;
    // this.anchors = null;
    this.canvas = renderer.domElement;
    this.camera = camera;
  }

  adjustVideoAnchors() {
      if (this.display_anchors) return;
      const domEvents = new THREEx.DomEvents(this.camera, this.canvas);

      var anchors;

      if (!this.anchors) {
          const bbox = GetBoundingBox(this.svgGroup);
          anchors = new Anchors(bbox);
          // Add anchor meshes to device view scene.
      } else {
          anchors = this.anchors;
      }
      this.scene.add(anchors.group);

      // Position anchor meshes above video and electrodes.
      anchors.group.position.z = 1;

      for (const [i, anchor] of anchors.shapes.entries()) {
          domEvents.addEventListener(anchor, 'mousedown', (e) => {
            _fp.map(_.partialRight(_.set, "material.opacity", 0.4))(anchors.group.children);
          }, false);
          domEvents.addEventListener(anchor, 'mouseup', (e) => {
            _fp.map(_.partialRight(_.set, "material.opacity", 0.8))(anchors.group.children);
          }, false);
          domEvents.addEventListener(anchor, 'mousemove', (e) => {
            const mesh = e.target;
            const buttons = e.origDomEvent.buttons;
            const intersect = e.intersect;
            if (buttons == 1) {
                mesh.position.x = intersect.point.x;
                mesh.position.y = intersect.point.y;
                this.plane.set_anchors(anchors.positions);
            }
          }, false);
      }

      document.addEventListener('keydown', (event) => {
        if (event.key != "Shift") return;
        for (const [i, anchor] of anchors.shapes.entries())
          anchor.material.color.setHex("0x00ff00");
        this.plane.updatePos = true;
      }, false);

      document.addEventListener('keyup', (event) => {
        console.log(event.key);
        if (event.key != "Shift") return;
        for (const [i, anchor] of anchors.shapes.entries())
          anchor.material.color.setHex("0xff0000");
        this.plane.updatePos = false;
      }, false);

      // Style the anchors (e.g., opacity, color).
      _fp.map(_.partialRight(_.set, "material.opacity", 1))(anchors.group.children);
      _fp.map((mesh) => mesh.material.color.setHex("0xff0000"))(anchors.group.children);
      // Set name attribute of anchor meshes.
      _.forEach(anchors.shapes, (mesh, name) => { mesh.name = name; })

      this.anchors = anchors;
      return anchors;
  }

  destroyVideoAnchors() {
      if (!this.display_anchors) return;
      this.scene.remove(this.anchors.group);
  }

  get display_anchors() { return this._display_anchors || false; }
  set display_anchors(value) {
    console.log("dispalying anchors", value);
    if (value) { this.adjustVideoAnchors(); }
    else { this.destroyVideoAnchors(); }
    this._display_anchors = value;
  }

}

class Anchors {
    constructor(bounding_box) {
        this.bounding_box = bounding_box;

        const transparent = true;
        const color = "red";
        const radius = .05 * bounding_box.width;

        const material = new THREE.MeshBasicMaterial({color, transparent});

        var corners = this.default_positions;
        this.centers = _fp.pipe(_fp.map(_fp.zipObject(["x", "y"])),
                                        _fp.values)(corners);

        this.shapes = [];
        for (const [i, pos] of this.centers.entries()) {
          const geometry = new THREE.PlaneGeometry(radius, radius, 30);

          const shape = new THREE.Mesh(geometry, material);
          shape.position.x = pos.x;
          shape.position.y = pos.y;
          shape.scale.x *= 2;
          shape.scale.y *= 2;

          this.shapes.push(shape);
        }

        this.group = new THREE.Group();
        this.group.name = "anchors";
        _fp.forEach((v) => this.group.add(v))(this.shapes);
    }

    get default_positions() {
        // Define center position for control points as the corners of the
        // bounding box.
        var bbox = this.bounding_box;
        return [[bbox.left, bbox.bottom],
                [bbox.right, bbox.bottom],
                [bbox.left, bbox.top],
                [bbox.right, bbox.top]];
    }

    mouseEventHandler(canvas_element, camera) {
        var args = {element: canvas_element,
                    shapes: this.shapes,
                    camera: camera};
        // Create event manager to translate mouse movement and presses
        // high-level shape events.
        return new MouseEventHandler(args);
    }

    get positions() {
        return _fp.map(_fp.pipe(_fp.at(["position.x", "position.y"]),
                                _fp.zipObject(["x", "y"])))(this.shapes);
    }

    set positions(positions) {
        _.forEach(positions, (p, i) => {
            this.shapes[i].position.x = p[0];
            this.shapes[i].position.y = p[1];
        });
    }
}
module.exports = VideoControls;
