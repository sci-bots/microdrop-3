var webConfig = {
  entry: './src/device-ui-controller.js',
  output: {
    filename: './build/device-ui-controller.web.js',
    library: 'DeviceUI',
    libraryTarget: 'var'
  },
  module:{
    loaders: [
      { test: /\.(png|woff|woff2|eot|ttf|svg)$/, loader: 'url-loader?limit=100000' }
    ]
  }
};

module.exports = webConfig;
