import { answer, getQuestion, getResult, rewind, MAX_QUESTIONS } from './engine.mjs';

const $ = id => document.getElementById(id);
const form = $('diagnostic-form');
let answers = [];
let result = null;

function clearMessages() {
  $('error').hidden = true;
  $('error').textContent = '';
  $('status').textContent = '';
}
function showError() {
  $('error').textContent = 'That step could not be completed. Please try again or start again.';
  $('error').hidden = false;
}
function render(focus = false) {
  clearMessages();
  const question = getQuestion(answers);
  form.hidden = !question;
  $('result').hidden = Boolean(question);
  if (!question) {
    result = getResult(answers);
    $('step-count').textContent = 'Your next step';
    $('result-title').textContent = result.segment.label;
    $('result-outcome').textContent = result.outcome;
    $('result-check').textContent = result.suggestedCheck;
    $('offer-name').textContent = result.recommendation.label;
    $('offer-price').textContent = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(result.recommendation.priceMinor / 100);
    $('offer-reason').textContent = result.recommendation.reason;
    $('answer-summary').replaceChildren();
    for (const item of result.answers) {
      const term = document.createElement('dt');
      const detail = document.createElement('dd');
      term.textContent = item.question;
      detail.textContent = item.answer;
      $('answer-summary').append(term, detail);
    }
    if (focus) $('result-title').focus();
    return;
  }
  result = null;
  $('step-count').textContent = `Question ${answers.length + 1} · up to ${MAX_QUESTIONS}`;
  $('question-title').textContent = question.title;
  $('question-hint').textContent = question.hint;
  $('options').replaceChildren();
  for (const option of question.options) {
    const label = document.createElement('label');
    label.className = 'option';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'answer';
    input.value = option.id;
    input.required = true;
    input.setAttribute('aria-describedby', 'question-hint');
    const text = document.createElement('span');
    text.textContent = option.label;
    label.append(input, text);
    $('options').append(label);
  }
  $('back').hidden = answers.length === 0;
  $('next').disabled = true;
  if (focus) $('question-title').focus();
}
form.addEventListener('change', () => {
  $('next').disabled = !form.querySelector('input[name="answer"]:checked');
});
form.addEventListener('submit', event => {
  event.preventDefault();
  const selected = form.querySelector('input[name="answer"]:checked');
  if (!selected) return;
  try {
    answers = answer(answers, getQuestion(answers).id, selected.value);
    render(true);
  } catch { showError(); }
});
$('back').addEventListener('click', () => {
  try { answers = rewind(answers, answers.length - 1); render(true); }
  catch { showError(); }
});
$('restart').addEventListener('click', () => { answers = []; render(true); });
$('download').addEventListener('click', () => {
  if (!result) return;
  let url;
  let link;
  try {
    const brief = { ...getResult(answers), createdAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(brief, null, 2) + '\n'], { type: 'application/json' });
    url = URL.createObjectURL(blob);
    link = document.createElement('a');
    link.href = url;
    link.download = 'vipfish-diagnostic-brief.json';
    document.body.append(link);
    link.click();
    $('status').textContent = 'Brief prepared for download. Nothing has been sent.';
  } catch { showError(); }
  finally {
    link?.remove();
    if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
});
render();
