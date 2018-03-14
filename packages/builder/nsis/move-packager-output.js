const fs = require('fs');
const path = require('path');

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
