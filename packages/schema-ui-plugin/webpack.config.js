var config = {
  entry: './src/schema-ui-plugin.js',
  output: {
    filename: './build/schema-ui-plugin.web.js',
    library: 'SchemaUIPlugin',
    libraryTarget: 'var'
  },
  module:{
    loaders: [
      { test: /\.(png|woff|woff2|eot|ttf|svg)$/, loader: 'url-loader?limit=100000' },
      { test: /\.css$/,
        use: [
          { loader: 'style-loader' },
          { loader: 'css-loader' }
        ]
      }
    ]
  },
  resolve: {
    alias: {
      "jquery": "jquery"
    }
  }
};

module.exports = config;
