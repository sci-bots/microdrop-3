var config = {
  entry: './src/dropbot-ui-plugin.js',
  output: {
    filename: './build/dropbot-ui-plugin.web.js',
    library: 'DropbotUI',
    libraryTarget: 'var'
  },
  module:{
    loaders: [
      { test: /\.(png|woff|woff2|eot|ttf|svg)$/, loader: 'url-loader?limit=100000' }
    ]
  }
};

module.exports = config;
