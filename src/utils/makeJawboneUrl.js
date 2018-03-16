const jawboneBaseUrl = 'https://jawbone.com/nudge/api/v.1.1';
const jawboneUserInfix = 'users/@me';

const mapTypesToPaths = {
  sleeps: 'sleeps',
  steps: 'moves',
  heartrates: 'heartrates',
  timezone: 'timezone',
};

module.exports = function makeJawboneUrl(type, level = null, xid = null) {
  switch (type) {
    case 'heartrates':
      return `${jawboneBaseUrl}/${jawboneUserInfix}/${mapTypesToPaths[type]}`;
    case 'sleeps':
      switch (level) {
        case 'details':
          return `${jawboneBaseUrl}/${mapTypesToPaths[type]}/${xid}/ticks`;
        default:
          return `${jawboneBaseUrl}/${jawboneUserInfix}/${
            mapTypesToPaths[type]
          }`;
      }
    case 'steps':
      switch (level) {
        case 'details':
          return `${jawboneBaseUrl}/${mapTypesToPaths[type]}/${xid}/ticks`;
        default:
          return `${jawboneBaseUrl}/${jawboneUserInfix}/${
            mapTypesToPaths[type]
          }`;
      }
    case 'timezone':
      return `${jawboneBaseUrl}/${jawboneUserInfix}/${
        mapTypesToPaths[type]
      }?start_time=0`;
    default:
      return null;
  }
};
