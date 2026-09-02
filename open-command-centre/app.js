const VIEWS = Object.freeze([
  'NOW',
  'MONEY',
  'BUSINESSES',
  'SALES',
  'PEOPLE',
  'DECISIONS',
  'EVIDENCE',
]);

const REQUIRED_ACTION_KEYS = Object.freeze([
  'id',
  'view',
  'outcome',
  'owner',
  'authority',
  'nextAction',
  'deadline',
  'blocker',
  'state',
  'evidence',
  'escalation',
  'priority',
]);

let feed = null;
let activeView = 'NOW';

const tabs = document.getElementById('tabs');
const summary = document.getElementById('summary');
const view = document.getElementById('view');
const feedState = document.getElementById('feed-state');
const feedNote = document.getElementById('feed-note');
const feedFile = document.getElementById('feed-file');
const resetFeed = document.getElementById('reset-feed');
const exportFeed = document.getElementById('export-feed');

function exactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim() === value && value.length > 0;
}

function validateAction(action) {
  if (!exactKeys(action, REQUIRED_ACTION_KEYS)) return null;
  if (!nonEmpty(action.id) || !/^[A-Z0-9][A-Z0-9-]*$/.test(action.id)) return null;
  if (!VIEWS.includes(action.view)) return null;
  if (!nonEmpty(action.outcome) || !nonEmpty(action.owner)) return null;
  if (!nonEmpty(action.authority) || !nonEmpty(action.nextAction)) return null;
  if (!nonEmpty(action.deadline) || !nonEmpty(action.blocker)) return null;
  if (!nonEmpty(action.state) || !nonEmpty(action.escalation)) return null;
  if (!['P0', 'P1', 'P2', 'P3'].includes(action.priority)) return null;
  if (!Array.isArray(action.evidence) || !action.evidence.every(nonEmpty)) return null;
  return Object.freeze({ ...action, evidence: Object.freeze([...action.evidence]) });
}

function validateFeed(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new Error('Feed must be a JSON object.');
  }
  if (candidate.schemaVersion !== 'open-command-centre.feed.v1') {
    throw new Error('Unsupported feed schema.');
  }
  if (!Array.isArray(candidate.actions)) throw new Error('Feed actions must be an array.');
  const actions = candidate.actions.map(validateAction);
  if (actions.some((action) => action === null)) {
    throw new Error('One or more actions failed the exact action contract.');
  }
  return Object.freeze({
    schemaVersion: candidate.schemaVersion,
    name: nonEmpty(candidate.name) ? candidate.name : 'Loaded feed',
    updatedAt: nonEmpty(candidate.updatedAt) ? candidate.updatedAt : 'UNKNOWN',
    actions: Object.freeze(actions),
  });
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function statusClass(state) {
  return String(state).toLowerCase().replaceAll('_', '-');
}

function field(label, value) {
  const node = element('div', 'field');
  node.append(element('span', '', label), element('strong', '', value));
  return node;
}

function renderCard(action) {
  const card = element('article', 'view-card');
  const top = element('div', 'card-top');
  const heading = element('div');
  heading.append(
    element('span', 'record-id', `${action.priority} · ${action.id}`),
    element('h3', '', action.outcome),
  );
  top.append(heading, element('span', `status ${statusClass(action.state)}`, action.state));

  const grid = element('div', 'grid');
  grid.append(
    field('Owner', action.owner),
    field('Authority', action.authority),
    field('Deadline', action.deadline),
    field('Blocker', action.blocker),
    field('Escalation', action.escalation),
    field('Evidence', action.evidence.length),
  );

  card.append(top, element('p', 'next', `NEXT · ${action.nextAction}`), grid);
  if (action.evidence.length > 0) {
    const evidence = element('div', 'evidence');
    action.evidence.forEach((reference) => evidence.appendChild(element('span', 'token', reference)));
    card.appendChild(evidence);
  }
  return card;
}

function actionsForView(name) {
  if (!feed) return [];
  if (name === 'DECISIONS') {
    return feed.actions.filter((action) => ['RESERVED', 'UNCLEAR'].includes(action.state));
  }
  if (name === 'EVIDENCE') {
    return feed.actions.filter((action) => action.evidence.length > 0);
  }
  return feed.actions.filter((action) => action.view === name);
}

function renderTabs() {
  tabs.replaceChildren();
  VIEWS.forEach((name) => {
    const button = element('button', '', name);
    button.type = 'button';
    button.setAttribute('aria-selected', String(name === activeView));
    button.addEventListener('click', () => {
      activeView = name;
      renderTabs();
      renderView();
    });
    tabs.appendChild(button);
  });
}

function renderSummary() {
  summary.replaceChildren();
  const actions = feed ? feed.actions : [];
  const metrics = [
    ['Admitted', actions.length, 'Exact contract passed'],
    ['P0', actions.filter((action) => action.priority === 'P0').length, 'Highest priority'],
    ['Blocked', actions.filter((action) => action.state === 'BLOCKED').length, 'Needs a real unblocker'],
    ['Decisions', actions.filter((action) => ['RESERVED', 'UNCLEAR'].includes(action.state)).length, 'Human boundary'],
  ];
  metrics.forEach(([label, value, note]) => {
    const card = element('article');
    card.append(element('span', 'eyebrow', label), element('strong', 'metric', value), element('p', '', note));
    summary.appendChild(card);
  });
}

function renderView() {
  view.replaceChildren();
  const records = actionsForView(activeView);
  const head = element('div', 'view-head');
  const title = element('div');
  title.append(element('span', 'eyebrow', activeView), element('h2', '', `${activeView} projection`));
  head.append(title, element('p', '', 'A filtered view of the same admitted queue.'));
  view.appendChild(head);
  if (records.length === 0) {
    view.appendChild(element('div', 'empty', 'No admitted records in this view.'));
    return;
  }
  records.forEach((action) => view.appendChild(renderCard(action)));
}

function applyFeed(candidate, note) {
  feed = validateFeed(candidate);
  feedState.textContent = 'ADMITTED';
  feedNote.textContent = `${feed.name} · updated ${feed.updatedAt} · ${note}`;
  renderSummary();
  renderView();
}

async function loadExample() {
  const response = await fetch('./example-actions.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Example feed failed: HTTP ${response.status}`);
  applyFeed(await response.json(), 'bundled example');
}

feedFile.addEventListener('change', async () => {
  const [file] = feedFile.files;
  if (!file) return;
  try {
    applyFeed(JSON.parse(await file.text()), 'local file');
  } catch (error) {
    feedState.textContent = 'REJECTED';
    feedNote.textContent = error instanceof Error ? error.message : 'Invalid feed.';
  } finally {
    feedFile.value = '';
  }
});

resetFeed.addEventListener('click', () => {
  loadExample().catch((error) => {
    feedState.textContent = 'ERROR';
    feedNote.textContent = error.message;
  });
});

exportFeed.addEventListener('click', () => {
  if (!feed) return;
  const blob = new Blob([JSON.stringify(feed, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'open-command-centre-feed.json';
  link.click();
  URL.revokeObjectURL(url);
});

renderTabs();
loadExample().catch((error) => {
  feedState.textContent = 'ERROR';
  feedNote.textContent = error.message;
  renderSummary();
  renderView();
});
