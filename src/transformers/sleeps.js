const _ = require('lodash');
const moment = require('moment');

function convertSecToMs(seconds) {
  return moment.duration(seconds, 'seconds').asMilliseconds();
}

const codesToPhaseName = {
  1: 'awake',
  2: 'light',
  3: 'deep',
};

module.exports = {
  processSleeps: function processSleeps(data) {
    return data.map(sleep => {
      const reshaped = {
        type: 'sleep',
        source: 'jawbone',
        id: sleep.xid,
        date: moment(_.get(sleep, 'date'), 'YYYYMMDD').format('YYYY-MM-DD'),
        start: moment.unix(sleep.details.asleep_time).toISOString(),
        end: moment.unix(sleep.details.awake_time).toISOString(),
        timezone: sleep.details.tz,
        value: convertSecToMs(sleep.details.duration),
        awakenings: sleep.details.awakenings,
        awake: convertSecToMs(sleep.details.awake),
        deep: convertSecToMs(sleep.details.deep),
        light: convertSecToMs(sleep.details.light),
        rem: convertSecToMs(sleep.details.rem),
        phases: sleep.ticks.map(tick => ({
          start: moment.unix(tick.time).toISOString(),
          phase: codesToPhaseName[tick.depth],
        })),
      };

      return reshaped;
    });
  },
};
