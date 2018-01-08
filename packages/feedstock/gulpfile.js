const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawn} = require('child_process');

const chalk = require('chalk');
const gulp = require('gulp');
const yaml = require('yamljs');

const log = console.log;

const m1 = (...m) => log(chalk.bold(chalk.blue(...m)));
const m2 = (...m) => log(chalk.green(...m));
const title = (...m) => log('---------------\n', ...m, '\n--------------- ');

const PACKAGE_NAME = 'microdrop';

gulp.task('build', async (d) => {
  /* Runs 'conda build .' after modifying meta.yaml */

  const file = path.resolve(__dirname, 'meta.yaml');

  m1('updating meta.yaml file');
  const meta = yaml.load(file);
  var {output} = await spawnAsync(`npm view ${PACKAGE_NAME} --json`, null, true);
  const microdrop = JSON.parse(output[0]);
  meta.package.version = microdrop.version;
  meta.package.name = microdrop.name;
  if (os.platform() == 'win32') {
    meta.build.script = 'npm install & .\\node_modules\\.bin\\gulp conda:build'
  } else {
    meta.build.script = 'npm install && ./node_modules/.bin/gulp conda:build'
  }
  fs.writeFileSync(file, yaml.stringify(meta, 4));
  m2(yaml.stringify(meta, 4));

  const token = process.env.ANACONDA_TOKEN;
  const user  = process.env.ANACONDA_USER;

  m1('running conda build .');
  if (token && user) {
    m2('building with token')
    await spawnAsync(`conda build . --token ${token} --user ${user}`);
  } else {
    m2('building without token')
    await spawnAsync(`conda build .`);
  }

  m1('reverting meta.yaml file');
  meta.package.version = 'VERSION';
  fs.writeFileSync(file, yaml.stringify(meta, 4));
  m2(yaml.stringify(meta, 4));
});

gulp.task('construct', async () => {
  m1('updating meta.yaml file');
  const file = path.resolve(__dirname, 'construct.yaml');
  const construct = yaml.load(file);
  var {output} = await spawnAsync(`npm view ${PACKAGE_NAME} --json`, null, true);
  const microdrop = JSON.parse(output[0]);
  construct.version = microdrop.version;
  construct.name = microdrop.name;
  if (os.platform() == 'win32')
    construct.post_install = 'post.bat'
  else
    construct.post_install = 'post.sh'

  fs.writeFileSync(file, yaml.stringify(construct, 4));
  m2(yaml.stringify(construct, 4));


  m1('writing post_install scripts');
  fs.writeFileSync('post.sh',
  ` echo running post.sh
    source bin/activate
    conda install jupyterlab
    cp bin/microdrop-3 microdrop-3
  `);
  fs.writeFileSync('post.bat',
  ` echo running post.bat
    call Scripts\\activate.bat & conda install jupyterlab
    cp bin\\microdrop-3 microdrop-3
  `);
  m2(`${fs.readdirSync(path.resolve('.'))}`.split(',').join('\n'));

  m1('calling constructor .');
  await spawnAsync(`constructor .`);

  m1('Removing post_install scripts');
  fs.unlinkSync('post.sh')
  fs.unlinkSync('post.bat')

  m1('reverting meta.yaml file');
  construct.version = 'VERSION';
  construct.name = 'NAME';
  construct.post_install = 'post.sh'
  fs.writeFileSync(file, yaml.stringify(construct, 4));
  m2(yaml.stringify(construct, 4));

  m1('Moving artifacts');
  m2(`${fs.readdirSync(path.resolve('.'))}`.split(',').join('\n'));
  const artifactsPath = path.resolve('./artifacts');
  if (!fs.existsSync(artifactsPath)){
    fs.mkdirSync(artifactsPath);
  }
  m2(artifactsPath);

  const files = fs.readdirSync(__dirname);
  for (const [i, file] of files.entries()){
    const filetype = path.extname(file);
    if (filetype == '.sh' || filetype == '.exe' || filetype == '.pkg' || filetype == '.bat') {
      fs.renameSync(file, path.resolve(artifactsPath, file));
      m2(path.resolve(artifactsPath, file));
    }
  }
});

gulp.task('conda:build', async () => {
  /* Ran internally by conda during build process */
    title('installing microdrop');
    await spawnAsync(`npm install --global ${PACKAGE_NAME} --no-optional`);
});

function spawnAsync(cmd, cwd, hideOutput) {

  let options = {shell: true};
  if (cwd) options.cwd = cwd;
  if (!hideOutput) options.stdio = 'inherit';

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, options);
    const output = [];
    if (hideOutput) {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (d)=> {
        output.push(d);
      });
    }
    child.on('exit', (code) => {
      if (hideOutput)
        resolve({code, output});
      else
        resolve(code);
    });
  });
}
