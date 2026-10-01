const STORAGE_KEY = "proof.app.v1";
const COLORS = ["#aacb62", "#70a9ce", "#ee9a64", "#d58d9c", "#89b6a2"];
const todayKey = () => new Date().toLocaleDateString("en-CA");
const dayKey = (offset) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toLocaleDateString("en-CA");
};
const prettyDate = (date = new Date()) => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(date);
const shortDay = (date) => new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
const defaultState = () => {
  const checkins = {};
  [-4, -3, -2, -1].forEach((offset, index) => { checkins[dayKey(offset)] = ["A solid start to the week.", "Got through my reading list.", "Moved my body and cleared my head.", "Back on track after a slow day."][index]; });
  const activity = [55, 110, 35, 90, 70, 125, 0].map((minutes, index) => ({ date: dayKey(index - 6), minutes, hour: [18, 16, 20, 17, 19, 15, 0][index] }));
  return {
    account: null,
    user: null,
    goals: [
      { id: "study", title: "Study for midterms", category: "Study", target: 120, unit: "min", progress: 45, progressDate: todayKey(), color: COLORS[0] },
      { id: "move", title: "Move your body", category: "Wellbeing", target: 1, unit: "session", progress: 0, progressDate: todayKey(), color: COLORS[1] },
      { id: "assignment", title: "Finish lab assignment", category: "Coursework", target: 3, unit: "steps", progress: 1, progressDate: todayKey(), color: COLORS[2] }
    ],
    checkins,
    activity,
    challenges: [
      { id: "sprint", title: "7-day study streak", detail: "Show up for 25 minutes a day", days: 7, joined: true, progress: 4, people: ["JD", "MK", "AS", "RL"], kind: "STUDY SPRINT" },
      { id: "move-together", title: "Move more, together", detail: "Get outside 4 times this week", days: 7, joined: false, progress: 2, people: ["MK", "AS", "RL"], kind: "WELLBEING" }
    ],
    session: { remaining: 25 * 60, endAt: null, goalId: "study", duration: 25 }
  };
};

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultState();
    const parsed = JSON.parse(saved);
    return { ...defaultState(), ...parsed, account: parsed.account || parsed.user || null, session: { ...defaultState().session, ...parsed.session } };
  } catch {
    return defaultState();
  }
}

let state = loadState();
let currentView = "today";
let toastTimer;
const viewRoot = document.querySelector("#viewRoot");
const dialog = document.querySelector("#appDialog");

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { showToast("Your changes could not be saved on this device."); }
}

function streakCount() {
  let count = 0;
  let cursor = state.checkins[todayKey()] ? 0 : -1;
  while (state.checkins[dayKey(cursor)]) { count += 1; cursor -= 1; }
  return count;
}

function resetExpiredGoalProgress() {
  const today = todayKey();
  let changed = false;
  state.goals.forEach((goal) => {
    if (goal.progressDate && goal.progressDate !== today) goal.progress = 0;
    if (goal.progressDate !== today) {
      goal.progressDate = today;
      changed = true;
    }
  });
  if (changed) saveState();
}

function getWeekActivity() {
  const map = new Map(state.activity.map((entry) => [entry.date, entry]));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index - 6);
    const key = dayKey(index - 6);
    return { date, key, minutes: map.get(key)?.minutes || 0, today: index === 6 };
  });
}

function goalPercent(goal) { return Math.min(100, Math.round((goal.progress / goal.target) * 100)); }
function formatGoalProgress(goal) {
  if (goal.unit === "min") return `${Math.floor(goal.progress / 60)}h ${String(goal.progress % 60).padStart(2, "0")}m`;
  return `${goal.progress} / ${goal.target}`;
}
function formatMinutes(minutes) { return `${Math.floor(minutes / 60)}h ${minutes % 60}m`; }
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}
function initials(name) {
  return String(name).trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "?";
}
function selectedGoal() { return state.goals.find((goal) => goal.id === state.session.goalId) || state.goals.find((goal) => goal.unit === "min") || state.goals[0]; }
function remainingSeconds() {
  if (!state.session.endAt) return state.session.remaining;
  return Math.max(0, Math.ceil((state.session.endAt - Date.now()) / 1000));
}
function timerText() {
  const seconds = remainingSeconds();
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function render() {
  resetExpiredGoalProgress();
  document.querySelectorAll(".nav-link").forEach((link) => link.classList.toggle("active", link.dataset.view === currentView));
  const titles = { today: "Today", goals: "My goals", challenges: "Challenges", insights: "Insights" };
  document.querySelector("#crumbTitle").textContent = titles[currentView];
  document.querySelector("#todayDate").textContent = prettyDate().toUpperCase();
  document.querySelector("#sideStreak").textContent = `${streakCount()} day streak`;
  document.querySelector("#challengeCount").textContent = state.challenges.filter((challenge) => challenge.joined).length;
  document.querySelector("#profileAvatar").textContent = state.user ? initials(state.user.name) : "?";
  document.querySelector("#profileName").textContent = state.user ? state.user.name : "Create your account";
  document.querySelector("#profilePlan").textContent = state.user ? state.user.email : "Save your progress locally";
  if (currentView === "today") viewRoot.innerHTML = renderToday();
  if (currentView === "goals") viewRoot.innerHTML = renderGoals();
  if (currentView === "challenges") viewRoot.innerHTML = renderChallenges();
  if (currentView === "insights") viewRoot.innerHTML = renderInsights();
  updateTimerUI();
}

function renderHeading(kicker, title, description, action = "") {
  return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
}

function renderToday() {
  const goals = state.goals.slice(0, 4);
  const dateHeading = prettyDate().toUpperCase();
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date()).toUpperCase();
  const total = goals.reduce((sum, goal) => sum + goalPercent(goal), 0);
  const overall = goals.length ? Math.round(total / goals.length) : 0;
  const checkin = state.checkins[todayKey()];
  const week = getWeekActivity();
  const maxMinutes = Math.max(120, ...week.map((day) => day.minutes));
  const days = week.map((day) => `<div class="chart-day ${day.today ? "today" : ""}" title="${day.minutes} minutes"><div class="bar-slot"><div class="chart-bar" style="height:${Math.max(day.minutes ? 5 : 0, Math.round((day.minutes / maxMinutes) * 100))}%"></div></div><span class="day-label">${day.today ? "TODAY" : shortDay(day.date).toUpperCase()}</span><span class="chart-tooltip">${day.minutes ? `${day.minutes}m` : "–"}</span></div>`).join("");
  const progressRows = goals.map((goal) => `<div class="goal-progress-row"><div class="goal-name"><span class="goal-dot" style="background:${goal.color}"></span><span>${escapeHTML(goal.title)}</span></div><div class="goal-mini-track"><div class="goal-mini-fill" style="width:${goalPercent(goal)}%;background:${goal.color}"></div></div><span class="goal-value">${goal.unit === "min" ? `${goal.progress}m` : `${goal.progress}/${goal.target}`}</span></div>`).join("");
  const activeChallenge = state.challenges.find((challenge) => challenge.joined);
  const sessionOptions = state.goals.filter((goal) => goal.unit === "min").map((goal) => `<option value="${goal.id}" ${goal.id === state.session.goalId ? "selected" : ""}>${escapeHTML(goal.title)}</option>`).join("");
  return `${renderHeading(dateHeading, "Make today count.", "A little proof, every day. Pick up where you left off.")}
    <div class="dashboard-grid"><div class="main-stack">
      <section class="panel welcome-panel"><div class="welcome-copy"><div class="eyebrow">YOUR ${weekday} CHECK-IN</div><h1>${checkin ? "You showed up today." : "Good things take showing up."}</h1><p>${checkin ? "One honest check-in. One more day of momentum." : "You don't need a perfect day. Just one you can point to."}</p></div><button class="button button-lime" data-action="${checkin ? "edit-checkin" : "check-in"}">${checkin ? "Update check-in" : "Check in today"}<span aria-hidden="true">↗</span></button></section>
      <section class="panel progress-panel"><div class="panel-head"><div><h2 class="panel-title">Today's progress</h2><p class="panel-subtitle">Progress you can actually point to.</p></div><button class="text-link" data-view="goals">All goals <span aria-hidden="true">→</span></button></div><div class="progress-summary"><div class="progress-numbers"><strong>${overall}%</strong><span>of your daily targets</span></div><span class="progress-caption">${goals.filter((goal) => goal.progress >= goal.target).length} of ${goals.length} goals complete</span></div><div class="progress-track"><div class="progress-fill" style="width:${overall}%"></div></div><div class="goal-progress-list">${progressRows || `<div class="empty-state"><strong>Start with one small goal</strong><p>Your progress will show up here.</p><button class="button button-dark button-small" data-action="new-goal">Create a goal</button></div>`}</div></section>
      <section class="panel checkin-panel ${checkin ? "is-done" : ""}"><div class="checkin-copy"><span class="checkin-mark" aria-hidden="true">${checkin ? "✓" : "✳"}</span><div><h3>${checkin ? "Today's check-in is in." : "How did today go?"}</h3><p>${checkin ? escapeHTML(checkin) : "A quick reflection helps you come back tomorrow."}</p></div></div><button class="button button-light" data-action="${checkin ? "edit-checkin" : "check-in"}">${checkin ? "Edit note" : "Write a note"}</button></section>
      <section class="panel week-panel"><div class="panel-head"><div><h2 class="panel-title">Your week, in focus</h2><p class="panel-subtitle">Minutes spent moving your goals forward.</p></div><button class="text-link" data-view="insights">See report <span aria-hidden="true">→</span></button></div><div class="week-chart">${days}</div></section>
    </div><div class="side-stack">
      <section class="panel streak-panel"><div class="streak-top"><div class="eyebrow">YOUR STREAK</div><span class="streak-spark" aria-hidden="true">✳</span></div><div class="streak-count"><strong>${streakCount()}</strong><span>days</span></div><p>You're building a rhythm. Keep it going.</p><div class="streak-days">${renderStreakDays()}</div></section>
      <section class="panel focus-panel"><div class="panel-head"><div><h2 class="panel-title">Focus session</h2><p class="panel-subtitle">One thing. A little less noise.</p></div></div><div class="focus-content"><div><select class="focus-select" id="focusGoal" aria-label="Goal for focus session">${sessionOptions || `<option value="">Create a minutes-based goal first</option>`}</select><div class="focus-controls"><button class="button button-dark" data-action="toggle-timer">${state.session.endAt ? "Pause" : remainingSeconds() < state.session.duration * 60 ? "Resume" : "Start focus"}</button><button class="button button-light" data-action="stop-timer">Finish</button></div></div><div class="timer-face"><span class="timer-digits" id="timerDigits">${timerText()}</span><span class="timer-state" id="timerState">${state.session.endAt ? "IN FOCUS" : "25 MINUTES"}</span></div></div></section>
      <section class="panel challenge-card"><div class="panel-head"><h2 class="panel-title">A little friendly pressure</h2><button class="text-link" data-view="challenges">All</button></div>${activeChallenge ? `<div class="challenge-art"><div><span>${escapeHTML(activeChallenge.title)}</span><br><small>${activeChallenge.progress} OF ${activeChallenge.days} DAYS</small></div><div class="avatar-stack">${activeChallenge.people.slice(0, 3).map((person) => `<span class="tiny-avatar">${escapeHTML(person)}</span>`).join("")}<span class="avatar-more">+2</span></div></div><div class="challenge-detail"><strong>${escapeHTML(activeChallenge.detail)}</strong><span>${activeChallenge.progress} day streak</span></div><div class="challenge-progress"><span style="width:${Math.min(100, Math.round(activeChallenge.progress / activeChallenge.days * 100))}%"></span></div>` : `<p class="panel-subtitle">Join a private challenge to stay accountable with friends.</p><button class="button button-light" data-view="challenges">Explore challenges</button>`}</section>
    </div></div>`;
}

function renderStreakDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const offset = index - 6;
    const key = dayKey(offset);
    const done = Boolean(state.checkins[key]);
    const current = offset === 0;
    const date = new Date(); date.setDate(date.getDate() + offset);
    return `<div class="streak-day ${done ? "done" : ""} ${current ? "current" : ""}"><span>${shortDay(date).slice(0, 1).toUpperCase()}</span><span>${done ? "✓" : current ? "·" : ""}</span></div>`;
  }).join("");
}

function renderGoals() {
  const cards = state.goals.map((goal, index) => {
    const classes = ["", "blue", "orange", "pink"];
    const unitLabel = goal.unit === "min" ? `${goal.progress} min of ${goal.target} min today` : `${goal.progress} of ${goal.target} ${goal.unit} today`;
    return `<article class="goal-card"><div class="goal-symbol ${classes[index % classes.length]}">${goal.unit === "min" ? "◷" : goal.category === "Wellbeing" ? "+" : "✓"}</div><div class="goal-card-copy"><h3>${escapeHTML(goal.title)}</h3><p>${escapeHTML(goal.category)} · ${unitLabel}</p><div class="goal-card-track"><span style="width:${goalPercent(goal)}%"></span></div></div><div class="goal-card-end"><span class="goal-card-count"><strong>${goalPercent(goal)}%</strong><br>today</span><button class="icon-button" data-action="complete-goal" data-id="${goal.id}" title="Log progress for ${escapeHTML(goal.title)}" aria-label="Log progress for ${escapeHTML(goal.title)}">+</button></div></article>`;
  }).join("");
  return `${renderHeading("MAKE IT MEASURABLE", "Goals that move you.", "Keep the big picture. Make the next step small.", `<button class="button button-dark button-small" data-action="new-goal"><span class="button-plus">+</span> New goal</button>`)}<div class="panel panel-pad"><div class="panel-head"><div><h2 class="panel-title">Your active goals</h2><p class="panel-subtitle">A small, visible step beats a perfect plan.</p></div><span class="metric-label">${state.goals.length} ACTIVE</span></div><div class="goal-list">${cards || `<div class="empty-state"><strong>No goals yet</strong><p>Make your first goal easy to start today.</p><button class="button button-dark button-small" data-action="new-goal">Create a goal</button></div>`}</div></div>`;
}

function renderChallenges() {
  const cards = state.challenges.map((challenge) => `<article class="panel challenge-wide"><div class="eyebrow">${escapeHTML(challenge.kind)}</div><div class="challenge-art"><div><span>${escapeHTML(challenge.title)}</span><br><small>${challenge.progress} OF ${challenge.days} DAYS</small></div><div class="avatar-stack">${challenge.people.map((person) => `<span class="tiny-avatar">${escapeHTML(person)}</span>`).join("")}<span class="avatar-more">+${challenge.joined ? "2" : "1"}</span></div></div><div class="challenge-detail"><strong>${escapeHTML(challenge.detail)}</strong><span>${challenge.joined ? `${challenge.progress} of ${challenge.days} days complete` : `${challenge.days} days · private group`}</span></div><div class="challenge-progress"><span style="width:${Math.min(100, Math.round(challenge.progress / challenge.days * 100))}%"></span></div><div class="challenge-wide-foot"><span>${challenge.joined ? "You're in this challenge" : "Created by Maya K."}</span><button class="button ${challenge.joined ? "button-light" : "button-dark"}" data-action="${challenge.joined ? "leave-challenge" : "join-challenge"}" data-id="${challenge.id}">${challenge.joined ? "Leave challenge" : "Join challenge"}</button></div></article>`).join("");
  return `${renderHeading("BETTER, TOGETHER", "Keep each other going.", "Private challenges make showing up a little more fun.", `<button class="button button-dark button-small" data-action="new-challenge"><span class="button-plus">+</span> Create challenge</button>`)}<div class="challenge-list">${cards}</div>`;
}

function buildWeeklyReport() {
  const week = getWeekActivity();
  const minutes = week.reduce((sum, day) => sum + day.minutes, 0);
  const daysActive = week.filter((day) => day.minutes > 0 || state.checkins[day.key]).length;
  const best = week.reduce((winner, day) => day.minutes > winner.minutes ? day : winner, { minutes: 0, date: new Date() });
  const hours = state.activity.filter((entry) => entry.date >= dayKey(-6) && entry.date <= todayKey() && entry.minutes > 0).map((entry) => entry.hour).filter(Number.isFinite);
  const bestHour = hours.length ? Math.round(hours.reduce((sum, hour) => sum + hour, 0) / hours.length) : 17;
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric" }).format(new Date(2020, 0, 1, bestHour));
  let message = minutes >= 300
    ? `You put ${formatMinutes(minutes)} toward what matters this week. That kind of consistency is the real win.`
    : `You logged ${formatMinutes(minutes)} of focused progress this week. A short session still counts. Keep the next one easy to start.`;
  if (daysActive >= 5) message = `You showed up on ${daysActive} different days. Your consistency is doing more work than any single long session.`;
  const advice = hours.length >= 3 ? `Your logged focus tends to land around ${time}. Try protecting that window for your next study block.` : "Log a few more focus sessions and your report can spot the time of day when you do your best work.";
  return { minutes, daysActive, best, message, advice };
}

function renderInsights() {
  const report = buildWeeklyReport();
  const score = Math.min(99, Math.round((report.daysActive / 7) * 60 + Math.min(40, report.minutes / 15)));
  const filled = Math.round(score / 10);
  return `${renderHeading("A PATTERN IS TAKING SHAPE", "Your week, with perspective.", "A useful reflection, based on the progress you logged.")}
    <div class="insights-layout"><section class="panel report-card"><div class="panel-head"><div><h2 class="panel-title">Weekly coaching report</h2><p class="panel-subtitle">${prettyDate(new Date(Date.now() - 6 * 86400000))} – ${prettyDate()}</p></div><span class="metric-label">THIS WEEK</span></div><div class="report-feature"><div class="eyebrow">THE PATTERN</div><h3>${escapeHTML(report.message)}</h3><p>${escapeHTML(report.advice)}</p></div><div class="metric-row"><div class="metric-box"><span class="metric-label">FOCUS TIME</span><strong class="metric-value">${formatMinutes(report.minutes)}</strong><span class="metric-note">logged this week</span></div><div class="metric-box"><span class="metric-label">DAYS ACTIVE</span><strong class="metric-value">${report.daysActive}<span style="font-size:12px;font-weight:500"> / 7</span></strong><span class="metric-note">days with progress</span></div><div class="metric-box"><span class="metric-label">BEST DAY</span><strong class="metric-value" style="font-size:15px">${report.best.minutes ? shortDay(report.best.date) : "—"}</strong><span class="metric-note">${report.best.minutes ? `${report.best.minutes} focused minutes` : "more data needed"}</span></div></div></section><aside class="insight-aside"><section class="panel score-panel"><div class="eyebrow" style="color:#b3c6b8">PROOF SCORE</div><div class="score-value"><strong>${score}</strong><span>/ 100</span></div><p>A snapshot of your consistency. Built from days active and focus time, not perfect checklists.</p><div class="score-dots">${Array.from({ length: 10 }, (_, index) => `<span class="${index < filled ? "filled" : ""}"></span>`).join("")}</div></section><div class="report-note"><strong>How this report works</strong>Proof looks at the check-ins and focus sessions you choose to log. Your patterns stay on this device for now.</div></aside></div>`;
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function setDialog(title, eyebrow, body, actions) {
  document.querySelector("#dialogTitle").textContent = title;
  document.querySelector("#dialogEyebrow").textContent = eyebrow;
  document.querySelector("#dialogBody").innerHTML = body;
  document.querySelector("#dialogActions").innerHTML = actions;
  dialog.showModal();
}

function openGoalDialog() {
  setDialog("New goal", "MAKE IT MEASURABLE", `<div class="form-field"><label for="goalTitle">What do you want to make progress on?</label><input id="goalTitle" name="title" placeholder="e.g. Study for midterms" maxlength="60" required></div><div class="field-row"><div class="form-field"><label for="goalCategory">Category</label><select id="goalCategory" name="category"><option>Study</option><option>Wellbeing</option><option>Coursework</option><option>Personal</option></select></div><div class="form-field"><label for="goalUnit">Track progress in</label><select id="goalUnit" name="unit"><option value="min">Minutes</option><option value="session">Sessions</option><option value="steps">Steps</option></select></div></div><div class="form-field"><label for="goalTarget">Daily target</label><input id="goalTarget" name="target" type="number" min="1" max="600" value="60" required></div><p class="dialog-hint">Keep your first target small enough to start today. You can change it any time.</p>`, `<button type="button" class="button button-light" data-action="close-dialog">Cancel</button><button class="button button-dark" type="submit" value="create-goal">Create goal</button>`);
  document.querySelector("#goalTitle").focus();
}

function openCheckinDialog() {
  const existing = state.checkins[todayKey()] || "";
  setDialog(existing ? "Update your check-in" : "How did today go?", "A MOMENT TO REFLECT", `<div class="form-field"><label for="checkinNote">What is one thing you showed up for today?</label><textarea id="checkinNote" name="note" maxlength="240" placeholder="Even a small win counts..." required>${escapeHTML(existing)}</textarea></div><p class="dialog-hint">Honest progress beats perfect progress. This note is just for you.</p>`, `<button type="button" class="button button-light" data-action="close-dialog">Cancel</button><button class="button button-dark" type="submit" value="save-checkin">Save check-in</button>`);
  document.querySelector("#checkinNote").focus();
}

function openChallengeDialog() {
  setDialog("Start a challenge", "BETTER, TOGETHER", `<div class="form-field"><label for="challengeTitle">Challenge name</label><input id="challengeTitle" name="title" placeholder="e.g. 5 mornings outside" maxlength="55" required></div><div class="form-field"><label for="challengeDays">Length</label><select id="challengeDays" name="days"><option value="5">5 days</option><option value="7" selected>7 days</option><option value="14">14 days</option></select></div><p class="dialog-hint">Your challenge starts as a private group. Invite friends when you're ready.</p>`, `<button type="button" class="button button-light" data-action="close-dialog">Cancel</button><button class="button button-dark" type="submit" value="create-challenge">Create challenge</button>`);
  document.querySelector("#challengeTitle").focus();
}

function openAuthDialog(mode = state.user ? "account" : "signup") {
  if (mode === "account" && state.user) {
    setDialog("Your account", "YOUR PROOF SPACE", `<div class="account-summary"><span class="account-summary-avatar">${escapeHTML(initials(state.user.name))}</span><div><strong>${escapeHTML(state.user.name)}</strong><span>${escapeHTML(state.user.email)}</span></div></div><p class="dialog-hint account-hint">This MVP saves your account and progress in this browser. A production version would connect this to secure authentication and cloud sync.</p>`, `<button type="button" class="button button-light" data-action="sign-out">Sign out</button><button type="button" class="button button-dark" data-action="close-dialog">Done</button>`);
    return;
  }
  const signIn = mode === "signin";
  setDialog(signIn ? "Welcome back" : "Create your account", signIn ? "SIGN IN TO PROOF" : "START YOUR PROOF SPACE", `<div class="auth-tabs"><button type="button" class="auth-tab ${signIn ? "" : "active"}" data-action="switch-auth" data-mode="signup">Create account</button><button type="button" class="auth-tab ${signIn ? "active" : ""}" data-action="switch-auth" data-mode="signin">Sign in</button></div>${signIn ? "" : `<div class="form-field"><label for="accountName">Your name</label><input id="accountName" name="name" placeholder="e.g. Jamie Davis" autocomplete="name" maxlength="50" required></div>`}<div class="form-field"><label for="accountEmail">Email address</label><input id="accountEmail" name="email" type="email" placeholder="you@example.com" autocomplete="email" required></div><div class="form-field"><label for="accountPassword">Password</label><input id="accountPassword" name="password" type="password" placeholder="At least 6 characters" minlength="6" autocomplete="${signIn ? "current-password" : "new-password"}" required></div><p class="dialog-hint account-hint">Demo account only: your details stay in this browser and are not sent anywhere.</p>`, `<button type="button" class="button button-light" data-action="close-dialog">Cancel</button><button class="button button-dark" type="submit" value="${signIn ? "sign-in" : "create-account"}">${signIn ? "Sign in" : "Create account"}</button>`);
  document.querySelector("#accountEmail").focus();
}

function updateTimerUI() {
  const digits = document.querySelector("#timerDigits");
  const status = document.querySelector("#timerState");
  if (digits) digits.textContent = timerText();
  if (status) status.textContent = state.session.endAt ? "IN FOCUS" : remainingSeconds() < state.session.duration * 60 ? "PAUSED" : `${state.session.duration} MINUTES`;
}

function startTimer() {
  if (!state.goals.some((goal) => goal.unit === "min")) {
    showToast("Create a minutes-based goal to start a focus session.");
    return;
  }
  if (state.session.remaining <= 0) state.session.remaining = state.session.duration * 60;
  state.session.goalId = document.querySelector("#focusGoal")?.value || state.session.goalId;
  state.session.endAt = Date.now() + state.session.remaining * 1000;
  saveState(); render();
}

function pauseTimer() {
  state.session.remaining = remainingSeconds();
  state.session.endAt = null;
  saveState(); render();
}

function finishTimer() {
  const wasRunning = Boolean(state.session.endAt);
  const remaining = remainingSeconds();
  const elapsed = Math.max(0, state.session.duration * 60 - remaining);
  const minutes = Math.floor(elapsed / 60);
  if (!minutes) {
    if (wasRunning) pauseTimer();
    showToast("No full minute logged. Keep going when you're ready.");
    return;
  }
  const goal = state.goals.find((entry) => entry.id === state.session.goalId);
  if (goal) { goal.progress = Math.min(goal.target, goal.progress + minutes); goal.progressDate = todayKey(); }
  const key = todayKey();
  const activity = state.activity.find((entry) => entry.date === key);
  if (activity) { activity.minutes += minutes; activity.hour = new Date().getHours(); }
  else state.activity.push({ date: key, minutes, hour: new Date().getHours() });
  state.session.remaining = state.session.duration * 60;
  state.session.endAt = null;
  saveState(); render();
  showToast(`${minutes} focused ${minutes === 1 ? "minute" : "minutes"} added to your progress.`);
}

function addGoalProgress(goal) {
  if (goal.progress >= goal.target) { showToast("This goal is already complete for today."); return; }
  goal.progress = Math.min(goal.target, goal.progress + (goal.unit === "min" ? 25 : 1));
  goal.progressDate = todayKey();
  saveState(); render();
  showToast(goal.unit === "min" ? "25 minutes of progress logged." : "Progress logged. Nice work.");
}

document.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) { currentView = viewButton.dataset.view; render(); return; }
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const { action, id } = actionButton.dataset;
  if (action === "new-goal") openGoalDialog();
  if (action === "check-in" || action === "edit-checkin") openCheckinDialog();
  if (action === "new-challenge") openChallengeDialog();
  if (action === "account") openAuthDialog();
  if (action === "switch-auth") openAuthDialog(actionButton.dataset.mode);
  if (action === "sign-out") { state.user = null; saveState(); dialog.close(); render(); showToast("Signed out of this browser."); }
  if (action === "close-dialog") dialog.close();
  if (action === "toggle-timer") state.session.endAt ? pauseTimer() : startTimer();
  if (action === "stop-timer") finishTimer();
  if (action === "complete-goal") { const goal = state.goals.find((entry) => entry.id === id); if (goal) addGoalProgress(goal); }
  if (action === "join-challenge" || action === "leave-challenge") {
    const challenge = state.challenges.find((entry) => entry.id === id);
    if (challenge) { challenge.joined = action === "join-challenge"; saveState(); render(); showToast(challenge.joined ? "You're in. Keep each other going." : "You left the challenge."); }
  }
});

document.addEventListener("change", (event) => {
  if (event.target.id !== "focusGoal") return;
  state.session.goalId = event.target.value;
  saveState();
});

document.querySelector("#dialogForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const submitter = event.submitter?.value;
  const data = new FormData(event.currentTarget);
  if (submitter === "create-goal") {
    const title = String(data.get("title") || "").trim();
    const target = Math.max(1, Number(data.get("target")) || 1);
    const unit = String(data.get("unit"));
    const goal = { id: `goal-${Date.now()}`, title, category: String(data.get("category")), target, unit, progress: 0, progressDate: todayKey(), color: COLORS[state.goals.length % COLORS.length] };
    state.goals.push(goal);
    if (unit === "min") state.session.goalId = goal.id;
    saveState(); dialog.close(); currentView = "goals"; render(); showToast("Your new goal is ready.");
  }
  if (submitter === "save-checkin") {
    const note = String(data.get("note") || "").trim();
    if (!note) return;
    const firstCheckinToday = !state.checkins[todayKey()];
    state.checkins[todayKey()] = note;
    if (firstCheckinToday) {
      state.challenges.filter((challenge) => challenge.joined && challenge.progress < challenge.days).forEach((challenge) => { challenge.progress += 1; });
    }
    saveState(); dialog.close(); render(); showToast("Check-in saved. That's another day of showing up.");
  }
  if (submitter === "create-challenge") {
    const title = String(data.get("title") || "").trim();
    state.challenges.unshift({ id: `challenge-${Date.now()}`, title, detail: `Show up together for ${data.get("days")} days`, days: Number(data.get("days")), joined: true, progress: 0, people: ["JD"], kind: "YOUR CHALLENGE" });
    saveState(); dialog.close(); currentView = "challenges"; render(); showToast("Challenge created. Invite a friend to join.");
  }
  if (submitter === "create-account") {
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim().toLowerCase();
    const password = String(data.get("password") || "");
    if (!name || !email || password.length < 6) return;
    state.account = { name, email, password };
    state.user = { name, email };
    saveState(); dialog.close(); render(); showToast(`Welcome to Proof, ${name.split(" ")[0]}.`);
  }
  if (submitter === "sign-in") {
    const email = String(data.get("email") || "").trim().toLowerCase();
    const password = String(data.get("password") || "");
    if (!state.account || state.account.email !== email || state.account.password !== password) {
      showToast("That email or password does not match this browser.");
      return;
    }
    state.user = { name: state.account.name, email: state.account.email };
    saveState();
    dialog.close(); render(); showToast(`Welcome back, ${state.user.name.split(" ")[0]}.`);
  }
});

document.querySelector("#appDialog").addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

setInterval(() => {
  if (state.session.endAt && remainingSeconds() === 0) {
    finishTimer();
    showToast("Focus session complete. Take a breath before the next one.");
    return;
  }
  if (state.session.endAt) updateTimerUI();
}, 1000);

render();