const path = require('path');
const {spawn} = require('child_process');

var options = {stdio: 'inherit', shell: true};

const electronMocha = path.resolve(__dirname, 'node_modules/.bin/electron-mocha');
console.log({electronMocha});

var child = spawn(`${electronMocha}`, options);
child.on('exit', function (code) {
  console.log('child process exited with code ' + code.toString());
});
