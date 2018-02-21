const hasbin = require('hasbin');

result = hasbin.sync('conda');

if (result == false)
  console.error(`
    Microdrop requires conda to manage process plugins.
    Please install conda and add to your path.
  `);
