const {exec} = require('child_process');
const fs = require('fs');
const path = require('path');

const walk = require('walk');

function conda() {
  // console.log("GET CONDA INFO::");

  exec('conda info --json', (error, stdout, stderr) => {
    if (error) {
      console.error('Could not retrieve conda information:::');
      console.error(error);
      return;
    }
    const conda_info = JSON.parse(stdout);
    const conda_paths = new Array();
    conda_paths.push(path.join(conda_info['root_prefix'],
              "/share/microdrop/plugins/available"));
    for (const env of conda_info['envs']) {
      conda_paths.push(
        path.join(env,"/share/microdrop/plugins/available")
      );
    }

    for (const conda_path of conda_paths) {

      const walker = walk.walk(conda_path);

      walker.on("file", function (root, fileStats, next) {
        fs.readFile(fileStats.name, function () {
          if (fileStats.name == 'microdrop.json') {
            // console.log("SENDING PLUGIN PATH::");
            process.send({plugin_path: root});
            // console.log(`FOUND PLUGIN: ${root}`);
          }
          // console.log(`NAME: ${fileStats.name}`);
          next();
        });
      });

    }

  });

}

conda();
