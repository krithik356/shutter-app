
function getUtcDateForTimezone(year, month, day, hour, minute, timezone) {
  const dateUtc = new Date(Date.UTC(year, month, day, hour, minute, 0));
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(dateUtc);
  const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));

  const fYear = parseInt(partMap.year, 10);
  const fMonth = parseInt(partMap.month, 10) - 1;
  const fDay = parseInt(partMap.day, 10);
  const fHour = parseInt(partMap.hour, 10) % 24;
  const fMinute = parseInt(partMap.minute, 10);

  const fDateUtc = Date.UTC(fYear, fMonth, fDay, fHour, fMinute, 0);
  const offset = fDateUtc - dateUtc.getTime();

  const targetUtcTime = Date.UTC(year, month, day, hour, minute, 0) - offset;
  return new Date(targetUtcTime);
}

console.log('Asia/Kolkata:', getUtcDateForTimezone(2026, 6, 18, 23, 15, 'Asia/Kolkata').toISOString());
console.log('America/New_York:', getUtcDateForTimezone(2026, 6, 18, 23, 15, 'America/New_York').toISOString());
console.log('UTC:', getUtcDateForTimezone(2026, 6, 18, 23, 15, 'UTC').toISOString());
