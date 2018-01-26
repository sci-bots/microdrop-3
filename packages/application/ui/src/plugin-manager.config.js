const path = require('path');

if (path.basename(path.resolve('.')) != 'src') {
  console.error('please execute from inside the ui/src directory');
  // process.exit(1);
}

var config = {
  entry: './plugin-manager.src.js',
  output: {
    filename: './plugin-manager.web.js',
    library: 'PluginManager',
    libraryTarget: 'var'
  }
};

module.exports = config;
