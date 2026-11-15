// SQL fragments shared by repositories. Constant column names only: never pass user input here.

// json_build_object renders timestamptz as "2026-11-14 23:00:00+00"; this keeps the ISO format
// pg gives Date columns elsewhere ("2026-11-14T23:00:00.000Z"), which clients sort as strings
export const isoTimestamp = (column: string): string =>
  `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

// Same, for a nullable column
export const isoTimestampOrNull = (column: string): string =>
  `CASE WHEN ${column} IS NULL THEN NULL ELSE ${isoTimestamp(column)} END`;

// The event summary nested in tickets and payments (alias of public.events must be "e")
export const EVENT_SUMMARY_JSON = `json_build_object(
  'id', e.id, 'title', e.title, 'venueName', e.venue_name, 'address', e.address,
  'status', e.status, 'imageUrl', e.image_url,
  'startsAt', ${isoTimestamp('e.starts_at')}, 'endsAt', ${isoTimestampOrNull('e.ends_at')}
)`;
