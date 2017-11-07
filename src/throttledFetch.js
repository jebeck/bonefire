const _ = require('lodash');
const chalk = require('chalk');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const StateMachine = require('javascript-state-machine');

const fetchDetails = require('./utils/fetchDetails');
const fetchTopLevel = require('./utils/fetchTopLevel');
const makeJawboneUrl = require('./utils/makeJawboneUrl');
const supportedTypes = require('./constants/supportedTypes');

const {
  processStepsSummaries,
  processStepsTicks,
} = require('./transformers/steps');

const processorsByType = {
  steps: {
    data: processStepsTicks,
    summaries: processStepsSummaries,
  },
};

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
      const { next, summaries, xids } = await fetchTopLevel(fetchUrl);
      const ticks = await Promise.all(
        xids.map(fetchDetails.bind(null, this.type))
      );
      /** combine top-level and high-resolution data by xid */
      const data = summaries.map((summary, i) => {
        const newSummary = { ...summary };
        if (ticks[i].xid === summary.xid) {
          newSummary.ticks = ticks[i].data || [];
        }
        return newSummary;
      });
      return { data, next };
    },
    onProcess: function(fsm, results) {
      const { data } = results;
      this.fetched = this.fetched.concat(data);
      /** when number of fetches
       * (i.e., fetched.length / 10 because of ?limit=10 on each fetch)
       * is > the configured batchSize,
       * dump data fetched so far to a JSON file and clear fetched */
      if (this.fetched.length / 10 >= this.batchSize) {
        console.log();
        console.log(
          chalk`{grey STATE:} {grey ...dumping a batch of fetched data to JSON file...}`
        );
        fs.writeFile(
          path.resolve(
            __dirname,
            `../data/lastXid=${this.fetched[this.fetched.length - 1].xid}.json`
          ),
          JSON.stringify(this.fetched, null, 2),
          err => {
            if (err) {
              console.error(
                `Write file failed at ${this.fetched[this.fetched.length - 1]
                  .xid} 😭`
              );
              return process.exit(1);
            }
            this.fetched = [];
            return;
          }
        );
      }
      console.log();
      console.log(
        chalk`{grey # of XIDs fetched =} {yellow ${this.fetched.length}}`
      );
      console.log();
      console.log(chalk`{grey STATE:} {cyan processing...}`);
      const processed = {};
      /** here's where we're *actually* processing the data! */
      Object.keys(processorsByType[this.type]).forEach(key => {
        processed[key] = processorsByType[this.type][key](results);
      });
      return processed;
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

async function postFetch(fsm, results) {
  const processed = fsm.process(results);
  const uploaded = await fsm.upload(processed);
  if (uploaded) {
    fsm.next();
  } else {
    throw new Error('Error uploading!');
  }
}

exports.handler = async function throttledFetch({ batchSize, interval, type }) {
  const fsm = new FetchMachine({ batchSize, fetched: [], type });
  let next = null;

  const timer = setInterval(async function() {
    console.log();
    console.log(chalk`⏲️  {grey TICK} ⏲️`);
    if (fsm.is('ready')) {
      const results = await fsm.fetch(next);
      next = results.next;
      postFetch(fsm, results);
    } else {
      clearInterval(timer);
      console.warn(`Timed out during ${next ? next : 'initial'} fetch 😢`);
      process.exit(1);
    }
  }, interval);

  // initial fetch
  const results = await fsm.fetch();
  next = results.next;
  postFetch(fsm, results);
};

exports.command = 'fetch <type>';

exports.describe = 'fetch Jawbone UP data of a particular <type>';

exports.builder = yargs => {
  return yargs
    .positional('batchSize', {
      alias: 'b',
      default: 100,
      describe: 'Number of fetches to batch in JSON dumps.',
      type: 'number',
    })
    .positional('type', {
      describe: `Jawbone datatype from: ${supportedTypes.join(', ')}`,
      type: 'string',
    })
    .option('interval', {
      alias: 'i',
      default: 1e4,
    });
};
