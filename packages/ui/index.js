const path = require('path');
const fs = require('fs');

const handlebars = require('handlebars');

const GetUIPath = () => {
  return path.resolve(__dirname, 'static');
}

const UpdateDisplayTemplate = (pluginPaths) => {
  const fileSrc  = path.join(__dirname, "templates/display.hb");
  const fileDest = path.join(__dirname, "static/display.html");

  const file = fs.readFileSync(fileSrc);
  const template = handlebars.compile(file.toString())
  const html = template({pluginPaths});
  fs.writeFileSync(fileDest, html);
}

module.exports = {GetUIPath, UpdateDisplayTemplate};
