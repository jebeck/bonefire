const fetch = require('node-fetch');

const checkStatus = require('./checkStatus');
const makeJawboneUrl = require('./makeJawboneUrl');

module.exports = function fetchDetails(type, xid) {
  return fetch(makeJawboneUrl(type, 'details', xid), {
    headers: {
      Authorization: `Bearer ${process.env.JAWBONE_OAUTH_TOKEN}`,
    },
  })
    .then(checkStatus)
    .then(resp => resp.json())
    .then(({ data: { items } }) => {
      return { data: items, xid };
    })
    .catch(err => {
      throw new Error(err);
    });
};
