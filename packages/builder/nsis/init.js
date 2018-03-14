const https = require('https');
const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

function moveMicrodropOutput() {
  const packagerFolder = path.resolve(__dirname, '../packager');

  fs.readdirSync(packagerFolder).forEach(file => {
    if (path.extname(file) == '') {
      let oldPath = path.resolve(packagerFolder, file);
      let newPath = path.resolve(__dirname, 'MicroDrop');
      fs.renameSync(oldPath, newPath);
    }
  });
}

function fetchMiniconda() {
  const MINICONDA_URL = 'https://repo.continuum.io/miniconda/Miniconda2-latest-Windows-x86.exe';
  const filepath = path.resolve(__dirname, "miniconda.exe");
  const file = fs.createWriteStream(filepath);
  const request = https.get(MINICONDA_URL, function(response) {
    response.pipe(file);
  });

  file.on('finish', function(){
    spawnSync(`cmd /C start /wait "" ${filepath} /NoRegistry=1 /RegisterPython=0 /AddToPath=0 /InstallationType=JustMe /S /D=${path.resolve(__dirname, 'MicroDrop/miniconda')}`, [], {shell: true, stdio: 'inherit'});
  });

};

moveMicrodropOutput();
fetchMiniconda();
