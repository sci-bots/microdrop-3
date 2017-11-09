var web = {
  entry: './src/device-controller.js',
  output: {
    filename: './build/device-controller.web.js',
    library: 'DeviceController',
    libraryTarget: 'var'
  }
};


var commonjs = {
  entry: './src/device-controller.js',
  output: {
    filename: './build/device-controller.common.js',
    library: 'DeviceController',
    libraryTarget: 'commonjs2'
  }
};

module.exports = [web, commonjs];
