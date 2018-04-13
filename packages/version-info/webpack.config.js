var config = {
  entry: './src/version-info.js',
  output: {
    filename: './public/version-info.web.js',
    library: 'VersionInfo',
    libraryTarget: 'var'
  },
  module:{
    loaders: [
      { test: /\.(png|woff|woff2|eot|ttf|svg|otf)$/,
        loader: 'url-loader?limit=100000'
      },
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
