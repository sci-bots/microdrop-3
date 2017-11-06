require('style-loader!css-loader!jquery-contextmenu/dist/jquery.contextMenu.css');

const $ = require('jquery'); require('jquery-contextmenu');
const _ = require('lodash');
const Dat = require('dat.gui/build/dat.gui');
const THREE = require('three');
const OrbitControls = require('three-orbit-controls')(THREE);

const ElectrodeControls = require('./electrode-controls');
const {RouteControls, GenerateRoute} = require('./route-controls');
const VideoControls = require('./video-controls');

var electrodeControls, electrodeObjects, camera, controls, renderer,
  routeControls, scene, videoControls;

const createScene = async () => {
  const updateFcts = [];

  // Create ThreeJS scene
  const bbox = document.body.getBoundingClientRect();
  const aspect = bbox.width / bbox.height;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera( 75, aspect, 0.1, 1000 );
  controls = new OrbitControls(camera);
  controls.enableKeys = false;
  controls.enableRotate = false;
  controls.enablePan = true;

  renderer = new THREE.WebGLRenderer( { antialias: true} );
  electrodeObjects = null;
  document.body.appendChild( renderer.domElement );

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

  electrodeControls = new ElectrodeControls(scene, camera, renderer);
  await electrodeControls.loadSvg('default.svg');

  routeControls = new RouteControls(scene, camera, electrodeControls);
  videoControls = new VideoControls(scene, camera, renderer, updateFcts, electrodeControls.svgGroup);
  window.onresize = (e) => {console.log("resizing..", e)}
  animate();
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

function createDatGUI() {
  const gui = new Dat.GUI();
  gui.add(controls, 'enableRotate');
  gui.add(videoControls, "display_anchors");
}

init = async () => {

  await createScene();
  // createContextMenu();
  createDatGUI();

  window.$ = $;
  window._ = _;
  window.THREE = THREE;

  window.electrodeControls = electrodeControls;
  window.electrodeObjects = electrodeObjects;
  window.camera = camera;
  window.controls = controls;
  window.renderer = renderer;
  window.routeControls = routeControls;
  window.scene = scene;
  window.GenerateRoute = GenerateRoute;
  window.videoControls = videoControls;
}

module.exports = {init, createScene};
