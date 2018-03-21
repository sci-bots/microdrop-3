const packager = require('electron-packager');
const options = {
  dir: __dirname,
  derefSymlinks: true,
  overwrite: true,
  packageManager: false,
  name: 'MicroDrop',
  asar: true,
  out: `${__dirname}/packager`,
  ignore: /(nsis|node_modules\/\@microdrop\/application\/node_modules\/\@microdrop\/dropbot-plugin)/
};

packager(options).then((d) => {
  console.log("packager done!");
});
