module.exports.SetConsole = (console) => {
  /* Override default console for electron render processes to stdio */
  const {Console} = require('console');
  window.console = new Console(process.stdout, process.stderr);
  window.addEventListener('unhandledrejection', function(event) {
      console.error('Unhandled rejection (promise: ', event.promise, ', reason: ', event.reason, ').');
  });
  window.addEventListener('error', function(e) {
      console.error(e.message);
  });
}
