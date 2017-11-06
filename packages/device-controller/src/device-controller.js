require('style-loader!css-loader!jquery-contextmenu/dist/jquery.contextMenu.css');

const $ = require('jquery'); require('jquery-contextmenu');
const _ = require('lodash');
const Dat = require('dat.gui/build/dat.gui');
const THREE = require('three');
const OrbitControls = require('three-orbit-controls')(THREE);

const ElectrodeControls = require('./electrode-controls');
const {RouteControls, GenerateRoute} = require('./route-controls');
const VideoControls = require('./video-controls');

var electrodeControls, electrodeObjects, camera, cameraControls, renderer,
  routeControls, scene, videoControls;

const createScene = async (container=null) => {
  if (!container) container = document.body;
  const updateFcts = [];

  // Create ThreeJS scene
  const bbox = container.getBoundingClientRect();
  const aspect = bbox.width / bbox.height;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera( 75, aspect, 0.1, 1000 );
  cameraControls = new OrbitControls(camera);
  cameraControls.enableKeys = false;
  cameraControls.enableRotate = false;
  cameraControls.enablePan = true;

  renderer = new THREE.WebGLRenderer( { antialias: true} );
  electrodeObjects = null;
  container.appendChild( renderer.domElement );

  camera.position.z = 100;
  renderer.setSize( bbox.width, bbox.height );
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor( "rgb(55, 55, 55)", 1 );

  var lastTimeMsec = null;
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

  electrodeControls = new ElectrodeControls(scene, camera, renderer, container);
  await electrodeControls.loadSvg('default.svg');

  routeControls = new RouteControls(scene, camera, electrodeControls, container);
  videoControls = new VideoControls(scene, camera, renderer, updateFcts, electrodeControls.svgGroup);
  // window.onresize = (e) => {console.log("resizing..", e)}
  animate();

  return {cameraControls, electrodeControls, routeControls, videoControls};
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

  window.electrodeObjects = electrodeObjects;
  window.camera = camera;
  window.renderer = renderer;
  window.electrodeControls = electrodeControls;
  window.cameraControls = cameraControls;
  window.routeControls = routeControls;
  window.scene = scene;
  window.GenerateRoute = GenerateRoute;
  window.videoControls = videoControls;
}

module.exports = {init, createScene, createDatGUI, createContextMenu};
