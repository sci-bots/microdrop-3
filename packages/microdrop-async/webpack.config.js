var webConfig = {
  entry: './MicrodropAsync.js',
  output: {
    filename: 'microdrop-async.web.js',
    // use library + libraryTarget to expose module globally
    library: 'MicrodropAsync',
    libraryTarget: 'var'
  }
};

var webTestConfig = {
  entry: './test.js',
  output: {
    filename: 'test.web.js',
    // use library + libraryTarget to expose module globally
    library: 'MicrodropAsyncTests',
    libraryTarget: 'var'
  }
};

module.exports = [webConfig, webTestConfig];
