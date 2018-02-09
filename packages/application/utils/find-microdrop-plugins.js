const {exec} = require('child_process');
const fs = require('fs');
const path = require('path');

const readdir = (dir) => {
  return new Promise((resolve, reject) => {
    fs.readdir(dir, (err, files) => {
      if (err) reject(err);
      resolve(files);
    });
  });
}

const exists = (dir) => {
  return new Promise((resolve, reject) => {
    fs.exists(dir, (d) => {
      resolve(d);
    });
  });
};


const isDirectory = source =>
  fs.lstatSync(source).isDirectory() || fs.lstatSync(source).isSymbolicLink()

const getDirectories = async source =>
  (await readdir(source)).map(name => path.join(source, name)).filter(isDirectory);

async function findPluginsInPaths(paths) {
  for (const plugin_path of paths) {
    // Confirm path exists
    if (!(await exists(plugin_path))) continue;

    // Get list of sub directories
    const sub_directories = getDirectories(plugin_path);

    // Check each sub directory for a microdrop.json file
    for (const dir of sub_directories) {
      if (await exists(path.join(dir, "microdrop.json"))) {
        if ("send" in process)
          process.send({plugin_path: dir});
        else
          console.log(`Plugin Dir: ${dir}`);
      }
    }
  }
}

async function findUserDefinedPlugins(extraPaths=[], storage=undefined, callback) {
  if (storage == undefined) storage = window.localStorage;

  const pluginsData = JSON.parse(storage.getItem("microdrop:plugins"));
  const searchPaths = pluginsData.searchPaths;

  // Append path arguments to searchpaths:
  for (const searchpath of extraPaths)
    searchPaths.push(path.resolve(searchpath));

  // Iterate through each path
  for (const searchPath of searchPaths) {
    // Validate the search path exists
    if (!(await exists(searchPath))) {
      console.error(`SEARCHPATH DOES NOT EXIST:
                    Cannot find folder: ${searchPath}`);
      continue;
    }

    // Check if searchPath is itself a plugin
    if (await exists(path.join(searchPath, "microdrop.json"))) {
        callback({plugin_path: searchPath})
      continue;
    }

    // Get all subdirectories:
    const subDirectories = getDirectories(searchPath);

    // Check each sub directory for a microdrop.json file
    for (const dir of subDirectories) {
      if (await exists(path.join(dir, "microdrop.json"))) {
        callback({plugin_path: searchPath});
      }
    }
  }
}

module.exports = findUserDefinedPlugins;
