const path = require('path');
const {spawn} = require('child_process');
const {Console} = require('console');
const console = new Console(process.stdout, process.stderr);

var options = {stdio: 'inherit', shell: true};

const electronMocha = path.resolve(__dirname, 'node_modules/.bin/electron-mocha');
console.log({electronMocha});

var child = spawn(`${electronMocha} --ignore-gpu-blacklist`, options);
child.on('exit', function (code) {
  console.log('child process exited with code ' + code.toString());
});
