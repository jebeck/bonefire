## Jawbone data transformers

This directory contains the modules to transform raw Jawbone API data into simplified data for storage in the [Cloud Firestore](https://firebase.google.com/docs/firestore/ 'Firebase: Cloud Firestore'). These transformers represent @jebeck's opinions on what's most valuable in the Jawbone data, and you may disagree and wish to write alternative transformers. In such a case, you may find the transformers here useful as examples.

### steps

#### high-resolution

The high-resolution data provided at `/moves/:id/ticks` is what interests me most. Each "tick" or interval is delimited by start and end epoch timestamps, and that's all I could ever really want, so the transformed data model is pretty simple.

```json
{
  "type": "steps",
  "source": "jawbone",
  "id": "a1b2c3",
  "start": 0,
  "end": 60000,
  "timezone": "US/Pacific",
  "value": 150
}
```

Both `start` and `end` here are hammertimes—that is, epoch timestamps with millisecond resolution (a simple conversion from the normal epoch timestamps returned by the Jawbone API). The `timezone` for each tick is determined via the `details.tzs` array provided on the top-level `/moves` objects summarizing each date (see next section). The step count itself is stored under `value` since the object already identifies its `type` as "steps." Finally, the `source` of the data ("jawbone") and the `jawboneId` are stored to provide data provenance and auditability.

#### summary by date

Jawbone has actually done a *great* job in their data model of summarizing steps data by date, including when a person changes timezones in the course of a single calendar day. This summary by date is what's available at the pageable `/moves` endpoint. So while my primary interest is in UTC-anchored continuous timeline data, I've decided to preserve Jawbone's summaries by date as well.

```json
{
  "type": "stepsSummary",
  "source": "jawbone",
  "id": "a1b2c3",
  "date": "2017-01-01",
  "value": 7500,
  "timezones": [[<hammertime>, <timezoneName>]],
  "hourlyTotals": { 0: <steps> },
  "timezone": <timezoneName>,
}
```

Here the summarized `date` is given in ISO 8601 format. The total steps for the summarized date is stored in `value`. The hourly breakdowns are given in an object with keys ranging from 0 to 23. Finally, Jawbone's determination of the primary `timezone` for the day and all applicable timezones (along with the hammertime of when that timezone was entered) are preserved in `timezone` and `timezones`, respectively.
