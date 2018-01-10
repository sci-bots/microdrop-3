const path = require('path');
const { app } = require('electron');
const fs = require('fs-extra');
const appName = app.getName();

// Get app directory
const getAppPath = path.join(app.getPath('appData'), '@microdrop/application');
console.log({appName, getAppPath});

const res = fs.unlinkSync(getAppPath);
console.log("DATA CLEARED..", {res});
app.exit();
