const _ = require('lodash');
const moment = require('moment');

module.exports = {
  processStepsTicks: function processStepsTicks({ data }) {
    let processed = [];

    data.forEach(summary => {
      const timezones = _.get(summary, 'details.tzs', []);
      const { ticks } = summary;
      processed = processed.concat(
        ticks.map(interval => {
          const timezoneTuple = _.find(timezones, (tup, i, tzs) => {
            return (
              interval.time >= tup[0] &&
              // 32503708800000 is '3000-01-01'
              interval.time < _.get(tzs, [i + 1, 0], 32503708800)
            );
          });
          return {
            type: 'steps',
            source: 'jawbone',
            id: summary.xid,
            start: new Date(interval.time).valueOf(),
            end: new Date(interval.time_completed).valueOf(),
            timezone: timezoneTuple[1],
            value: interval.steps,
          };
        })
      );
    });

    return processed;
  },
  processStepsSummaries: function processStepsSummaries({ data }) {
    return data.map(summary => ({
      type: 'stepsSummary',
      source: 'jawbone',
      id: summary.xid,
      date: moment(_.get(summary, 'date'), 'YYYYMMDD').format('YYYY-MM-DD'),
      value: _.get(summary, 'details.steps'),
      timezones: _.get(summary, 'details.tzs'),
      hourlyTotals: _.mapKeys(
        _.mapValues(
          _.get(summary, 'details.hourly_totals', []),
          hourSummary => {
            return hourSummary.steps;
          }
        ),
        (hourSummary, key) => {
          return moment(key, 'YYYYMMDDHH').format('H');
        }
      ),
      timezone: _.get(summary, 'details.tz'),
    }));
  },
};
