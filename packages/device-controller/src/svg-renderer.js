const $ = require('jquery');
const _ = require('lodash');
const Two = require('two.js');
const THREE = require('three');
const THREEx = {}; require('threex-domevents')(THREE, THREEx);
const {MeshLine, MeshLineMaterial} = require( 'three.meshline' );

const DEFAULT_TIMEOUT = 5000;
const OFF_COLOR = "rgb(175, 175, 175)";
const SVG_SAMPLE_LENGTH = 30;

const ParseSVGFromString = (s) => {
  const el = document.createElement('html');
  el.innerHTML = s;
  return el.getElementsByTagName('svg')[0];
}

const ReadFile = (url, timeout=DEFAULT_TIMEOUT) => {
  /* Read file from local url */
  return new Promise((resolve, reject) => {
    $.get(url).done((data) => {
        resolve(data);
    });
    setTimeout(()=> {reject(["timeout", timeout])}, timeout);
  });
}

const ExtractShape = function (twojs_shape) {
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
   shape.autoClose = true;
   return shape;
}

const ConstructScene = function(objects) {
  const scene = new THREE.Scene();
  const amount = 0.0001;
  const bevelEnabled = false;
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const uvGenerator = THREE.ExtrudeGeometry.WorldUVGenerator;

  const group = new THREE.Group();

  for (const [i,obj] of objects.entries()) {
    const shape = ShapeFromJSONObject(obj.shape);
    const geometry = new THREE.ExtrudeGeometry(shape, {bevelEnabled, amount});
    const fill = new THREE.Mesh(geometry, material);
    fill.name = obj.id;
    fill.position.x += obj.translation.x;
    fill.position.y += obj.translation.y;
    group.add(fill);
  }
  scene.add(group);
  scene.updateMatrixWorld();
  return {scene, group};
}

const ShapeFromJSONObject = function(JSONObject) {
  const s = _.extend(new THREE.Shape(), JSONObject);
  s.curves = _.map(s.curves, (c) => _.extend(new THREE.LineCurve(), c));
  for (const [i, c] of s.curves.entries()){
    c.v1 = new THREE.Vector2(c.v1.x, c.v1.y);
    c.v2 = new THREE.Vector2(c.v2.x, c.v2.y);
  }
  return s;
}

const ConstructObjectsFromURL = async function (url='/default.svg') {
  const file = await ReadFile(url);
  return ConstructObjectsFromSVG(file);
}

const ConstructObjectsFromSVG = function (file) {
  /* Construct JSON serializable geometries from svg file */
  const two = new Two();

  const paths = $(file).find('path');
  const shapes2D = _.map(paths, (p) => two.interpret(p));
  const electrodeMap = {};
  for (const [i, path] of [...paths].entries()){
    electrodeMap[path.getAttribute('id')] = path.getAttribute('data-channels');
  }
  const shapes3D = _.map(shapes2D, (s) => ExtractShape(s));
  const objects  = [];
  for (const [i, shape] of shapes3D.entries()) {
    const shape2D = shapes2D[i];
    const obj = {};
    obj.id = shape2D.id;
    obj.channel = electrodeMap[shape2D.id];
    obj.translation = {x: shape2D.translation.x, y: shape2D.translation.y};
    obj.shape = JSON.parse(JSON.stringify(shape));
    objects.push(obj);
  }
  return objects;
}

const GeneratePlaneUV = (geometry) => {
  // https://stackoverflow.com/questions/20774648/three-js-generate-uv-coordinate
  // http://paulyg.f2s.com/uv.htm

  geometry.computeBoundingBox();

  var max = geometry.boundingBox.max,
      min = geometry.boundingBox.min;
  var offset = new THREE.Vector2(0 - min.x, 0 - min.y);
  var range = new THREE.Vector2(max.x - min.x, max.y - min.y);
  var faces = geometry.faces;

  geometry.faceVertexUvs[0] = [];

  for (var j = 0; j < faces.length ; j++) {

      var v1 = geometry.vertices[faces[j].a],
          v2 = geometry.vertices[faces[j].b],
          v3 = geometry.vertices[faces[j].c];

      geometry.faceVertexUvs[0].push([
          new THREE.Vector2((v1.x + offset.x)/range.x ,(v1.y + offset.y)/range.y),
          new THREE.Vector2((v2.x + offset.x)/range.x ,(v2.y + offset.y)/range.y),
          new THREE.Vector2((v3.x + offset.x)/range.x ,(v3.y + offset.y)/range.y)
      ]);
  }

  geometry.uvsNeedUpdate = true;
  return geometry;
}

const GenerateSvgGroup = async (url='/default.svg') => {
  let objects;
  if (_.isString(url))
    objects = await ConstructObjectsFromURL(url);
  else if (_.isArray(url))
    objects = url;
  else
    objects = ConstructObjectsFromSVG(url);

  const loader = new THREE.JSONLoader();

  const svgGroup = new THREE.Group();
  for (const [i, obj] of objects.entries()) {
    var shape = ShapeFromJSONObject(obj.shape)

    // var points = new THREE.Geometry().setFromPoints(shape.extractPoints().shape);
    var points = shape.createPointsGeometry();

    // Generate outline
    points.autoClose = true;
    var options = {color: new THREE.Color("black"), lineWidth: 0.2};
    var material = new MeshLineMaterial(options);
    var meshLine = new MeshLine();
    meshLine.setGeometry(points);
    var outline = new THREE.Mesh(meshLine.geometry, material);
    outline.name = obj.id;
    outline.position.z += 0.1;
    outline.autoClose = true;

    // Generate fill (slightly extruded to allow for collisions)
    var options = {color: OFF_COLOR, transparent: true, opacity: 0.4,
      wireframe: false, side: THREE.DoubleSide};
    var meshMaterial = new THREE.MeshBasicMaterial(options);
    var collisionMaterial = new THREE.MeshBasicMaterial(_.extend(_.clone(options), {opacity: 0}));
    var options = { bevelEnabled: false, amount: 0.0001};
    var geometry = GeneratePlaneUV(new THREE.ExtrudeGeometry(shape, options))
    var fill = new THREE.Mesh(geometry, meshMaterial);
    fill.name = obj.id;

    // Encapsulate the outline and fill into a group
    var group = new THREE.Group();
    group.add(fill);
    group.add(outline);
    group.position.x += obj.translation.x;
    group.position.y += obj.translation.y;
    group.name = obj.id;
    group.fill = fill;
    group.outline = outline;
    group.geometry = fill.geometry;
    svgGroup.add(group);
  }

  return svgGroup;
}

const init = async (url='/default.svg', scene, camera, renderer, container,
  controller) => {
    const svgGroup = await GenerateSvgGroup(url);
    const domEvents = new THREEx.DomEvents(camera, renderer.domElement);
    const documentSize = container.getBoundingClientRect();
    const resolution = new THREE.Vector2(documentSize.width, documentSize.height);

    for (const [i, group] of svgGroup.children.entries()) {
      group.outline.material.resolution = resolution;

      const addListener = (name) => {
        domEvents.addEventListener(group.fill, name, (e) => {
          controller.trigger(name, e)
        }, false);
      };

      // Add listeners
      addListener('click');
      addListener('mousedown');
      addListener('mouseup');
      addListener('mouseover');
      addListener('mouseout');
    }

    // scene.add(svgGroup);

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
    var bodySize = container.getBoundingClientRect();
    var fovRadians = THREE.Math.degToRad( camera.fov );
    var r = (1/(2*Math.tan(fovRadians/2)));
    if (bodySize.height <  bodySize.width) z = ho * r;
    if (bodySize.height >= bodySize.width) z = (wo/camera.aspect) * r;
    camera.position.z = z;

    // Update electrode objects property
    var keys = _.map(svgGroup.children, "name");
    return  {objects: _.zipObject(keys, svgGroup.children), container: svgGroup};
}

module.exports = {
  ConstructScene,
  ConstructObjectsFromSVG,
  ConstructObjectsFromURL,
  GenerateSvgGroup ,
  ParseSVGFromString,
  ShapeFromJSONObject,
  init};
