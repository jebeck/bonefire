const path = require('path');

exports.handler = function() {
  const next = require(path.resolve(__dirname, '../next.json'));
  if (next) {
    console.log(`Next fetch URL is ${next.next}`);
    process.exit(0);
  }
  console.log('No next fetch URL stored');
};

exports.command = 'next';

exports.describe = 'report stored next fetch URL';

exports.builder = yargs => {
  return yargs;
};
