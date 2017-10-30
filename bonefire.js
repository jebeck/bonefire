#!/usr/bin/env node

const yargs = require('yargs');

yargs
  .usage('$0 <cmd> [args]')
  .command(require('./src/throttledFetch'))
  .help().argv;
