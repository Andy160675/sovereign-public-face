/** Pure, versioned decision rules. No model, network, storage or payment effects. */
export const RULES_VERSION = '2026-10-05.1';
export const MAX_QUESTIONS = 7;

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export const OFFERS = freeze({
  snapshot: { id: 'snapshot', label: 'Free snapshot', priceMinor: 0, currency: 'GBP', purchasable: false },
  teardown: { id: 'teardown', label: 'Teardown', priceMinor: 25000, currency: 'GBP', purchasable: false },
  signal_audit: { id: 'signal_audit', label: 'Signal Audit', priceMinor: 75000, currency: 'GBP', purchasable: false },
});

const SEGMENTS = freeze({
  enquiries: {
    label: 'Missed enquiries',
    outcome: 'Find where enquiries stop becoming useful conversations.',
    check: 'Review a small sample of recent enquiries. Record when each arrived, the first response, follow-up and outcome. Keep contact details out of this brief.',
  },
  admin: {
    label: 'Repetitive admin',
    outcome: 'Find the repeatable work that is worth simplifying.',
    check: 'Time one repeatable task from start to finish. Record the steps, handoffs and rework before choosing anything to automate.',
  },
  quality: {
    label: 'Inconsistent work',
    outcome: 'Find where the same job produces different results.',
    check: 'Compare a few examples of the same job. Record the expected result, what differed and which decisions need a person.',
  },
  unknown: {
    label: 'Problem not yet established',
    outcome: 'Start with one real example, not an automation purchase.',
    check: 'Choose one recent job that felt slow, frustrating or unreliable. Note what happened, what you expected and what you would like to change.',
  },
});

const problemOptions = [
  ['enquiries', 'Enquiries are being missed or left waiting'],
  ['admin', 'Repeat admin takes too much time'],
  ['quality', 'Work is inconsistent or needs redoing'],
  ['unknown', 'I am not sure yet'],
];
function question(id, title, hint, options) {
  return freeze({ id, title, hint, options: options.map(([id, label]) => ({ id, label })) });
}
const QUESTIONS = freeze({
  pain: question('pain', 'What needs fixing first?', 'Choose the problem you recognise. There is no right answer.', problemOptions),
  clarify: question('clarify', 'Which sounds closest to a recent problem?', 'Not sure is a useful answer too. We can stop and suggest what to observe.', problemOptions),
  enquiries_detail: question('enquiries_detail', 'Where do enquiries get stuck?', 'Choose the stage you have actually noticed.', [
    ['reply', 'The first reply takes too long'], ['follow_up', 'Follow-up is missed'],
    ['booking', 'Booking or the next step is unclear'], ['unknown', 'I have not identified the stage'],
  ]),
  admin_detail: question('admin_detail', 'Which work keeps coming back?', 'Choose one task rather than the whole business.', [
    ['rekey', 'Copying or re-entering information'], ['report', 'Preparing recurring reports or updates'],
    ['schedule', 'Scheduling and coordination'], ['unknown', 'I have not identified the task'],
  ]),
  quality_detail: question('quality_detail', 'Where does work become inconsistent?', 'Choose the issue you can point to in real work.', [
    ['handoff', 'Information is lost between people'], ['checks', 'Checks or follow-through are missed'],
    ['instructions', 'Instructions are unclear or inconsistent'], ['unknown', 'I have not identified the cause'],
  ]),
  frequency: question('frequency', 'How often does this happen?', 'This describes the problem; it is not a savings estimate.', [
    ['daily', 'Most days'], ['weekly', 'Most weeks'], ['monthly', 'About monthly'], ['unknown', 'I have not checked'],
  ]),
  evidence: question('evidence', 'What evidence do you already have?', 'We do not verify it in this questionnaire. Do not upload personal or customer data.', [
    ['measured', 'I have timings, counts or other measurements'],
    ['examples', 'I can point to specific examples'], ['none', 'It is a suspicion rather than something checked'],
  ]),
  scope: question('scope', 'How much work is involved?', 'This helps us avoid recommending more work than you need.', [
    ['one', 'One task or process'], ['several', 'Several connected processes'], ['unknown', 'I am not sure yet'],
  ]),
  help: question('help', 'What kind of help would be useful?', 'These are options to review, not a checkout. Choosing an option does not place an order.', [
    ['free', 'A free starting point I can use myself'],
    ['focused', 'Consider a focused Teardown (£250)'],
    ['audit', 'Consider a broader Signal Audit (£750)'],
    ['unknown', 'Help me understand the problem first'],
  ]),
});

function next(values) {
  if (!values.pain) return QUESTIONS.pain;
  if (values.pain === 'unknown' && !values.clarify) return QUESTIONS.clarify;
  const segment = values.pain === 'unknown' ? values.clarify : values.pain;
  if (segment === 'unknown') return null;
  for (const id of [`${segment}_detail`, 'frequency', 'evidence', 'scope', 'help']) {
    if (!values[id]) return QUESTIONS[id];
  }
  return null;
}

/** Validate the entire ordered transcript, not just the last answer. */
function validate(answers) {
  if (!Array.isArray(answers) || answers.length > MAX_QUESTIONS) {
    throw new TypeError('Answers must be an array of at most seven entries.');
  }
  const values = Object.create(null);
  for (const entry of answers) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(entry))
      || Reflect.ownKeys(entry).length !== 2
      || !Object.hasOwn(entry, 'questionId') || !Object.hasOwn(entry, 'optionId')) {
      throw new TypeError('Each answer must contain only questionId and optionId.');
    }
    const current = next(values);
    if (!current) throw new RangeError('The diagnostic is already complete.');
    if (entry.questionId !== current.id) throw new RangeError('Unexpected question or stale answer.');
    if (!current.options.some(option => option.id === entry.optionId)) throw new RangeError('Invalid option.');
    values[current.id] = entry.optionId;
  }
  return values;
}

/** @param {{questionId: string, optionId: string}[]} answers */
export function getQuestion(answers) {
  return next(validate(answers));
}

/** Returns a new transcript. Untrusted answers can never choose an arbitrary route. */
export function answer(answers, questionId, optionId) {
  const current = getQuestion(answers);
  if (!current) throw new RangeError('The diagnostic is already complete.');
  if (questionId !== current.id) throw new RangeError('Unexpected question.');
  if (!current.options.some(option => option.id === optionId)) throw new RangeError('Invalid option.');
  return [...answers.map(entry => ({ ...entry })), { questionId, optionId }];
}

/** Keeps entries before index, clearing every dependent answer. */
export function rewind(answers, index) {
  validate(answers);
  if (!Number.isInteger(index) || index < 0 || index > answers.length) throw new RangeError('Invalid rewind index.');
  return answers.slice(0, index).map(entry => ({ ...entry }));
}

function recommend(values, segment) {
  if (segment === 'unknown') return ['snapshot', 'The problem is not yet established. Start with a free snapshot rather than buying a review.'];
  if (!['focused', 'audit'].includes(values.help)) return ['snapshot', 'You asked for a free starting point or more clarity, so no paid review is recommended.'];
  if (values[`${segment}_detail`] === 'unknown' || values.frequency === 'unknown'
      || values.evidence === 'none' || values.scope === 'unknown') {
    return ['snapshot', 'There is not yet enough specific information to justify a paid review. Gather an example and start free.'];
  }
  if (values.help === 'audit' && values.scope === 'several' && values.evidence === 'measured') {
    return ['signal_audit', 'You requested a broader review of several connected processes and report having measurements. A Signal Audit is an option to discuss, not a confirmed order.'];
  }
  return ['teardown', 'A focused review of one priority is the smaller next step supported by your answers. A broader audit is not needed yet.'];
}

/** Builds a deterministic, unsigned brief. It is not an order or verified audit. */
export function getResult(answers) {
  const values = validate(answers);
  if (next(values)) throw new RangeError('Complete the diagnostic before requesting a result.');
  const id = values.pain === 'unknown' ? values.clarify : values.pain;
  const segment = SEGMENTS[id];
  const [offerId, reason] = recommend(values, id);
  return {
    schemaVersion: '1.0.0', rulesVersion: RULES_VERSION,
    status: 'recommendation_only', receiptType: 'unsigned_user_brief',
    segment: { id, label: segment.label, basis: 'self_reported', validation: 'provisional' },
    outcome: segment.outcome, suggestedCheck: segment.check,
    recommendation: { ...OFFERS[offerId], reason },
    answers: answers.map(entry => ({ ...entry,
      question: QUESTIONS[entry.questionId].title,
      answer: QUESTIONS[entry.questionId].options.find(option => option.id === entry.optionId).label,
    })),
    evidence: { source: 'answers', verification: 'unverified', confidence: null },
    verifiedSavingsMinor: null,
    quality: { status: 'not_assessed', score: null, independentReview: 'pending' },
    externalEffects: [],
  };
}
