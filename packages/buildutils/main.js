const path = require('path');
const _ = require('lodash');
const {spawnSync, spawn, exec} = require('child_process');
_.extend(global, require('./functions'));

module.exports = (gulp) => {

  gulp.task('build:ui-plugins', async function() {
    await installAndBuildPlugins();
  });

  gulp.task('build:ui-plugins:clean', async function() {
    await installAndBuildPlugins(true);
  });

  gulp.task('start:microdrop', async function() {
    console.log("Launching microdrop");
    callCommand(`${path.resolve("node_modules/.bin/electron")} .`);
  });

  gulp.task('link:jupyterlab', async function() {
    const extension_path = path.resolve('./packages/jupyterlab-extension');
    callCommand(`jupyter labextension link ${extension_path}`);
  });

  gulp.task('start:jupyterlab', async function() {
    exec('jupyter lab');
  });

  gulp.task('start:jupyterlab:dev', async function() {
    exec('jupyter lab --watch');
  });

  gulp.task('reset:db', async function() {
    return await clearDatabase();
  });

  gulp.task('git:add', async function() {
    await callCommand('git add package-lock.json');
    await callCommand('git add -p');
    await callCommand('git commit');
  });

  gulp.task('build', build);

}
