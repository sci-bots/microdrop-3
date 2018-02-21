const os = require('os');
const {spawnSync} = require('child_process');
const hasbin = require('hasbin');


if (os.platform() == 'darwin') {
  result = hasbin.sync('wget');

  if (result == false) throw `
    wget not installed.
    Try running "brew install wget" first
  `;

  const cmd = `
    mkdir tmp || true &&
    wget https://repo.continuum.io/miniconda/Miniconda3-latest-MacOSX-x86_64.sh -O ./tmp/miniconda.sh &&
    bash ./tmp/miniconda.sh -u -b -p ./miniconda
    miniconda/bin/conda install conda-build
  `;

  const child = spawnSync(cmd, [], {stdio: 'inherit', shell: true, cwd: __dirname });

  console.log(`
    Please add microdrop to your path if you intend to develop process plugins

    export MICRODROP=${__dirname}
  `);
}
