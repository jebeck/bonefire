## Jawbone data transformers

This directory contains the modules to transform raw Jawbone API data into
simplified data for storage in the
[Cloud Firestore](https://firebase.google.com/docs/firestore/ "Firebase: Cloud Firestore").
These transformers represent @jebeck's opinions on what's most valuable in the
Jawbone data, and you may disagree and wish to write alternative transformers.
In such a case, you may find the transformers here useful as examples.

### heartrates

Jawbone UP provides a single resting heartrate (RHR) (measured just before
waking) per day at the `/heartrates` endpoint. Since these RHR events are
point-in-time, unlike steps or sleeps intervals, they are very simple to model.

```json
{
  "type": "restingHeartrate",
  "source": "jawbone",
  "id": <jawbone xid>,
  "date": <ISO 8601 date>,
  "timezone": <IANA timezone name>,
  "value": <integer>
}
```

The `time_created` and `time_updated` fields, given as epoch timestamps
according to the
[Jawbone UP Developer documentation](https://jawbone.com/up/developer/endpoints/heartrate "UP for Developers: heartrates")
do not seem to correspond in my data to times before waking; my theory is that
they are instead times when the Jawbone app determined which of a collection of
heartrate measurements constituted the pre-waking "resting heartrate" and stored
or updated it. Thus, these values are just metadata and not that interesting or
useful, so I've dropped them and preserved only the timezone-adjusted `date` of
the resting heartrate measurement.

### steps

#### high-resolution

The high-resolution data provided at `/moves/:id/ticks` is what interests me
most. Each "tick" or interval is delimited by start and end epoch timestamps,
and that's all I could ever really want, so the transformed data model is pretty
simple.

```json
{
  "type": "steps",
  "source": "jawbone",
  "id": <uuid (v4)>,
  "parent": <jawbone daily steps summary xid>,
  "start": <ISO 8601 Zulu datetime>,
  "end": <ISO 8601 Zulu datetime>,
  "timezone": <IANA timezone name>,
  "value": <integer>
}
```

Both `start` and `end` here are
[ISO 8601](https://en.wikipedia.org/wiki/ISO_8601 "Wikipedia: ISO 8601")-formatted
timestamps in Zulu/UTC. This is a conversion from the epoch timestamps the
Jawbone API provides, but has the benefits of being both reliably
string-sortable _and_ human-readable. The `timezone` for each tick is determined
via the `details.tzs` array provided on the top-level `/moves` objects
summarizing each date (see next section). The step count itself is stored under
`value` since the object already identifies its `type` as "steps." Finally, the
`source` of the data ("jawbone") and the `xid` from the Jawbone daily summary
are stored (the latter as `parent`) along with a generated uniqued identifier
`id` to provide data provenance and auditability.

#### summary by date

Jawbone has actually done a _great_ job in their data model of summarizing steps
data by date, including when a person changes timezones in the course of a
single calendar day. This summary by date is what's available at the pageable
`/moves` endpoint. So while my primary interest is in UTC-anchored continuous
timeline data, I've decided to preserve Jawbone's summaries by date as well.

```json
{
  "type": "stepsSummary",
  "source": "jawbone",
  "id": <jawbone xid>,
  "date": <ISO 8601 date>,
  "value": <integer>,
  "timezones": [{ "start": <ISO 8601 Zulu datetime>, "timezone": <IANA timezone name> }],
  "hourlyTotals": { 0: <integer>, ..., 23: <integer> },
  "timezone": <IANA timezone name>,
}
```

Here the summarized `date` is given in ISO 8601 format. The total steps for the
summarized date is stored in `value`. The hourly breakdowns are given in an
object with keys ranging from 0 to 23; only hours that have non-zero totals are
included. Finally, Jawbone's determination of the primary `timezone` for the day
and all applicable timezones (along with the ISO 8601 Zulu timestamp of when
that timezone was entered) are preserved in `timezone` and `timezones`,
respectively. Jawbone provides the `timezones` as an array of arrays, but the
Cloud Firestore cannot store arrays of arrays, so I've converted the each array
of arrays to an array of objects, each with `start` and `timezone` keys. I only
include the `timezones` property when there _is_ more than one timezone in the
array.
