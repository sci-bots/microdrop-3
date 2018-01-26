const {spawn} = require('child_process');
const path = require('path');

const OPTIONS = {stdio: 'inherit', shell: true};

console.log("Launching Electron APP");
spawn(`electron app.js`, [], OPTIONS);

console.log("Launching Models");
spawn(`node ${path.resolve('models', 'launch-models.js')}`, [], OPTIONS);
