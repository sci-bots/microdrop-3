// Build by running: "webpack" (not "webpack .")
var webConfig = {
  entry: './WebMqttClient.js',
  output: {
    filename: 'web-mqtt.web.js',
    // use library + libraryTarget to expose module globally
    library: 'MQTTClient',
    libraryTarget: 'var'
  }
};

module.exports = webConfig;
