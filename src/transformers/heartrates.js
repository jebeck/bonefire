const _ = require('lodash');
const moment = require('moment-timezone');

module.exports = {
  processHeartrates: function processHeartrates(data) {
    return _.compact(
      data.map(heartrate => {
        if (heartrate.resting_heartrate) {
          return {
            type: 'restingHeartrate',
            source: 'jawbone',
            id: heartrate.xid,
            date: moment(heartrate.date, 'YYYYMMDD').format('YYYY-MM-DD'),
            timezone: _.get(heartrate, 'details.tz'),
            value: heartrate.resting_heartrate,
          };
        }
        return null;
      })
    );
  },
};
