const admin = require('firebase-admin');
const path = require('path');

const nefelionCollections = require('./constants/nefelionCollections');

exports.handler = function({ account, databaseUrl, collection }) {
  admin.initializeApp({
    credential: admin.credential.cert(
      require(path.resolve(__dirname, `../${account}`))
    ),
    databaseURL: databaseUrl,
  });

  const db = admin.firestore();

  db
    .collection(collection)
    .get()
    .then(snapshot => {
      let count = 0;
      snapshot.forEach(doc => {
        count++;
      });
      console.log(`\n${count} items in collection <${collection}>\b`);
      process.exit(0);
    });
};

exports.command = 'count <collection>';

exports.describe =
  'count uploaded ☁️ nefelion data in a particular <collection>';

exports.builder = yargs => {
  return yargs
    .positional('collection', {
      describe: `☁️ nefelion collection from: ${nefelionCollections.join(
        ', '
      )}`,
      type: 'string',
      choices: nefelionCollections,
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
