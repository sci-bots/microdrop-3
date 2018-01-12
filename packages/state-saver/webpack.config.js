var config = {
  entry: './src/state-saver.js',
  output: {
    filename: './build/state-saver.web.js',
    library: 'StateSaverUI',
    libraryTarget: 'var'
  },
  module:{
    loaders: [
      { test: /\.(png|woff|woff2|eot|ttf|svg)$/, loader: 'url-loader?limit=100000' }
    ]
  }
};

module.exports = config;
