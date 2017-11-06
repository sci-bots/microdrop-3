var webConfig = {
  entry: './src/device-ui-plugin.js',
  output: {
    filename: './device-ui-plugin.web.js',
    library: 'DeviceUI',
    libraryTarget: 'var'
  }
};

module.exports = webConfig;
