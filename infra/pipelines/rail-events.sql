SELECT
  id,
  source,
  topic,
  type,
  occurredAt,
  ingestedAt,
  serviceKey,
  trainRunKey,
  stationKey,
  payloadVersion,
  payload,
  DATE(ingestedAt) AS event_date
FROM rail_events_stream;
