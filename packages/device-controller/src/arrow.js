module.exports = (THREE) => {
  return function(ids, group) {
    const lastElectrode = _.find(group.children, {name: _.last(ids)});
    const point = new THREE.Vector3();
    point.setFromMatrixPosition(lastElectrode.matrixWorld);
    var geometry = new THREE.BoxGeometry( 1, 1, 1 );
    var material = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
    var cube = new THREE.Mesh( geometry, material );
    cube.position.x = point.x;
    cube.position.y = point.y;
    cube.position.z = 1;
    return cube;
  }
};
