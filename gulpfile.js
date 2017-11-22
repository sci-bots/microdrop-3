const fs = require('fs');
const path = require('path');
const gulp = require('gulp');
const spawn = require('child_process').spawn;
const del = require('del');
const _ = require('lodash');

gulp.task('get:packages', () => {
  console.log(getPackages());
});

gulp.task('get:plugins', function() {
  console.log(getPlugins());
});

gulp.task('get:deps', function() {
  console.log(getMicrodropDeps());
});

gulp.task('uninstall:deps', async function() {
  return await uninstallDeps();
});

gulp.task('install:production', async function() {
  return await installDeps("production");
});

gulp.task('install:developer', async function() {
  return await installDeps("developer");
});

gulp.task('mode:production', async function() {
  await uninstallDeps();
  return await installDeps("production");
});

gulp.task('mode:developer', async function() {
  await uninstallDeps();
  return await installDeps("developer");
});

gulp.task('install:microdrop', async function() {
  return await installMicrodrop();
});

gulp.task('install:all', async function() {
  const cmd = path.resolve("node_modules/.bin/npm-recursive-install");
  await installMicrodrop();
  await callCommand(cmd);
});

gulp.task('start', async function() {
  await callCommand("node index.js");
});

gulp.task('reset:db', async function() {
  return await clearDatabase();
});

gulp.task('git:add', async function() {

  await callCommand('git add package-lock.json');
  await callCommand('git add -p');
  await callCommand('git commit');

});

function clearDatabase() {
  return new Promise((resolve, reject) => {
    del([path.resolve("db")]).then(paths => {
        resolve('Deleted files and folders:\n', paths.join('\n'));
    });
  });
}

async function installMicrodrop() {
  return await callCommand("npm install");
}

async function installDeps(mode) {
  var deps = getMicrodropDeps();
  let names;

  if (mode == "production") {
    names = _.keys(deps);
  }
  if (mode == "developer") {
    names = _.map(_.values(deps), (d) => path.resolve("packages", d));
  }

  return await callCommand(`npm i ${names.join(" ")}`);
}

async function uninstallDeps() {
  var deps = _.keys(getMicrodropDeps());
  return await callCommand(`npm uninstall ${deps.join(" ")}`);
}

async function callCommand(command) {
  return new Promise((resolve, reject) => {
    var child = spawn(command, {stdio: 'inherit', shell: true});
    child.on('exit', function (code) {
      resolve('child process exited with code ' + code.toString());
    });
  });
}

function getMicrodropDeps() {
  var packageJSON = require(path.resolve('package.json'));
  return packageJSON.microdropDependencies;
}

function getPackages() {
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

function getPlugins() {
  var packages = getPackages();
  var plugins = [];
  for (const [i, package] of packages.entries()) {
    if (fs.existsSync(path.resolve(package,'microdrop.json'))) {
      plugins.push(package);
    }
  }
  return plugins;
}
