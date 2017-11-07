require('style-loader!css-loader!jquery-contextmenu/dist/jquery.contextMenu.css');

const $ = require('jquery'); require('jquery-contextmenu');
const _ = require('lodash');
const Backbone = require('backbone');
const Dat = require('dat.gui/build/dat.gui');
const THREE = require('three');
const OrbitControls = require('three-orbit-controls')(THREE);

const ElectrodeControls = require('./electrode-controls');
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
  cameraControls.enablePan = true;
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


function createContextMenu() {
  $.contextMenu({
      selector: 'body',
      callback: function(key, options) {
          var m = "clicked: " + key;
          window.console && console.log(m) || alert(m);
      },
      items: {
          clearElectrodes: {name: "Clear Electrodes"},
          "sep1": "---------",
          clearRoute: {name: "Clear Route"},
          executeRoute: {name: "Execute Route"},
          "sep2": "---------",
          clearRoutes: {name: "Clear Routes"},
          executeRoutes: {name: "Execute Routes"}
      }
  });
}

function createDatGUI(container=null, menu={}) {
  if (!container) container = document.body;
  const gui = new Dat.GUI({autoPlace: false});
  gui.add(menu.cameraControls || cameraControls, 'enableRotate');
  gui.add(menu.videoControls || videoControls, "display_anchors");
  gui.domElement.style.position = "absolute";
  gui.domElement.style.top = "0px";
  gui.domElement.style.right = "0px";
  container.appendChild(gui.domElement);
}

init = async (container=null) => {
  if (!container) container = document.body;
  var controls = await createScene(container);
  // createContextMenu();
  createDatGUI(container, controls);

  window.$ = $;
  window._ = _;
  window.THREE = THREE;

  window.camera = camera;
  window.renderer = renderer;
  window.electrodeControls = electrodeControls;
  window.cameraControls = cameraControls;
  window.routeControls = routeControls;
  window.scene = scene;
  window.GenerateRoute = GenerateRoute;
  window.videoControls = videoControls;
}

module.exports = {
  init, createScene, createDatGUI, createContextMenu,
  ElectrodeControls, RouteControls, GenerateRoute, VideoControls, SVGRenderer
};
