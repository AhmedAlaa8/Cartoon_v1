/* ================================================================
   The wedding's details — the one place they live. Every countdown,
   date label and the page metadata read from here.
================================================================ */

export const WEDDING = {
  date: '2027-07-30',
  // ⚠ UNCONFIRMED: the start time has not been confirmed yet. 16:00 is the value the site
  // has always used, kept only so the countdown keeps working. When the time is known,
  // replace it here and set timeConfirmed to true.
  time: '16:00',
  timeConfirmed: false,
  // the countdown runs on the venue's clock, whatever the guest's own time zone
  timeZone: 'Africa/Cairo',
  dateLabelAr: '٣٠ يوليو ٢٠٢٧',
  dateLabel: '30 يوليو 2027',
  venue: {
    name: 'Eventa',
    city: 'المنصورة',
    country: 'مصر',
    mapsUrl: 'https://www.google.com/maps/place/Eventa+Hall/@31.050818,31.3892001,17z/data=!3m1!4b1!4m6!3m5!1s0x14f79d60cf452201:0x2b567806180f472f!8m2!3d31.0508134!4d31.3866252!16s%2Fg%2F11lgn3hy6q',
  },
};

// how far a time zone is ahead of UTC at a given instant (DST-aware, via the platform's tz data)
function zoneOffsetMs(utcMs, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const v = Object.fromEntries(parts.map(p => [p.type, Number(p.value)]));
  return Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second) - utcMs;
}

// a wall-clock date + time in `timeZone` → the instant (ms since epoch)
export function zonedInstant(date, time, timeZone) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  const first = wall - zoneOffsetMs(wall, timeZone);
  return wall - zoneOffsetMs(first, timeZone);     // second pass settles a DST edge
}

export const weddingInstant = () => zonedInstant(WEDDING.date, WEDDING.time, WEDDING.timeZone);
