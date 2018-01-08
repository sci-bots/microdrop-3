const fs = require('fs');
const path = require('path');
const spawn = require('child_process').spawn;
const del = require('del');
const _ = require('lodash');

module.exports = {};

module.exports.buildUI = async (clean) => {
  const _path = path.resolve('.', 'ui/src');
  const webpackPath = path.resolve('./node_modules/.bin/webpack');

  await callCommand('npm install', _path);
  await callCommand(`${webpackPath} --config phosphor.config.js`, _path);
  await callCommand(`${webpackPath} --config plugin-manager.config.js`, _path);
  if (clean) {
    const parent = path.resolve(_path, 'node_modules');
    const webclientPath = path.join(parent, '@mqttclient', '**');
    const microdropPath = path.join(parent, '@microdrop', '**');

    await del([path.resolve(parent, '**'), `!${parent}`, `!${webclientPath}`, `!${microdropPath}`]);
  }
}

module.exports.installAndBuildPlugins = async (clean) => {
  const plugins = _.values(getPlugins());
  for (const [i, _path] of plugins.entries()) {
    await callCommand(`npm install`, _path);
    await callCommand(`gulp --cwd ${_path} build`);
    if (clean) await del(path.resolve(_path, 'node_modules'));
  }
  return await build();
}

module.exports.buildDev = async (loc="..") => {
  const deps = _.values(getMicrodropDeps());
  for (const [i, dep] of deps.entries()) {
    const _path = path.resolve(loc, dep);
    console.log("building:", dep);
    await callCommand(`gulp --cwd ${_path} build:dev`);
  }
  return await build();
}

module.exports.build = async () => {
  // Build javascript file
  const webpackPath = path.resolve('.','node_modules/.bin/webpack');
  if (fs.existsSync(webpackPath)){
    await callCommand(webpackPath);
  } else {
    await callCommand("webpack");
  }

  // Create html view
  if (fs.existsSync('microdrop.json')) {
    const data = readMicrodropJSON();
    if (data.type == "ui") {
      await callCommand(`gulp create:view`);
    }
  }
}

module.exports.clearDatabase = () => {
  return new Promise((resolve, reject) => {
    del([path.resolve("db")]).then(paths => {
        resolve('Deleted files and folders:\n', paths.join('\n'));
    });
  });
}

module.exports.installMicrodrop = async () => {
  return await callCommand("npm install");
}

module.exports._installDeps = async (mode, loc="packages", type="microdrop") => {
  let deps, names;
  switch (type) {
    case "microdrop":
      deps = getMicrodropDeps();
      break;
    case "jlab":
      deps = getJlabDeps();
  }

  if (mode == "production") {
    if (_.isArray(deps)) names = deps;
    if (_.isPlainObject(deps)) names = _.keys(deps);
  }
  if (mode == "developer") {
    names = _.map(_.values(deps), (d) => path.resolve(loc, d));
  }

  return await callCommand(`npm i ${names.join(" ")}`);
}

module.exports.installDeps = async(mode, loc="packages") => {
  return (await _installDeps(mode, loc));
}

module.exports.uninstallDeps = async (type="microdrop") => {
  let deps;
  switch (type) {
    case "microdrop":
      deps = _.keys(getMicrodropDeps());
      break;
    case "jlab":
      deps = getJlabDeps();
      break;
  }

  return await callCommand(`npm uninstall ${deps.join(" ")}`);
}

module.exports.callCommand = (command, cwd) => {
  var options = {stdio: 'inherit', shell: true};
  if (cwd) options.cwd = cwd;

  return new Promise((resolve, reject) => {
    var child = spawn(command, options);
    child.on('exit', function (code) {
      resolve('child process exited with code ' + code.toString());
    });
  });
}

module.exports.getMicrodropDeps = () => {
  var packageJSON = require(path.resolve('package.json'));
  return packageJSON.microdropDependencies;
}

module.exports.getJlabDeps = () => {
  var packageJSON = require(path.resolve('package.json'));
  return packageJSON.jupyterlabDependencies;
}

module.exports.getPackages = () => {
  var files = fs.readdirSync(path.resolve("packages"));
  var packages = [];
  for (const [i, package] of files.entries()) {
    var packageDir = path.resolve("packages", package);
    var stats = fs.statSync(packageDir);
    if (stats.isDirectory()) {
      if (fs.existsSync(path.resolve(packageDir,'package.json'))) {
        packages.push(packageDir);
      }
    }
  }
  return packages;
}

module.exports.getPlugins = () => {
  var packages = getPackages();
  var plugins = [];
  for (const [i, package] of packages.entries()) {
    if (fs.existsSync(path.resolve(package,'microdrop.json'))) {
      plugins.push(package);
    }
  }
  return plugins;
}

module.exports.readMicrodropJSON = () => {
  return require(path.resolve('microdrop.json'));
}
