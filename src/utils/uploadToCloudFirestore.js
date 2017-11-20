const _ = require('lodash');

module.exports = function uploadToCloudFirestore(db, uploads) {
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
