const path = require('path');

if (path.basename(path.resolve('.')) != 'application') {
  console.error('please execute from root of @microdrop/application package');
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
