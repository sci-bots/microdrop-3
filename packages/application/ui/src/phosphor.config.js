const path = require('path');

if (path.basename(path.resolve('.')) != 'application') {
  console.error('please execute from root of @microdrop/application package');
  // process.exit(1);
}

var config = {
  entry: './scripts/phosphor.src.js',
  output: {
    filename: './scripts/phosphor.web.js',
    library: 'PhosphorWidgets',
    libraryTarget: 'var'
  }
};

module.exports = config;
