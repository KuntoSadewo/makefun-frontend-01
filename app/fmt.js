// Presentation helpers: turning raw API values into readable text.
// Kept dependency-free and tiny; every function is pure.

// Escape a value for interpolation into HTML markup.
export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// A USD amount as $1,325 or $0.50 — whole dollars stay whole, cents show.
export function usd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const cents = Number.isInteger(n) ? 0 : 2;
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: cents, maximumFractionDigits: cents });
}

// A count with thousands separators, e.g. 12,305.
export function count(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US') : '0';
}

// An ISO timestamp as a UTC date and time, e.g. "17 Nov 2026, 12:30 UTC".
export function when(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  return day + ', ' + time + ' UTC';
}

// Human time remaining until an ISO deadline: "3d 2h left", "Ends soon", "Closed".
export function remaining(iso, now = Date.now()) {
  const ms = new Date(iso).getTime() - now;
  if (!Number.isFinite(ms)) return '';
  if (ms <= 0) return 'Closed';
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days >= 2) return days + 'd left';
  if (days === 1) return '1d ' + hours + 'h left';
  if (hours >= 1) return hours + 'h ' + minutes + 'm left';
  if (minutes >= 1) return minutes + 'm left';
  return 'Ends soon';
}

// Whether a bounty still takes entries: its deadline decides, not its status
// field, which can keep reading "open" until results are published.
export function accepting(bounty, now = Date.now()) {
  if (bounty.acceptingSubmissions === false) return false;
  return new Date(bounty.deadline).getTime() > now;
}

// A judge win-rate stored in micro units (0..1,000,000) as a percentage.
export function winRate(micro) {
  const n = Number(micro);
  if (!Number.isFinite(n)) return '—';
  return (n / 10000).toFixed(1) + '%';
}

// Minimal, safe Markdown for bounty descriptions and rules: the text is
// escaped first, then a small set of block and inline shapes is restored.
// Supports headings, bold, inline code, bullet lists, numbered lists,
// paragraphs and bare links to make.fun pages.
export function prose(markdown) {
  const lines = String(markdown ?? '').split('\n');
  const out = [];
  let list = null;
  const closeList = () => {
    if (list) { out.push('</' + list + '>'); list = null; }
  };
  const inline = (text) => esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https:\/\/make\.fun[^)\s]*)\)/g, '<a href="$2" rel="noopener">$1</a>');
  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (heading) {
      closeList();
      const level = Math.min(heading[1].length + 1, 4);
      out.push('<h' + level + '>' + inline(heading[2]) + '</h' + level + '>');
    } else if (bullet || numbered) {
      const kind = bullet ? 'ul' : 'ol';
      if (list !== kind) { closeList(); out.push('<' + kind + '>'); list = kind; }
      out.push('<li>' + inline((bullet || numbered)[1]) + '</li>');
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList();
      out.push('<p>' + inline(line) + '</p>');
    }
  }
  closeList();
  return out.join('\n');
}
