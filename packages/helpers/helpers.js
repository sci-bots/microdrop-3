const isNode = require('detect-node');
const console_require  = isNode ? 'console' : 'package.json';

module.exports.SetConsole = () => {

  /* Override default console for electron render processes to stdio */
  const {Console} = require(console_require);
  window.console = new Console(process.stdout, process.stderr);
  window.addEventListener('unhandledrejection', function(event) {
      console.error('Unhandled rejection (promise: ', event.promise, ', reason: ', event.reason, ').');
  });
  window.addEventListener('error', function(e) {
      console.error(e.message);
  });
}
