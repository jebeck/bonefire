const admin = require('firebase-admin');
const path = require('path');

const nefelionCollections = require('./constants/nefelionCollections');

exports.handler = function({ account, databaseUrl, type }) {
  admin.initializeApp({
    credential: admin.credential.cert(
      require(path.resolve(__dirname, `../${account}`))
    ),
    databaseURL: databaseUrl,
  });

  const db = admin.firestore();

  db
    .collection(type)
    .get()
    .then(snapshot => {
      let count = 0;
      snapshot.forEach(doc => {
        count++;
      });
      console.log(`\n${count} items in collection <${type}>\b`);
      process.exit(0);
    });
};

exports.command = 'count <type>';

exports.describe = 'count uploaded ☁️ nefelion data of a particular <type>';

exports.builder = yargs => {
  return yargs
    .positional('type', {
      describe: `☁️ nefelion datatype from: ${nefelionCollections.join(', ')}`,
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
