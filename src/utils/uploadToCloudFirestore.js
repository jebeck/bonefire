const _ = require('lodash');
const admin = require('firebase-admin');

const serviceAccount = require('../../jawbone-3fc6da7beabf.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://jawbone-884b1.firebaseio.com',
});

const db = admin.firestore();

module.exports = function uploadToCloudFirestore(uploads) {
  const commits = [];

  uploads.forEach(({ collection, data }) => {
    const collectionRef = db.collection(collection);

    let chunks = [data];

    /** the Cloud Firestore can only accept batches of <= 500 */
    if (data.length > 500) {
      chunks = _.chunk(data, 500);
    }

    chunks.forEach(data => {
      const batch = db.batch();

      data.forEach(d => {
        if (d.id) {
          batch.set(collectionRef.doc(d.id), d);
        } else {
          throw new Error(`💥  Datum ${JSON.stringify(d)} without an id.`);
        }
      });

      commits.push(batch.commit());
    });
  });

  return commits;
};
