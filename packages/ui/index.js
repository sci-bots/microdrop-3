const path = require('path');
const fs = require('fs');

const GetUIPath = () => {
  return path.resolve(__dirname, 'static');
}

module.exports = {GetUIPath};
