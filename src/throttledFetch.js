const _ = require('lodash');
const chalk = require('chalk');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const StateMachine = require('javascript-state-machine');

const dumpJSONToFile = require('./utils/dumpJSONToFile');
const fetchDetails = require('./utils/fetchDetails');
const fetchTopLevel = require('./utils/fetchTopLevel');
const makeJawboneUrl = require('./utils/makeJawboneUrl');
const supportedTypes = require('./constants/supportedTypes');
const uploadToCloudFirestore = require('./utils/uploadToCloudFirestore');

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

const collectionsByType = {
  steps: {
    data: 'steps',
    summaries: 'stepsSummaries',
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
    onFetch: async function(fsm) {
      console.log();
      console.log(chalk`{grey STATE:} {magenta fetching...}`);
      let fetchUrl;
      try {
        fetchUrl = JSON.parse(
          fs.readFileSync(path.resolve(__dirname, '../next.json'))
        ).next;
      } catch (e) {
        if (e.message.search(/ENOENT: no such file or directory/) !== -1) {
          fetchUrl = makeJawboneUrl(this.type);
        }
      }
      console.log(chalk`{grey URL:} {underline ${fetchUrl}}`);
      const { next, summaries, xids } = await fetchTopLevel(fetchUrl);
      this.nextUrl = next;
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
      return data;
    },
    onProcess: function(fsm, data) {
      this.fetched = this.fetched.concat(data);
      /** when number of fetches
       * (i.e., fetched.length / 10 because of ?limit=10 on each fetch)
       * is > the configured batchSize,
       * dump data fetched so far to a JSON file and clear fetched */
      if (this.fetched.length / 10 >= this.batchSize || !this.nextUrl) {
        console.log();
        console.log(
          chalk`{grey STATE:} {grey ...dumping a batch of fetched data to JSON file...}`
        );
        dumpJSONToFile(
          this.fetched,
          path.resolve(
            __dirname,
            `../data/lastXid=${this.fetched[this.fetched.length - 1].xid}.json`
          ),
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
      const processed = [];
      /** here's where we're *actually* processing the data! */
      Object.keys(processorsByType[this.type]).forEach(key => {
        processed.push({
          collection: collectionsByType[this.type][key],
          data: processorsByType[this.type][key](data),
        });
      });
      return processed;
    },
    onUpload: async function(fsm, data) {
      console.log();
      console.log(chalk`{grey STATE:} {blue uploading...}`);
      await Promise.all(uploadToCloudFirestore(data)).catch(err => {
        console.log(
          chalk`\n{grey ABORT:}💥  {red Error uploading }💥\n\n{grey MESSAGE:} {white ${err.message}}\n`
        );
        process.exit(1);
      });
      return true;
    },
    onLeaveUploading: function(fsm) {
      if (!this.nextUrl) {
        console.log(chalk`\n{grey DONE:} No next URL; finished! 😎\n`);
        process.exit(0);
      }
      dumpJSONToFile(
        { next: this.nextUrl },
        path.resolve(__dirname, `../next.json`),
        err => {
          if (err) {
            console.error(`Failed to record next URL in a JSON dump 😭`);
            return process.exit(1);
          }
          this.nextUrl = null;
          return;
        }
      );
    },
    onNext: function() {
      console.log();
      console.log(chalk`{grey STATE:} {green ready!}`);
    },
  },
});

async function postFetch(fsm, data) {
  const processed = fsm.process(data);
  const uploaded = await fsm.upload(processed);
  if (uploaded) {
    fsm.next();
  }
}

exports.handler = async function throttledFetch({
  batchSize,
  limit,
  interval,
  type,
}) {
  const fsm = new FetchMachine({ batchSize, fetched: [], nextUrl: null, type });
  let i = 1;

  const timer = setInterval(async function() {
    console.log();
    console.log(chalk`⏲️  {grey TICK} ⏲️`);
    if (fsm.is('ready')) {
      if (!limit || i < limit) {
        const data = await fsm.fetch();
        i += 1;
        postFetch(fsm, data);
      } else {
        clearInterval(timer);
        console.warn(
          chalk`\n{grey ABORT:} Exceeded configured fetch limit of ${limit}.\n`
        );
        process.exit(1);
      }
    } else {
      clearInterval(timer);
      console.warn(`\nTimed out during ${next ? next : 'initial'} fetch 😢\n`);
      process.exit(1);
    }
  }, interval);

  // initial fetch
  const data = await fsm.fetch();
  postFetch(fsm, data);
};

exports.command = 'fetch <type>';

exports.describe = 'fetch Jawbone UP data of a particular <type>';

exports.builder = yargs => {
  return yargs
    .positional('type', {
      describe: `Jawbone datatype from: ${supportedTypes.join(', ')}`,
      type: 'string',
    })
    .option('batchSize', {
      alias: 'b',
      default: 100,
      describe: 'Number of fetches to batch in JSON dumps',
      type: 'number',
    })
    .option('limit', {
      alias: 'l',
      describe: 'Stop after this many top-level fetches',
      type: 'number',
    })
    .option('interval', {
      alias: 'i',
      default: 1e4,
      describe: 'Interval between top-level fetches',
    });
};
