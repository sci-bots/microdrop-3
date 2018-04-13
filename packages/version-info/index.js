const path = require('path');
module.exports.GetPath = () => {
  return path.resolve(__dirname, 'public');
}
