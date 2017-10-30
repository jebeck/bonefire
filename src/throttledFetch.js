const chalk = require('chalk');
const fetch = require('node-fetch');
const StateMachine = require('javascript-state-machine');

const fetchDetails = require('./utils/fetchDetails');
const fetchTopLevel = require('./utils/fetchTopLevel');
const makeJawboneUrl = require('./utils/makeJawboneUrl');
const supportedTypes = require('./constants/supportedTypes');

const FetchMachine = StateMachine.factory({
  init: 'ready',
  data: opts => {
    return opts;
  },
  transitions: [
    {
      name: 'fetch',
      from: 'ready',
      to: 'fetching',
    },
    {
      name: 'process',
      from: 'fetching',
      to: 'processing',
    },
    {
      name: 'upload',
      from: 'processing',
      to: 'uploading',
    },
    {
      name: 'next',
      from: 'uploading',
      to: 'ready',
    },
  ],
  methods: {
    onFetch: async function(fsm, url = null) {
      console.log();
      console.log(chalk`{grey STATE:} {magenta fetching...}`);
      const fetchUrl = url ? url : makeJawboneUrl(this.type);
      console.log(chalk`{grey URL:} {underline ${fetchUrl}}`);
      const { next, xids } = await fetchTopLevel(fetchUrl);
      const data = await Promise.all(
        xids.map(fetchDetails.bind(null, this.type))
      );
      return { data, next };
    },
    onProcess: async function(fsm, data) {
      console.log();
      console.log(chalk`{grey STATE:} {cyan processing...}`);
      return data;
    },
    onUpload: async function(fsm, data) {
      console.log();
      console.log(chalk`{grey STATE:} {blue uploading...}`);
      return true;
    },
    onNext: function() {
      console.log();
      console.log(chalk`{grey STATE:} {green ready!}`);
    },
  },
});

async function fetchSequence(fsm, data) {
  const processed = await fsm.process(data);
  const uploaded = await fsm.upload(processed);
  if (uploaded) {
    fsm.next();
  } else {
    throw new Error('Error uploading!');
  }
}

exports.handler = async function throttledFetch({ interval, type }) {
  const fsm = new FetchMachine({ type });
  let next = null;

  const timer = setInterval(async function() {
    console.log();
    console.log(chalk`⏲️  {grey TICK} ⏲️`);
    if (fsm.is('ready')) {
      const results = await fsm.fetch(next);
      next = results.next;
      fetchSequence(fsm, results.data);
    } else {
      clearInterval(timer);
      process.exit(1);
    }
  }, interval);

  // initial fetch
  const results = await fsm.fetch();
  next = results.next;
  fetchSequence(fsm, results.data);
};

exports.command = 'fetch <type>';

exports.describe = 'fetch Jawbone UP data of a particular <type>';

exports.builder = yargs => {
  return yargs
    .positional('type', {
      describe: `Jawbone datatype from: ${supportedTypes.join(', ')}`,
      type: 'string',
    })
    .option('interval', {
      alias: 'i',
      default: 1e4,
    });
};
