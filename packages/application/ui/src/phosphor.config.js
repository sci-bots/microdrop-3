const path = require('path');

if (path.basename(path.resolve('.')) != 'src') {
  console.error('please execute from inside the ui/src directory');
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
