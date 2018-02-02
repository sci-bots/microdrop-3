const phoshporConfig = {
  entry: './src/phosphor.src.js',
  output: {
    filename: './static/scripts/phosphor.web.js',
    library: 'PhosphorWidgets',
    libraryTarget: 'var'
  }
};

const pluginManagerConfig = {
  entry: './src/plugin-manager.js',
  output: {
    filename: './static/scripts/plugin-manager.web.js',
    library: 'PluginManager',
    libraryTarget: 'var'
  }
};


module.exports = [phoshporConfig, pluginManagerConfig];
