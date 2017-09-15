const {exec} = require('child_process');
const fs = require('fs');
const path = require('path');

const isDirectory = source =>
  fs.lstatSync(source).isDirectory() || fs.lstatSync(source).isSymbolicLink()

const getDirectories = source =>
  fs.readdirSync(source).map(name => path.join(source, name)).filter(isDirectory);

function findPluginsInPaths(paths) {
  for (const plugin_path of paths) {
    // Confirm path exists
    if (!fs.existsSync(plugin_path)) continue;

    // Get list of sub directories
    const sub_directories = getDirectories(plugin_path);

    // Check each sub directory for a microdrop.json file
    for (const dir of sub_directories) {
      if (fs.existsSync(path.join(dir, "microdrop.json"))){
        if ("send" in process)
          process.send({plugin_path: dir});
        else
          console.log(`Plugin Dir: ${dir}`);
      }
    }
  }
}

function findCondaPlugins() {
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
    findPluginsInPaths(conda_paths);
  });
}

function findUserDefinedPlugins() {
  // Load paths stored in JSON file
  const pluginsFile = path.resolve("plugins.json");
  const pluginsData = JSON.parse(fs.readFileSync(pluginsFile, 'utf8'));
  const searchPaths = pluginsData.searchPaths;

  // Iterate through each path
  for (const searchPath of searchPaths) {
    // Validate the search path exists
    if (!fs.existsSync(searchPath)) continue;

    // Check if searchPath is itself a plugin
    if (fs.existsSync(path.join(searchPath, "microdrop.json"))) {
      if ("send" in process)
        process.send({plugin_path: searchPath});
      else
        console.log(`Plugin Dir: ${searchPath}`);
      continue;
    }

    // Get all subdirectories:
    const subDirectories = getDirectories(searchPath);

    // Check each sub directory for a microdrop.json file
    for (const dir of subDirectories) {
      if (fs.existsSync(path.join(dir, "microdrop.json"))){
        if ("send" in process)
          process.send({plugin_path: dir});
        else
          console.log(`Plugin Dir: ${dir}`);
      }
    }
  }
}

findCondaPlugins();
findUserDefinedPlugins();
