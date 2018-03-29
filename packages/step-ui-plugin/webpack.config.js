var config = {
  entry: './src/step-ui-plugin.js',
  output: {
    filename: './build/step-ui-plugin.web.js',
    library: 'StepUIPlugin',
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
