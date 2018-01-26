const path = require('path');
const {spawn} = require('child_process');

const devicePath = path.resolve(__dirname, 'DeviceModel.js');
const elecPath = path.resolve(__dirname, 'ElectrodesModel.js');
const routesPath = path.resolve(__dirname, 'RoutesModel.js');

console.log("SPAWING MODELS::");
spawn(`node ${devicePath}`, [], {stdio: 'inherit', shell: true});
spawn(`node ${elecPath}`, [], {stdio: 'inherit', shell: true});
spawn(`node ${routesPath}`, [], {stdio: 'inherit', shell: true});
