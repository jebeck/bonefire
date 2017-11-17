const fs = require('fs');
const path = require('path');

module.exports = function dumpJSONToFile(data, path, cb) {
  fs.writeFile(path, JSON.stringify(data, null, 2), cb);
};
