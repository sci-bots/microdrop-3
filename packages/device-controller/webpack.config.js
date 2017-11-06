var web = {
  entry: './src/device-controller.js',
  output: {
    filename: './build/device-controller.web.js',
    library: 'DeviceController',
    libraryTarget: 'var'
  },
  module:{
    loaders: [
      { test: /\.(png|woff|woff2|eot|ttf|svg)$/, loader: 'url-loader?limit=100000' }
    ]
  }
};


var commonjs = {
  entry: './src/device-controller.js',
  output: {
    filename: './build/device-controller.common.js',
    library: 'DeviceController',
    libraryTarget: 'commonjs2'
  },
  module:{
    loaders: [
      { test: /\.(png|woff|woff2|eot|ttf|svg)$/, loader: 'url-loader?limit=100000' }
    ]
  }
};

module.exports = [web, commonjs];
