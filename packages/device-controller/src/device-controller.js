const _ = require('lodash');
const Backbone = require('backbone');
const THREE = require('three');
const OrbitControls = require('three-orbit-controls')(THREE);

const {ElectrodeControls} = require('./electrode-controls');
const {RouteControls, GenerateRoute} = require('./route-controls');
const VideoControls = require('./video-controls');
const SVGRenderer = require('./svg-renderer');

var electrodeControls, camera, cameraControls, renderer,
  routeControls, scene, videoControls, container,
  lastTimeMsec, updateFcts;

function animate(nowMsec) {
  requestAnimationFrame( animate.bind(this) );
  lastTimeMsec	= lastTimeMsec || nowMsec - 1000/60;
  var deltaMsec	= Math.min(200, nowMsec - lastTimeMsec);
  lastTimeMsec	= nowMsec;

  updateFcts.forEach(function(updateFn){
    updateFn(deltaMsec/1000, nowMsec/1000);
  });

  renderer.render( scene, camera );
}

function initCameraControls() {
  cameraControls = new OrbitControls(camera, container);
  cameraControls.enableKeys = false;
  cameraControls.enableRotate = false;
  cameraControls.enablePan = false;
  _.extend(cameraControls, Backbone.Events);
}

function initRenderer() {
  var bbox = container.getBoundingClientRect();
  var aspect = bbox.width / bbox.height;

  renderer = new THREE.WebGLRenderer( { antialias: true} );
  container.appendChild( renderer.domElement );
  renderer.setSize( bbox.width, bbox.height );
  if (window) renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor( "rgb(55, 55, 55)", 1 );
}

const createScene = async (_container=null) => {
  container = _container;
  if (!container) container = document.body;
  var bbox = container.getBoundingClientRect();
  var aspect = bbox.width / bbox.height;

  updateFcts = [];

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera( 75, aspect, 0.1, 1000 );
  camera.position.z = 100;

  initCameraControls();
  initRenderer();

  electrodeControls = new ElectrodeControls(scene, camera, renderer, container);
  await electrodeControls.loadSvg('default.svg');
  routeControls = new RouteControls(scene, camera, electrodeControls, container);
  videoControls = new VideoControls(scene, camera, renderer, updateFcts, electrodeControls.svgGroup);
  cameraControls.on("updateRequest", updateRequest.bind(this));
  animate();

  return {cameraControls, electrodeControls, routeControls, videoControls};
}

function updateRequest() {
  var bbox = container.getBoundingClientRect();
  var aspect = bbox.width / bbox.height;

  // notify the renderer of the size change
  renderer.setSize(bbox.width, bbox.height)

  // update the camera
  camera.aspect	= aspect;
  camera.updateProjectionMatrix()
}

module.exports = {
  createScene,
  ElectrodeControls, RouteControls, GenerateRoute, VideoControls, SVGRenderer
};
