const {exec} = require('child_process');
const fs = require('fs');
const path = require('path');

const ArgumentParser = require('argparse').ArgumentParser;

const parser = new ArgumentParser({
  version: '0.0.1',
  addHelp:true,
  description: 'Microdrop Find Plugins Args Parser'
});

parser.addArgument(
  [ '-p', '--path' ],
  {
    help: 'Additional microdrop plugin searchpath',
    action: "append"
  }
);

var args = parser.parseArgs();

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

function findUserDefinedPlugins() {
  // Load paths stored in JSON file

  // TODO: Use microdrop-server location instead of dirname
  // incase find-microdrop-plugins.js is in different directory
  const pluginsFile = path.resolve(path.join(__dirname,"plugins.json"));

  const pluginsData = JSON.parse(fs.readFileSync(pluginsFile, 'utf8'));
  const searchPaths = pluginsData.searchPaths;

  // Append path arguments to searchpaths:
  let extraPaths = [];
  if (args.path) extraPaths = args.path;
  for (const searchpath of extraPaths)
    searchPaths.push(path.resolve(searchpath));

  // Iterate through each path
  for (const searchPath of searchPaths) {
    // Validate the search path exists
    if (!fs.existsSync(searchPath)) {
      console.error(`SEARCHPATH DOES NOT EXIST:
                    Cannot find folder: ${searchPath}`);
      continue;
    }

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

// findCondaPlugins();
findUserDefinedPlugins();
