const _ = require('lodash');
const Backbone = require('backbone');
const THREE = require('three');

// const THREE = require('three');

// const ElectrodeControls = require('./electrode-controls');
// const {RouteControls, GenerateRoute} = require('./route-controls');
// const VideoControls = require('./video-controls');

// var electrodeControls, camera, cameraControls, renderer,
//   routeControls, scene, videoControls, container,
//   lastTimeMsec, updateFcts;

function createScene() {
  var scene = new THREE.Scene();
  var raycaster = new THREE.Raycaster();

  var geometry = new THREE.BoxGeometry( 10, 10, 10 );
  var material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );

  var cube1 = new THREE.Mesh( geometry, material );
  cube1.position.x = 40;
  cube1.position.y = 40;
  cube1.position.z = 0;
  cube1.name = "cube1";
  scene.add(cube1);

  var cube2 = new THREE.Mesh( geometry, material );
  cube2.position.x = 100;
  cube2.position.y = 40;
  cube2.position.z = 0;
  cube2.name = "cube2";
  scene.add(cube2);

  scene.updateMatrixWorld();

  var bodies = [cube1, cube2];

  raycaster.set(new THREE.Vector3(0,40,0), new THREE.Vector3(1,0,0));
  var intersects = raycaster.intersectObjects( scene.children, true );
  console.log(_.map(intersects, "object.name"), _.keys(scene.children));

  // // create an engine
  // var engine = Engine.create();
  //
  // // create two boxes and a ground
  // var boxA = Bodies.rectangle(40, 40, 80, 80, { isStatic: true });
  // var boxB = Bodies.rectangle(100, 40, 80, 80, { isStatic: true });
  // var ground = Bodies.rectangle(400, 610, 810, 60, { isStatic: true });
  // var bodies =  [boxA, boxB];
  //
  // // add all of the bodies to the world
  // World.add(engine.world,bodies);
  //
  // // run the engine
  // Engine.run(engine);
  //
  // // Look for collisions
  // var collisions = Query.ray(bodies, { x: 90, y: 40 }, { x: 200, y: 40 });
  // console.log("collisions", _.keys(collisions));
}

module.exports = {createScene};
