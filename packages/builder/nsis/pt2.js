// Create a 7zip archive
const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

function createArchive() {
  spawnSync(`7z a MicroDrop ${path.resolve(__dirname, 'MicroDrop')}`, [], {shell: true, stdio: 'inherit'});
}

module.exports = createArchive;
module.exports.createArchive = createArchive;

if (require.main === module) {
    createArchive();
}
