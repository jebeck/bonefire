const _ = require('lodash');
const fetch = require('node-fetch');

const checkStatus = require('./checkStatus');
const supportedTypes = require('../constants/supportedTypes');

module.exports = function fetchTopLevel(url) {
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.JAWBONE_OAUTH_TOKEN}`,
    },
  })
    .then(checkStatus)
    .then(resp => resp.json())
    .then(({ data }) => {
      const xids = [];
      data.items.forEach(item => {
        xids.push(item.xid);
      });
      return {
        summaries: data.items,
        xids,
        next: `https://jawbone.com${_.get(data, ['links', 'next'])}`,
      };
    })
    .catch(err => {
      throw new Error(err);
    });
};
