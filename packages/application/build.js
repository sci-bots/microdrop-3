const {execSync} = require('child_process');
const path = require('path');

// "build": "npm run build:phosphor && npm run build:ui",
// "build:phosphor": " cd ./ui/src && ../../node_modules/.bin/webpack --config phosphor.config.js",
// "build:ui": "cd ./ui/src && ../../node_modules/.bin/webpack --config plugin-manager.config.js"

const srcPath = path.resolve('./ui/src');
const webpackPath = path.resolve('./node_modules/.bin/webpack');

const phosphorCmd = `${webpackPath} --config phosphor.config.js`;
const pmCmd = `${webpackPath} --config plugin-manager.config.js`;

execSync(phosphorCmd, {cwd: srcPath, stdio: 'inherit'});
execSync(pmCmd, {cwd: srcPath, stdio: 'inherit'});
