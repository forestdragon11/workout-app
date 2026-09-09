let plans = [];
let exercises = [];
let sessions = [];

function save() {
  localStorage.setItem('data', JSON.stringify({ plans, exercises, sessions }));
}

function load() {
  const stored = localStorage.getItem('data');
  if (stored === null) return;
  const data = JSON.parse(stored);
  plans = data.plans;
  exercises = data.exercises;
  sessions = data.sessions;
}

function parentView(v) {
  if (v.name === 'log') {
    const ex = exercises.find(e => e.id === v.exerciseId);
    return { name: 'plan', planId: v.fromPlanId ?? ex.planIds[0] };
  }
  return { name: 'plans' };
  if (v.name === 'history') return { name: 'plan', planId: v.fromPlanId };
  if (v.name === 'addPlan') return { name: 'plans' };
  if (v.name === 'addExercise') return { name: 'plan', planId: v.fromPlanId };

}

function savePlan() {
  const form = document.querySelector('.form');
  const name = form.querySelector('[name="name"]').value.trim();
  if (!name) { showToast('Please enter a name.'); return; }

  plans.push({
    id: plans.length === 0 ? 1 : Math.max(...plans.map(p => p.id)) + 1,
    name,
    gapDays: Number(form.querySelector('[name="gapDays"]').value) || 1,
  });

  save();
  view = { name: 'plans' };
  render();
  showToast('Plan created.');
}

function saveExercise() {
  const form = document.querySelector('.form');
  const name = form.querySelector('[name="name"]').value.trim();
  if (!name) { showToast('Please enter a name.'); return; }

  const checked = form.querySelectorAll('[name="plan"]:checked');
  const planIds = [...checked].map(cb => Number(cb.value));

  exercises.push({
    id: exercises.length === 0 ? 1 : Math.max(...exercises.map(e => e.id)) + 1,
    name,
    kind: form.querySelector('[name="kind"]').value,
    isRoutine: form.querySelector('[name="isRoutine"]').checked,
    planIds,
  });

  save();
  view = { name: 'plan', planId: view.fromPlanId };
  render();
  showToast('Exercise created.');
}

// --- toast ---

const toast = document.querySelector('#toast');

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2000);
}

// --- helpers ---


function daysSince(timestamp) {
  if (timestamp === null) return null;
  return Math.floor((Date.now() - timestamp) / 86400000);
}

function agoText(days) {
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    return `${days} days ago`;
}


function lastDoneForPlan(planId) {
  const exerciseIds = exercises
    .filter(e => e.planIds.includes(planId))
    .map(e => e.id);
    
  const times = sessions
    .filter(s => exerciseIds.includes(s.exerciseId))
    .map(s => s.at);

  if (times.length === 0) return null;
  return Math.max(...times);
}

function sessionsForExercise(exerciseId) {
  return sessions.filter(s => s.exerciseId === exerciseId);
}

function lastDoneForExercise(exerciseId) {
  const times = sessionsForExercise(exerciseId).map(s => s.at);
  if (times.length === 0) return null;
  return Math.max(...times);
}


  function statusText(plan) {
    const days = daysSince(lastDoneForPlan(plan.id));
    if (days === null) return 'Not started yet';
    if (days === 0) return 'Done today'; 
    if (days >= plan.gapDays) return `Due now, ${agoText(days)}`;
    return `Last done ${agoText(days)}`;
} 

function field(labelText, name, type, value = '') {
  const wrap = document.createElement('label');
  wrap.className = 'field';

  const span = document.createElement('span');
  span.textContent = labelText;

  const input = document.createElement('input');
  input.type = type;
  input.name = name;
  if (value !== '') input.value = value;

  wrap.append(span, input);
  return wrap;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function saveSession() {
  const ex = exercises.find(e => e.id === view.exerciseId);
  const form = document.querySelector('.form');

  const get = (name) => form.querySelector(`[name="${name}"]`);

  const session = {
    id: sessions.length === 0 ? 1 : Math.max(...sessions.map(s => s.id)) + 1,
    exerciseId: ex.id,
    at: dateStringToTimestamp(get('date').value),
    notes: get('notes').value,
  };

  if (ex.kind === 'timed') {
    session.duration = Number(get('duration').value);
  }

  if (ex.kind === 'unloaded' || ex.kind === 'loaded') {
    session.sets = Number(get('sets').value);
    session.reps = Number(get('reps').value);
  }

  if (ex.kind === 'loaded') {
    session.load = Number(get('load').value);
  }

  if (ex.isRoutine) {
    session.completedWhole = get('completedWhole').checked;
  }

  sessions.push(session);
  save();

  view = { name: 'plan', planId: view.fromPlanId ?? ex.planIds[0] };
  render();

  showToast('Session logged. Well done.');
}

function dateStringToTimestamp(str) {
  const [year, month, day] = str.split('-').map(Number);
  return new Date(year, month - 1, day, 12).getTime();
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function sessionDetail(s, ex) {
  if (ex.kind === 'timed') return `${s.duration} min`;
  const unit = ex.isRoutine ? 'rounds' : 'reps';
  const setsPart = s.sets ? `${s.sets} × ` : '';
  if (ex.kind === 'loaded') return `${s.load} kg · ${setsPart}${s.reps} ${unit}`;
  const whole = ex.isRoutine && !s.completedWhole ? ' (partial)' : '';
  return `${setsPart}${s.reps} ${unit}${whole}`;
}

// --- render ---
const app = document.querySelector('#app');

let view = { name: 'plans' };

function render() {
  app.innerHTML = '';
  if (view.name === 'plans') renderPlanList();
  if (view.name === 'plan')  renderPlanDetail();
  if (view.name === 'log') renderLogForm();
  if (view.name === 'history') renderHistory();
  if (view.name === 'addPlan') renderAddPlan();
  if (view.name === 'addExercise') renderAddExercise();
}

function renderPlanList() {
  const addBtn = document.createElement('button');
  addBtn.textContent = '+';
  addBtn.className = 'add-btn';
  app.append(addBtn);
  for (const plan of plans) {
    const card = document.createElement('div');
    card.className = 'plan';
    card.dataset.planId = plan.id;

    const title = document.createElement('h2');
    title.textContent = plan.name;

    const status = document.createElement('p');
    status.textContent = statusText(plan);

    const days = daysSince(plan.lastDone);
    if (days !== null && days >= plan.gapDays) {
      card.classList.add('due');
    }

    card.append(title, status);
    app.append(card);
  }
}

function renderPlanDetail() {
  const plan = plans.find(p => p.id === view.planId);
  const list = exercises.filter(e => e.planIds.includes(plan.id));

  const back = document.createElement('button');
  back.textContent = '← Back';
  back.className = 'back-btn';

  const title = document.createElement('h2');
  title.textContent = plan.name;
  
  const addBtn = document.createElement('button');
  addBtn.textContent = '+';
  addBtn.className = 'add-ex-btn';

  app.append(addBtn);
  app.append(back, title);

for (const ex of list) {
  const card = document.createElement('div');
  card.className = 'exercise';
  card.dataset.exerciseId = ex.id;

  const name = document.createElement('h3');
  name.textContent = ex.name;

  const meta = document.createElement('p');
  const count = sessionsForExercise(ex.id).length;
  const days = daysSince(lastDoneForExercise(ex.id));
  meta.textContent = days === null
        ? 'No sessions yet'
      : `Last done ${agoText(days)} · ${count} session${count === 1 ? '' : 's'}`;
  const logBtn = document.createElement('button');
  logBtn.textContent = 'Log session';
  logBtn.className = 'log-btn';
 
  card.append(name, meta, logBtn);
  app.append(card);
}
}

function renderLogForm() {
  const ex = exercises.find(e => e.id === view.exerciseId);

  const back = document.createElement('button');
  back.textContent = '← Back';
  back.className = 'back-btn';

  const title = document.createElement('h2');
  title.textContent = `Log: ${ex.name}`;

  const form = document.createElement('div');
  form.className = 'form';

  form.append(field('Date', 'date', 'date', todayString()));

  if (ex.kind === 'timed') {
    form.append(field('Duration (minutes)', 'duration', 'number'));
  }

  if (ex.kind === 'unloaded' || ex.kind === 'loaded') {
  form.append(field('Sets', 'sets', 'number'));
  form.append(field(ex.isRoutine ? 'Rounds' : 'Reps', 'reps', 'number'));
  }


  if (ex.kind === 'loaded') {
    form.append(field('Load (kg)', 'load', 'number'));
  }

  if (ex.isRoutine) {
    form.append(field('Completed whole routine', 'completedWhole', 'checkbox'));
  }

  form.append(field('Notes', 'notes', 'text'));

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save session';
  saveBtn.className = 'save-btn';

  app.append(back, title, form, saveBtn);
}

function renderHistory() {
  const ex = exercises.find(e => e.id === view.exerciseId);

  const back = document.createElement('button');
  back.textContent = '← Back';
  back.className = 'back-btn';

  const title = document.createElement('h2');
  title.textContent = ex.name;

  app.append(back, title);

  const list = [...sessionsForExercise(ex.id)].sort((a, b) => b.at - a.at);

  if (list.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No sessions logged yet.';
    app.append(empty);
    return;
  }

  for (const s of list) {
    const row = document.createElement('div');
    row.className = 'session';
    row.dataset.sessionId = s.id;

    const main = document.createElement('div');
    main.className = 'session-main';
    main.textContent = `${formatDate(s.at)} · ${sessionDetail(s, ex)}`;

    row.append(main);

    if (s.notes) {
      const noteBtn = document.createElement('button');
      noteBtn.textContent = 'Note';
      noteBtn.className = 'note-btn';

      const note = document.createElement('p');
      note.className = 'session-note';
      note.textContent = s.notes;

      row.append(noteBtn, note);
    }

    app.append(row);
  }
}

function renderAddPlan() {
  const back = document.createElement('button');
  back.textContent = '← Back';
  back.className = 'back-btn';

  const title = document.createElement('h2');
  title.textContent = 'New plan';

  const form = document.createElement('div');
  form.className = 'form';
  form.append(field('Plan name', 'name', 'text'));
  form.append(field('Days between sessions', 'gapDays', 'number'));

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save plan';
  saveBtn.className = 'save-plan-btn';

  app.append(back, title, form, saveBtn);
}

function renderAddExercise() {
  const back = document.createElement('button');
  back.textContent = '← Back';
  back.className = 'back-btn';

  const title = document.createElement('h2');
  title.textContent = 'New exercise';

  const form = document.createElement('div');
  form.className = 'form';
  form.append(field('Exercise name', 'name', 'text'));

  const kindWrap = document.createElement('label');
  kindWrap.className = 'field';
  const kindLabel = document.createElement('span');
  kindLabel.textContent = 'Type';
  const kindSelect = document.createElement('select');
  kindSelect.name = 'kind';
  for (const [value, label] of [
    ['timed', 'Timed (duration)'],
    ['unloaded', 'Reps only'],
    ['loaded', 'Reps with weight'],
  ]) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    kindSelect.append(opt);
  }
  kindWrap.append(kindLabel, kindSelect);
  form.append(kindWrap);

  form.append(field('Is a routine (multiple exercises)', 'isRoutine', 'checkbox'));

  const plansWrap = document.createElement('div');
  plansWrap.className = 'field';
  const plansLabel = document.createElement('span');
  plansLabel.textContent = 'Belongs to plans';
  plansWrap.append(plansLabel);

  for (const p of plans) {
    const row = document.createElement('label');
    row.className = 'checkbox-row';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.name = 'plan';
    cb.value = p.id;
    if (p.id === view.fromPlanId) cb.checked = true;
    const span = document.createElement('span');
    span.textContent = p.name;
    row.append(cb, span);
    plansWrap.append(row);
  }
  form.append(plansWrap);

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save exercise';
  saveBtn.className = 'save-exercise-btn';

  app.append(back, title, form, saveBtn);
}

app.addEventListener('click', (e) => {

  if (e.target.matches('.add-btn')) {
  view = { name: 'addPlan' };
  render();
  return;
}

if (e.target.matches('.add-ex-btn')) {
  view = { name: 'addExercise', fromPlanId: view.planId };
  render();
  return;
}

if (e.target.matches('.save-plan-btn')) { savePlan(); return; }
if (e.target.matches('.save-exercise-btn')) { saveExercise(); return; }
  if (e.target.matches('.save-btn')) {
  saveSession();
  return;
  }
  
 if (e.target.matches('.back-btn')) {
  view = parentView(view);
  render();
  return;
}

    if (e.target.matches('.log-btn')) {
  const card = e.target.closest('.exercise');
  view = {
  name: 'log',
  exerciseId: Number(card.dataset.exerciseId),
  fromPlanId: view.planId,
  };
  render();
  return;
  }

  if (e.target.matches('.note-btn')) {
  e.target.closest('.session').classList.toggle('open');
  return;
}

const exCard = e.target.closest('.exercise');
if (exCard) {
  view = { name: 'history', exerciseId: Number(exCard.dataset.exerciseId), fromPlanId: view.planId };
  render();
  return;
}

  const planCard = e.target.closest('.plan');
  if (planCard) {
    view = { name: 'plan', planId: Number(planCard.dataset.planId) };
    render();
    return;
  }


});


function logSession(planId) {
  const exercise = exercises.find(e => e.planIds.includes(planId));
  if (!exercise) return;

  const id = sessions.length === 0 ? 1 : Math.max(...sessions.map(s => s.id)) + 1;
  sessions.push({ id, exerciseId: exercise.id, at: Date.now(), notes: '' });

  save();
  render();
}

if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist();
}

load();
render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}