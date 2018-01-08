var webConfig = {
  entry: './NodeMqttClient.js',
  output: {
    filename: 'bundle.web.js',
    libraryTarget: 'var',
    library: 'NodeMqttClient'
  }
};

module.exports = webConfig;
