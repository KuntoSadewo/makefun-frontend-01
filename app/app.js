// Potluck — a lean make.fun frontend.
//
// Four surfaces, each with its own hash route and reachable by links:
//   #/                              the live bounty board
//   #/bounty/<slug>                 one bounty's page
//   #/bounty/<slug>/leaderboard    that bounty's standings
//   #/u/<handle>                    an account's public profile
//
// Views render into one <main> element and swap in place; navigation never
// reloads the page. window.__shotReady flips false when a route starts and
// true once its data is on screen, so screenshot tooling can wait for it.

import { loadBoard, loadBounty, loadLeaderboard, loadProfile, apiUrl } from './api.js';
import { esc, usd, count, when, remaining, accepting, winRate, prose } from './fmt.js';

const view = document.getElementById('view');
const PAGE = 24;

let routeToken = 0;

function setTitle(text) {
  document.title = text ? text + ' · Potluck — make.fun frontend' : 'Potluck — make.fun frontend';
}

function loading(label) {
  view.innerHTML = '<p class="notice" role="status">' + esc(label) + '</p>';
}

function failed(err) {
  view.innerHTML = '<div class="notice error"><h1>Something went wrong</h1><p>'
    + esc(err && err.message ? err.message : String(err))
    + '</p><p><a href="#/">Back to the board</a></p></div>';
  window.__shotReady = true;
}

// A live countdown chip: the text refreshes from its data-deadline attribute
// once a minute without any network traffic or DOM rebuild.
function countdownChip(iso, extraClass) {
  return '<span class="chip time ' + (extraClass || '') + '" data-deadline="' + esc(iso) + '">'
    + esc(remaining(iso)) + '</span>';
}

function tickCountdowns() {
  const now = Date.now();
  for (const el of view.querySelectorAll('[data-deadline]')) {
    el.textContent = remaining(el.getAttribute('data-deadline'), now);
  }
}
setInterval(tickCountdowns, 30000);

// ---------------------------------------------------------------- board

function bountyCard(b) {
  const open = accepting(b);
  const fee = b.entryFeeUsd ? '<span class="chip fee">' + esc(usd(b.entryFeeUsd)) + ' entry fee</span>' : '';
  const state = open ? countdownChip(b.deadline) : '<span class="chip closed">Closed</span>';
  return '<article class="card">'
    + '<div class="card-top"><span class="pot">' + esc(usd(b.potUsd ?? b.rewardAmount)) + '</span>' + state + '</div>'
    + '<h2 class="card-title"><a href="#/bounty/' + encodeURIComponent(b.slug) + '">' + esc(b.title) + '</a></h2>'
    + '<p class="card-meta">' + esc(b.category || '') + ' · ' + count(b.submissionCount) + ' entries</p>'
    + '<div class="card-chips">' + fee
    + '<span class="chip">Deadline ' + esc(when(b.deadline)) + '</span></div>'
    + '</article>';
}

async function renderBoard(token) {
  setTitle('');
  loading('Loading live bounties…');
  const data = await loadBoard();
  if (token !== routeToken) return;
  const items = (data.items || []).slice().sort((a, b2) => {
    const openDiff = Number(accepting(b2)) - Number(accepting(a));
    if (openDiff) return openDiff;
    return new Date(a.deadline) - new Date(b2.deadline);
  });
  let shown = PAGE;
  let query = '';
  const visible = () => items.filter((b) => {
    if (!query) return true;
    const hay = (b.title + ' ' + (b.category || '') + ' ' + b.slug).toLowerCase();
    return hay.includes(query);
  });
  const paint = () => {
    const list = visible();
    const slice = list.slice(0, shown);
    const totalPot = items.reduce((sum, b) => sum + (Number(b.potUsd) || 0), 0);
    view.innerHTML = '<section class="hero"><h1>Live bounties on make.fun</h1>'
      + '<p>' + items.length + ' open competitions · ' + esc(usd(totalPot)) + ' in live pots. '
      + 'Rewards, entry fees and time left update from the public API.</p>'
      + '<p><label class="filter-label" for="filter">Filter bounties</label> '
      + '<input id="filter" class="filter" type="search" placeholder="Type to filter by title or category…" value="' + esc(query) + '"></p></section>'
      + (list.length
        ? '<div class="grid">' + slice.map(bountyCard).join('') + '</div>'
        : '<p class="notice">No live bounty matches that filter.</p>')
      + (shown < list.length
        ? '<p class="center"><button class="more" id="more" type="button">Show more bounties</button></p>'
        : '');
    const btn = document.getElementById('more');
    if (btn) btn.addEventListener('click', () => { shown += PAGE; paint(); });
    const input = document.getElementById('filter');
    if (input) input.addEventListener('input', () => {
      // Rebuild only the grid, keeping the input (and its focus) untouched.
      query = input.value.trim().toLowerCase();
      shown = PAGE;
      const listNow = visible();
      const grid = view.querySelector('.grid');
      const html = listNow.slice(0, shown).map(bountyCard).join('');
      if (grid) grid.innerHTML = html;
      else paint();
    });
    window.__shotReady = true;
  };
  paint();
}

// ---------------------------------------------------------------- bounty

function rewardRows(b) {
  const rows = b.rewardsNow && b.rewardsNow.length
    ? b.rewardsNow
    : Object.entries(b.rewards || {}).map(([place, amount]) => ({ place, baseUsd: amount, feeShareUsd: 0, amountUsd: amount }));
  return rows.map((r) => '<tr><td>#' + esc(r.place) + '</td><td>' + esc(usd(r.baseUsd))
    + '</td><td>' + esc(usd(r.feeShareUsd || 0)) + '</td><td class="strong">' + esc(usd(r.amountUsd)) + '</td></tr>').join('');
}

async function renderBounty(token, slug) {
  loading('Loading bounty…');
  const b = await loadBounty(slug);
  if (token !== routeToken) return;
  setTitle(b.title);
  const open = accepting(b);
  const feeLine = b.entryFeeUsd
    ? '<div><dt>Entry fee</dt><dd>' + esc(usd(b.entryFeeUsd)) + ' · paid by ' + count(b.entryFeePayers) + ' entrants</dd></div>'
    : '';
  view.innerHTML = '<p class="crumbs"><a href="#/">← All bounties</a> · '
    + '<a href="#/bounty/' + encodeURIComponent(slug) + '/leaderboard">Leaderboard</a></p>'
    + '<header class="bounty-head"><h1>' + esc(b.title) + '</h1>'
    + '<p class="summary">' + esc(b.summary || '') + '</p>'
    + '<div class="stat-row">'
    + '<div class="stat"><span class="stat-label">Live pot</span><span class="stat-value pot">' + esc(usd(b.potUsd ?? b.rewardAmount)) + '</span></div>'
    + '<div class="stat"><span class="stat-label">Entries</span><span class="stat-value">' + count(b.submissionCount) + '</span></div>'
    + '<div class="stat"><span class="stat-label">Time left</span><span class="stat-value" data-deadline="' + esc(b.deadline) + '">' + esc(remaining(b.deadline)) + '</span></div>'
    + '</div></header>'
    + '<dl class="facts">'
    + '<div><dt>Status</dt><dd>' + esc(b.status || '') + (open ? ' · still accepting entries' : ' · entries closed') + '</dd></div>'
    + feeLine
    + '<div><dt>Deadline</dt><dd>' + esc(when(b.deadline)) + ' (' + esc(remaining(b.deadline)) + ')</dd></div>'
    + '<div><dt>Opened</dt><dd>' + esc(when(b.opensAt || b.publishedAt)) + '</dd></div>'
    + '<div><dt>Category</dt><dd>' + esc(b.category || '—') + '</dd></div>'
    + '<div><dt>Sponsor</dt><dd>' + esc((b.sponsor && b.sponsor.name) || '—') + '</dd></div>'
    + (b.skills && b.skills.length ? '<div><dt>Skills</dt><dd>' + b.skills.map(esc).join(', ') + '</dd></div>' : '')
    + '</dl>'
    + '<h2>Rewards — live pot split</h2>'
    + '<table class="rewards"><thead><tr><th>Place</th><th>Base</th><th>Fee share</th><th>Pays now</th></tr></thead>'
    + '<tbody>' + rewardRows(b) + '</tbody></table>'
    + '<p class="center"><a class="button" href="#/bounty/' + encodeURIComponent(slug) + '/leaderboard">See the leaderboard</a></p>'
    + '<h2>About this bounty</h2><div class="prose">' + prose(b.description) + '</div>'
    + (b.rules ? '<h2>Rules</h2><div class="prose">' + prose(b.rules) + '</div>' : '');
  window.__shotReady = true;
}

// ---------------------------------------------------------------- leaderboard

function standingRow(e) {
  const avatar = e.image
    ? '<img class="avatar" crossorigin="anonymous" alt="" loading="lazy" src="' + esc(apiUrl(e.image.startsWith('/') ? e.image : '/' + e.image)) + '">'
    : '';
  const score = e.values && e.values.judge != null ? winRate(e.values.judge) : (e.display && e.display.judge ? esc(e.display.judge) : '—');
  return '<tr><td class="rank">#' + esc(e.rank ?? '') + '</td>'
    + '<td><a class="who" href="#/u/' + encodeURIComponent(e.handle || '') + '">' + avatar + '<span>@' + esc(e.handle || '') + '</span></a></td>'
    + '<td class="entry-title">' + esc(e.title || '') + '</td>'
    + '<td class="strong">' + score + '</td>'
    + '<td>' + esc(e.status || '') + '</td></tr>';
}

async function renderLeaderboard(token, slug) {
  loading('Loading leaderboard…');
  const [board, data] = await Promise.all([loadBounty(slug), loadLeaderboard(slug)]);
  if (token !== routeToken) return;
  setTitle('Leaderboard — ' + board.title);
  const entries = data.entries || [];
  let shown = 50;
  const paint = () => {
    view.innerHTML = '<p class="crumbs"><a href="#/">← All bounties</a> · <a href="#/bounty/'
      + encodeURIComponent(slug) + '">Bounty page</a></p>'
      + '<h1>Leaderboard</h1><p class="summary">' + esc(board.title) + ' — ' + entries.length
      + ' ranked entries · live pot ' + esc(usd(board.potUsd ?? board.rewardAmount)) + ' · '
      + esc(remaining(board.deadline)) + '</p>'
      + '<table class="standings"><thead><tr><th>Rank</th><th>Entrant</th><th>Entry</th><th>Judge win rate</th><th>Status</th></tr></thead>'
      + '<tbody>' + entries.slice(0, shown).map(standingRow).join('') + '</tbody></table>'
      + (shown < entries.length
        ? '<p class="center"><button class="more" id="more" type="button">Show more entries</button></p>'
        : '');
    const btn = document.getElementById('more');
    if (btn) btn.addEventListener('click', () => { shown += 50; paint(); });
    window.__shotReady = true;
  };
  paint();
}

// ---------------------------------------------------------------- profile

function solutionRow(s) {
  const c = s.competition || {};
  const place = s.placement ? ' · placed #' + esc(s.placement) : '';
  const prize = s.prize_usd && Number(s.prize_usd) > 0 ? ' · won ' + esc(usd(s.prize_usd)) : '';
  const score = s.score && s.score.display && s.score.display !== 'n/a' ? ' · score ' + esc(s.score.display) : '';
  return '<li class="solution"><a href="#/bounty/' + encodeURIComponent(c.slug || '') + '">' + esc(s.title || c.title || '') + '</a>'
    + '<span class="solution-meta"> in ' + esc(c.title || '') + ' (' + esc(usd(c.reward_usd)) + ' bounty)' + place + prize + score
    + ' · entered ' + esc(when(s.entered_at)) + '</span></li>';
}

async function renderProfile(token, handle) {
  loading('Loading profile…');
  const p = await loadProfile(handle);
  if (token !== routeToken) return;
  setTitle('@' + p.handle);
  const name = p.display_name || p.handle;
  const picture = p.avatar || p.image;
  const avatar = picture
    ? '<img class="avatar big" crossorigin="anonymous" alt="" src="' + esc(picture.startsWith('http') ? picture : apiUrl(picture)) + '">'
    : '';
  const record = p.record || {};
  const links = [];
  if (p.github_login) links.push('<a href="https://github.com/' + encodeURIComponent(p.github_login) + '" rel="noopener">GitHub @' + esc(p.github_login) + '</a>');
  if (p.x && p.x.username) links.push('<a href="' + esc(p.x.url || ('https://x.com/' + p.x.username)) + '" rel="noopener">X @' + esc(p.x.username) + '</a>');
  if (p.wallet && p.wallet.address) links.push('<a href="' + esc(p.wallet.explorer_url || '#') + '" rel="noopener">Wallet ' + esc(p.wallet.address.slice(0, 6)) + '…' + esc(p.wallet.address.slice(-4)) + '</a>');
  const stats = [
    ['Entered', record.competitions_entered], ['Placed', record.competitions_placed],
    ['Won', record.competitions_won], ['Podiums', record.podium_finishes],
    ['Best place', record.best_placement ? '#' + record.best_placement : '—'], ['Prizes', usd(record.prize_usd || 0)],
  ];
  view.innerHTML = '<p class="crumbs"><a href="#/">← All bounties</a></p>'
    + '<header class="profile-head">' + avatar + '<div><h1>' + esc(name) + '</h1>'
    + '<p class="summary">@' + esc(p.handle) + ' · joined ' + esc(when(p.joined_at)) + '</p>'
    + (p.bio ? '<p>' + esc(p.bio) + '</p>' : '')
    + (links.length ? '<p class="links">' + links.join(' · ') + '</p>' : '')
    + '</div></header>'
    + '<div class="stat-row">' + stats.map(([label, value]) =>
      '<div class="stat"><span class="stat-label">' + esc(label) + '</span><span class="stat-value">' + esc(value ?? 0) + '</span></div>').join('') + '</div>'
    + '<h2>Entries</h2>'
    + ((p.solutions && p.solutions.length)
      ? '<ul class="solutions">' + p.solutions.map(solutionRow).join('') + '</ul>'
      : '<p class="notice">No entries yet.</p>');
  window.__shotReady = true;
}

// ---------------------------------------------------------------- router

async function route() {
  const token = ++routeToken;
  window.__shotReady = false;
  const hash = location.hash || '#/';
  try {
    const bountyMatch = hash.match(/^#\/bounty\/([^/]+)\/leaderboard\/?$/);
    const pageMatch = hash.match(/^#\/bounty\/([^/]+)\/?$/);
    const profileMatch = hash.match(/^#\/u\/([^/]+)\/?$/);
    if (bountyMatch) await renderLeaderboard(token, decodeURIComponent(bountyMatch[1]));
    else if (pageMatch) await renderBounty(token, decodeURIComponent(pageMatch[1]));
    else if (profileMatch) await renderProfile(token, decodeURIComponent(profileMatch[1]));
    else await renderBoard(token);
  } catch (err) {
    if (token === routeToken) failed(err);
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();
