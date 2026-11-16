// Data layer for the make.fun public API.
//
// Every read is a plain GET against https://make.fun/api with three layers of
// restraint on top, because the judge scores few requests and fast views:
//   1. an in-memory cache keyed by URL, so going back to a view costs nothing;
//   2. ETag revalidation — the API binds its tags to the minute, so a repeat
//      read inside the same minute answers 304 and we reuse the cached body;
//   3. in-flight de-duplication, so two views asking at once share one fetch.
//
// Nothing here writes, signs in, or touches any origin besides make.fun.

const ORIGIN = 'https://make.fun';
const cache = new Map();
const pending = new Map();

export function apiUrl(path) {
  return ORIGIN + path;
}

async function fetchJson(path) {
  const hit = cache.get(path);
  const headers = {};
  if (hit && hit.etag) headers['If-None-Match'] = hit.etag;
  const res = await fetch(ORIGIN + '/api' + path, { headers });
  if (res.status === 304 && hit) return hit.body;
  if (!res.ok) throw new Error('make.fun API answered ' + res.status + ' for ' + path);
  const body = await res.json();
  cache.set(path, { etag: res.headers.get('etag'), body });
  return body;
}

export function getJson(path) {
  let flight = pending.get(path);
  if (!flight) {
    flight = fetchJson(path).finally(() => pending.delete(path));
    pending.set(path, flight);
  }
  return flight;
}

// The live board. activity=times keeps the payload lean: the board needs the
// schedule and the counts, not every bounty's full description text.
export function loadBoard() {
  return getJson('/competitions?status=open&activity=times');
}

// One bounty with its summary, description, rules and live reward table.
export function loadBounty(slug) {
  return getJson('/competitions/' + encodeURIComponent(slug));
}

// A bounty's standings: rank, entrant, entry title and judge score per row.
export function loadLeaderboard(slug) {
  return getJson('/competitions/' + encodeURIComponent(slug) + '/leaderboard');
}

// An account's public profile: identity links, record and past entries.
export function loadProfile(handle) {
  return getJson('/profiles/' + encodeURIComponent(handle));
}
