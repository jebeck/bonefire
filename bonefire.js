#!/usr/bin/env node

const yargs = require('yargs');

yargs
  .usage('$0 <cmd> [args]')
  .command(require('./src/throttledFetch'))
  .help().argv;

process.on('unhandledRejection', (reason, p) => {
  console.warn(`\nUnhandled rejection:`, p);
  console.log();
  console.warn(`\nReason: ${reason}\n`);
});
