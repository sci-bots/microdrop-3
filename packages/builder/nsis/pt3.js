// Create exe installer
const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

function makeNsis() {
  spawnSync(`makensis ${path.resolve(__dirname, 'script.nsh')}`, [], {shell: true, stdio: 'inherit'});
}

module.exports = makeNsis;
module.exports.makeNsis = makeNsis;

if (require.main === module) {
    makeNsis();
}
