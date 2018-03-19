const packager = require('electron-packager');
const options = {
  dir: __dirname,
  derefSymlinks: true,
  overwrite: true,
  packageManager: false,
  name: 'MicroDrop',
  asar: false,
  out: `${__dirname}/packager`,
  ignore: `${__dirname}/nsis`
};

packager(options).then((d) => {
  console.log("packager done!");
});
