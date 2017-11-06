const $ = require('jquery');
const _ = require('lodash');
const Two = require('two.js'); const two = new Two();
const THREE = require('three');
const THREEx = {}; require('threex-domevents')(THREE, THREEx);
const {MeshLine, MeshLineMaterial} = require( 'three.meshline' );

const DEFAULT_TIMEOUT = 5000;
const OFF_COLOR = "rgb(175, 175, 175)";
const SVG_SAMPLE_LENGTH = 30;

ReadFile = (url, timeout=DEFAULT_TIMEOUT) => {
  /* Read file from local url */
  return new Promise((resolve, reject) => {
    $.get(url).done((data) => {
        resolve(data);
    });
    setTimeout(()=> {reject(["timeout", timeout])}, timeout);
  });
}

ExtractShape = function (twojs_shape) {
   var shape = new THREE.Shape();

   for (var i = 0; i < twojs_shape.vertices.length; i++) {
     var vert = twojs_shape.vertices[i];
     var prev = twojs_shape.vertices[i - 1];

     const command = vert._command;
     if (command == Two.Commands.move)  shape.moveTo(vert.x, vert.y);
     if (command == Two.Commands.line)  shape.lineTo(vert.x, vert.y);
     if (command == Two.Commands.close) shape.closePath();
     if (command == Two.Commands.curve) {
       shape.bezierCurveTo(
       prev.controls.right.x + prev.x,
       prev.controls.right.y + prev.y,
       vert.controls.left.x + vert.x,
       vert.controls.left.y + vert.y, vert.x, vert.y
       );
     }
   }
   shape.closePath();
   return shape;
}

module.exports = async (url='default.svg', scene, camera,
  renderer, controller) => {
  // Read svg file
  const file = await ReadFile(url);
  const domEvents = new THREEx.DomEvents(camera, renderer.domElement);

  // Compute shape objects from SVG
  const paths = $(file).find('path');
  const shapes2D = _.map(paths, (p) => two.interpret(p));
  const shapes3D = _.map(shapes2D, (s) => ExtractShape(s));

  // Generate ThreeJS Mesh Objects from Shapes
  const svgGroup = new THREE.Group();

  const documentSize = document.body.getBoundingClientRect();
  const resolution = new THREE.Vector2(documentSize.width, documentSize.height);
  for (var i=0; i<shapes3D.length; i++) {
    const shape3D = shapes3D[i];
    const shape2D = shapes2D[i];

    // Generate outline
    var points = shape3D.createPointsGeometry();
    // var points = new THREE.Geometry().setFromPoints(shape3D.extractPoints().shape);
    points.autoClose = true;
    var options = {color: new THREE.Color("black"), lineWidth: 0.2, resolution: resolution}
    var material = new MeshLineMaterial(options);
    var meshLine = new MeshLine();
    meshLine.setGeometry(points);
    var outline = new THREE.Mesh(meshLine.geometry, material);
    outline.name = shape2D.id;
    outline.position.z += 0.1;
    outline.autoClose = true;

    // Generate fill (slightly extruded to allow for collisions)
    var options = {color: OFF_COLOR, transparent: true, opacity: 0.4,
      wireframe: false, side: THREE.DoubleSide};
    var meshMaterial = new THREE.MeshBasicMaterial(options);
    var options = { bevelEnabled: false, amount: 0.0001};
    var geometry = new THREE.ExtrudeGeometry(shape3D, options);
    var fill = new THREE.Mesh(geometry, meshMaterial);
    fill.name = shape2D.id;

    // Encapsulate the outline and fill into a group
    var group = new THREE.Group();
    shape3D.autoClose = true;
    group.add(fill);
    group.add(outline);
    group.position.x += shape2D.translation.x;
    group.position.y += shape2D.translation.y;
    group.name = shape2D.id;
    group.shape2D = shape2D;
    group.fill = fill;
    group.outline = outline;

    const addListener = (name) => {
      domEvents.addEventListener(fill, name, (e) => {
        controller.trigger(name, e)
      }, false);
    };

    // Add listeners
    addListener('click');
    addListener('mousedown');
    addListener('mouseup');
    addListener('mouseover');
    addListener('mouseout');

    // Add to SVG group
    svgGroup.add(group);
  }
  scene.add(svgGroup);

  // Compute total width and height of grouped SVG objects and center
  const helper = new THREE.BoundingBoxHelper(svgGroup, 0xff0000);
  helper.update();
  helper.geometry.computeBoundingBox();
  const bbox = helper.geometry.boundingBox;
  var wo = bbox.max.x - bbox.min.x;
  var ho = bbox.max.y - bbox.min.y;
  svgGroup.position.x -= wo/2;
  svgGroup.position.y -= ho/2;

  // Adjust camera such that its field of view spans entire mesh
  let z;
  var bodySize = document.body.getBoundingClientRect();
  var fovRadians = THREE.Math.degToRad( camera.fov );
  var r = (1/(2*Math.tan(fovRadians/2)));
  if (bodySize.height <  bodySize.width) z = ho * r;
  if (bodySize.height >= bodySize.width) z = (wo/camera.aspect) * r;
  camera.position.z = z;

  // Update electrode objects property
  var keys = _.map(svgGroup.children, "name");
  return  {objects: _.zipObject(keys, svgGroup.children), container: svgGroup};
}
