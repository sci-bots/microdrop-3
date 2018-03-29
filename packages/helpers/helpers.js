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

let FindPath = module.exports.FindPath = (object, deepKey, path="") => {
  /* Get path to nested key (only works if key is unique) */

  // If object contains key then return path
  if (_.get(object, deepKey)){
    return `${path}.${deepKey}`.slice(1);
  }

  // Otherwise, search all child objects:
  else {
    let keys =  _.keys(object);
    let _path;
    _.each(keys, (k) => {
      // Skip keys that are not objects:
      if (!_.isObject(object[k])) return true;
      // Check if key found along path:
      let p = FindPath(object[k], deepKey, `${path}.${k}`);
      // If path isn't false, exit each loop (path has been found):
      if (p) { _path = p; return false; }
    });

    // Return path if defined
    if (_path) return _path;
  }
  return false;
};

let FindPaths = module.exports.FindPaths = (object, deepKey) => {
  let paths = [];
  let lastPath = false;
  let _object = _.cloneDeep(object);
  do {
    lastPath = FindPath(_object, deepKey);
    if (lastPath != false) {
      let newPath = _.toPath(lastPath).slice(0,-1);
      newPath.push(`_${deepKey}`);
      let oldObj = _.get(_object, lastPath);
      _.set(_object, newPath, oldObj);
      _.unset(_object, lastPath);
      paths.push(lastPath.replace(new RegExp(`_${deepKey}`, "g"), deepKey));
    }
  } while (lastPath != false);

  return paths;
}
