const path = require('path');
const {spawn} = require('child_process');

var options = {stdio: 'inherit', shell: true};

const electronMocha = path.resolve('./node_modules/.bin/electron-mocha');
var child = spawn(`${electronMocha}`, options);
child.on('exit', function (code) {
  console.log('child process exited with code ' + code.toString());
});
