const _ = require('lodash');
const path = require('path');
const fs = require('fs');

module.exports = (gulp) => {
  require('./main')(gulp);

  // Overrides
  installDeps = async (mode) => {
    return (await _installDeps(mode, ".."));
  }

  gulp.task('get:packages', _.noop);
  gulp.task('get:plugins', _.noop);
  gulp.task('build', build);
  gulp.task('build:dev', ()=>buildDev(".."));

  gulp.task('update:jlab:dependencies', (cb) => {
    let deps = getJlabDeps();
    uninstallDeps('jlab');
    _installDeps('production', '..', 'jlab');
  });

  gulp.task('create:view', () => {
    const data = readMicrodropJSON();
    const src = path.posix.join(data.name, data.script);

    const template = `
      <html>
        <head>
          <script src="/${src}"></script>
        </head>
        <body></body>
        <script>
          function getClass() {
            for (const [name, cls] of Object.entries(window)){
              try {
                if (Object.getPrototypeOf(cls).name == "UIPlugin") {
                  return {name, cls};
                }
              } catch (e) {
                continue;
              }
            }
          }
          const {name, cls} = getClass();
          document.title = name;
          new cls(document.body);
        </script>
      </html>
      `;
    if (!fs.existsSync('build')) {
      fs.mkdirSync('build');
    };
    fs.writeFileSync(path.join('build', 'index.html'), template);
  });

}
