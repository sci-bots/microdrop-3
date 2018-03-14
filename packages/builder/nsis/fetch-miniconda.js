const https = require('https');
const fs = require('fs');
const path = require('path');

const MINICONDA_URL = 'https://repo.continuum.io/miniconda/Miniconda2-latest-Windows-x86.exe';
const file = fs.createWriteStream(path.resolve(__dirname, "miniconda.exe"));
const request = https.get(MINICONDA_URL, function(response) {
  response.pipe(file);
});
