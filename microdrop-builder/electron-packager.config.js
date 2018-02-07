const packager = require('electron-packager');
const options = {
  dir: __dirname,
  derefSymlinks: true,
  overwrite: true,
  packageManager: false,
  name: 'Microdrop'
};
packager(options).then((d) => {
  console.log("packager done!");
});
