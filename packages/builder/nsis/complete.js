const path = require('path');
const {spawnSync} = require('child_process');
const p1 = require('./pt1.js');
const p2 = require('./pt2.js');
const p3 = require('./pt3.js');


console.log("Pt 0. Running electron packager");
console.log("-------------------------------");
spawnSync('node electron-packager.config.js', [], {cwd: `${path.resolve(__dirname, '..')}`, stdio: 'inherit', shell: true});

console.log("Pt 1. Creating MicroDrop folder with miniconda");
console.log("---------------------------------------------");
p1(() => {

  console.log("Pt 2. Creating 7zip archive");
  console.log("---------------------------");
  p2();

  console.log("Pt 3. Creating EXE");
  console.log("---------------------------");
  p3();
});
