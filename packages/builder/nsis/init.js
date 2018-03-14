const https = require('https');
const fs = require('fs');
const path = require('path');

function moveMicrodropOutput() {
  const packagerFolder = path.resolve(__dirname, '../packager');

  fs.readdirSync(packagerFolder).forEach(file => {
    if (path.extname(file) == '') {
      let oldPath = path.resolve(packagerFolder, file);
      let newPath = path.resolve(__dirname, 'MicroDrop');
      fs.rename(oldPath, newPath, function (err) {
        if (err) throw err
      });
    }
  });
}

function fetchMiniconda() {
  const MINICONDA_URL = 'https://repo.continuum.io/miniconda/Miniconda2-latest-Windows-x86.exe';
  const file = fs.createWriteStream(path.resolve(__dirname, "miniconda.exe"));
  const request = https.get(MINICONDA_URL, function(response) {
    response.pipe(file);
  });
};

moveMicrodropOutput();
fetchMiniconda();
