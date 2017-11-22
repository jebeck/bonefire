const _ = require('lodash');
const chalk = require('chalk');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const StateMachine = require('javascript-state-machine');
const winston = require('winston');

const dumpJSONToFile = require('./utils/dumpJSONToFile');
const fetchDetails = require('./utils/fetchDetails');
const fetchTopLevel = require('./utils/fetchTopLevel');
const makeJawboneUrl = require('./utils/makeJawboneUrl');
const supportedTypes = require('./constants/supportedTypes');
const uploadToCloudFirestore = require('./utils/uploadToCloudFirestore');

const logger = winston.createLogger({
  level: 'verbose',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.logstash()
  ),
  transports: [new winston.transports.File({ filename: 'bonefire.log' })],
});

const typesWithTicks = {
  heartrates: false,
  steps: true,
};

const { processHeartrates } = require('./transformers/heartrates');

const {
  processStepsSummaries,
  processStepsTicks,
} = require('./transformers/steps');

const processorsByType = {
  heartrates: {
    data: processHeartrates,
  },
  steps: {
    data: processStepsTicks,
    summaries: processStepsSummaries,
  },
};

const collectionsByType = {
  heartrates: {
    data: 'restingHeartrates',
  },
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
      try {
        this.fetchUrl = JSON.parse(
          fs.readFileSync(path.resolve(__dirname, '../next.json'))
        ).next;
      } catch (e) {
        if (e.message.search(/ENOENT: no such file or directory/) !== -1) {
          this.fetchUrl = makeJawboneUrl(this.type);
        }
      }
      console.log(chalk`{grey URL:} {underline ${this.fetchUrl}}`);
      logger.info(`Fetching ${this.fetchUrl}`);
      const { next, summaries, xids } = await fetchTopLevel(this.fetchUrl);
      this.nextUrl = next;
      if (typesWithTicks[this.type]) {
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
      } else {
        return summaries;
      }
    },
    onProcess: function(fsm, data) {
      this.fetched = this.fetched.concat(data);
      console.log();
      console.log(
        chalk`{grey # of XIDs fetched =} {yellow ${this.fetched.length}}`
      );
      console.log();
      console.log(chalk`{grey STATE:} {cyan processing...}`);
      logger.info('Processing latest batch of fetched data...');
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
      logger.info('Uploading processed data to the Cloud Firestore...');
      await Promise.all(uploadToCloudFirestore(this.db, data)).catch(err => {
        console.log(
          chalk`\n{grey ABORT:}💥  {red Error uploading }💥\n\n{grey MESSAGE:} {white ${err.message}}\n`
        );
        logger.error(`Error uploading: ${err.message}`);
        process.exit(1);
      });
      return true;
    },
    onLeaveUploading: function(fsm) {
      logger.debug(`Next URL is ${this.nextUrl}`);
      if (this.nextUrl === 'undefined') {
        console.log(chalk`\n{grey DONE:} No next URL; finished! 😎\n`);
        logger.info('No next URL; finished!');
        process.exit(0);
      }
      dumpJSONToFile(
        { next: this.nextUrl },
        path.resolve(__dirname, `../next.json`),
        err => {
          if (err) {
            console.error('Failed to record next URL in a JSON dump 😭');
            logger.error('Failed to record next URL in a JSON dump 😭');
            process.exit(1);
          }
          this.nextUrl = null;
          return;
        }
      );
    },
    onNext: function() {
      console.log();
      console.log(chalk`{grey STATE:} {green ready!}`);
      logger.info('Ready for next set of fetches!');
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
  account,
  batchSize,
  databaseUrl,
  limit,
  interval,
  type,
}) {
  admin.initializeApp({
    credential: admin.credential.cert(
      require(path.resolve(__dirname, `../${account}`))
    ),
    databaseURL: databaseUrl,
  });

  const db = admin.firestore();
  const fsm = new FetchMachine({
    batchSize,
    fetchUrl: null,
    db,
    fetched: [],
    nextUrl: null,
    type,
  });
  let i = 1;

  const timer = setInterval(async function() {
    console.log();
    console.log(chalk`⏲️  {grey TICK} ⏲️`);
    logger.verbose('Interval tick');
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
        logger.warn(`Exceeded configured fetch limit of ${limit}`);
        process.exit(1);
      }
    } else {
      clearInterval(timer);
      const timeoutMsg = `Timed out during ${
        fsm.fetchUrl ? fsm.fetchUrl : 'initial'
      } fetch`;
      console.warn(`\n${timeoutMsg}\n`);
      logger.error(timeoutMsg);
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
      choices: supportedTypes,
    })
    .option('interval', {
      alias: 'i',
      default: 2e4,
      describe: 'Interval between top-level fetches',
    })
    .option('limit', {
      alias: 'l',
      describe: 'Stop after this many top-level fetches',
      type: 'number',
    })
    .option('account', {
      alias: 'a',
      demandOption: true,
      describe: 'Path to Firebase service account JSON',
      type: 'string',
    })
    .option('databaseUrl', {
      alias: 'd',
      demandOption: true,
      describe: 'Cloud Firestore database URL',
      type: 'string',
    });
};
