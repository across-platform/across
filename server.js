const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const USERS_DB_PATH = path.join(DATA_DIR, 'users.json');
const TASKS_DB_PATH = path.join(DATA_DIR, 'tasks.json');
const PLAN_REQUESTS_DB_PATH = path.join(DATA_DIR, 'plan-requests.json');
const MESSAGES_DB_PATH = path.join(DATA_DIR, 'messages.json');
const CONTACT_REQUESTS_DB_PATH = path.join(DATA_DIR, 'contact-requests.json');

const DEV_DEFAULT_ADMIN_EMAIL = 'admin@across-platform.hu';
const DEV_DEFAULT_ADMIN_PASSWORD = 'Admin!ChangeMe2026';
const SUPPORT_PLANS = {
  basic: {
    key: 'basic',
    name: 'Basic',
    price: '9.990 Ft / 30 perc',
    includedMinutes: 30,
    features: ['Távoli segítség', 'Általános hibák elhárítása', 'E-mail támogatás']
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    price: '17.990 Ft / 60 perc',
    includedMinutes: 60,
    features: ['Minden Basic szolgáltatás', 'Elsőbbségi támogatás', 'Bonyolultabb problémák']
  },
  business: {
    key: 'business',
    name: 'Nagyobb projekthez egyedi ajánlat',
    price: 'Egyedi ajánlat',
    includedMinutes: 0,
    features: ['Előzetes igényfelmérés', 'Projektalapú ütemezés', 'Adminisztrált munkanapló']
  }
};

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: IS_PROD ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());
app.use(session({
  name: 'across_sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24
  }
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Túl sok próbálkozás. Kérlek várj pár percet.' }
});

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Túl sok megkeresés. Kérlek próbáld újra pár perc múlva.' }
});

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function sanitizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

function sanitizeText(value, maxLength = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function sanitizeMultiline(value, maxLength = 1200) {
  return String(value || '').trim().replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').slice(0, maxLength);
}

function isStrongPassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,}$/.test(String(password || ''));
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function toSha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function userWithDefaults(user) {
  return {
    ...user,
    role: user.role || 'user',
    status: user.status || 'active',
    subscriptionPlan: user.subscriptionPlan || (user.role === 'admin' ? 'pro' : 'pro'),
    mustChangePassword: !!user.mustChangePassword,
    recovery: user.recovery || null
  };
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    subscriptionPlan: user.subscriptionPlan || 'pro',
    mustChangePassword: !!user.mustChangePassword,
    createdAt: user.createdAt
  };
}

function publicPlan(planKey) {
  const fallback = SUPPORT_PLANS.pro;
  return SUPPORT_PLANS[planKey] || fallback;
}

function taskWithDefaults(task) {
  const status = ['successful', 'followup', 'failed'].includes(task.status) ? task.status : 'successful';
  return {
    id: task.id || crypto.randomUUID(),
    userId: task.userId || '',
    helper: sanitizeText(task.helper || 'Across-platform', 80),
    topic: sanitizeText(task.topic || 'Távoli segítségnyújtás', 120),
    status,
    durationMinutes: Math.max(0, Number.parseInt(task.durationMinutes, 10) || 0),
    completedAt: task.completedAt || new Date().toISOString(),
    device: sanitizeText(task.device || '', 120),
    solution: sanitizeMultiline(task.solution || task.note || '', 1200),
    internalNote: sanitizeMultiline(task.internalNote || '', 1200),
    createdAt: task.createdAt || new Date().toISOString(),
    updatedAt: task.updatedAt || task.createdAt || new Date().toISOString()
  };
}

function publicTask(task, includeInternal = false) {
  const normalized = taskWithDefaults(task);
  const statusLabels = {
    successful: 'Sikeresen megoldva',
    followup: 'Utánkövetés szükséges',
    failed: 'Nem sikerült megoldani'
  };
  const result = statusLabels[normalized.status] || statusLabels.successful;
  const publicShape = {
    id: normalized.id,
    userId: normalized.userId,
    date: normalized.completedAt,
    completedAt: normalized.completedAt,
    helper: normalized.helper,
    topic: normalized.topic,
    status: normalized.status,
    result,
    successful: normalized.status === 'successful',
    durationMinutes: normalized.durationMinutes,
    device: normalized.device,
    note: normalized.solution,
    solution: normalized.solution,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt
  };
  if (includeInternal) publicShape.internalNote = normalized.internalNote;
  return publicShape;
}

function seedTasksForUser(user) {
  return [
    {
      id: `seed-${user.id}-email`,
      userId: user.id,
      date: '2026-04-18T15:30:00.000Z',
      completedAt: '2026-04-18T15:30:00.000Z',
      helper: 'Nagy Péter',
      topic: 'Email fiók beállítása',
      status: 'successful',
      result: 'Sikeresen megoldva',
      successful: true,
      durationMinutes: 28,
      device: 'Windows laptop',
      note: 'Postafiók újrakonfigurálva, teszt email sikeresen elküldve.',
      solution: 'Postafiók újrakonfigurálva, teszt email sikeresen elküldve.'
    },
    {
      id: `seed-${user.id}-update`,
      userId: user.id,
      date: '2026-05-09T09:10:00.000Z',
      completedAt: '2026-05-09T09:10:00.000Z',
      helper: 'Kovács Anna',
      topic: 'Windows frissítési hiba',
      status: 'successful',
      result: 'Sikeresen megoldva',
      successful: true,
      durationMinutes: 46,
      device: 'Asztali PC',
      note: 'Frissítési gyorsítótár törölve, rendszer újraindítás után rendben működött.',
      solution: 'Frissítési gyorsítótár törölve, rendszer újraindítás után rendben működött.'
    },
    {
      id: `seed-${user.id}-printer`,
      userId: user.id,
      date: '2026-05-28T17:05:00.000Z',
      completedAt: '2026-05-28T17:05:00.000Z',
      helper: 'Szabó Márk',
      topic: 'Nyomtató kapcsolat ellenőrzése',
      status: 'followup',
      result: 'Utánkövetés szükséges',
      successful: false,
      durationMinutes: 35,
      device: 'Hálózati nyomtató',
      note: 'Driver frissítve, a hálózati eszközt a helyszínen is ellenőrizni kell.',
      solution: 'Driver frissítve, a hálózati eszközt a helyszínen is ellenőrizni kell.'
    }
  ];
}

function buildAccountOverview(user, tasks = []) {
  const createdAt = user.createdAt ? new Date(user.createdAt) : new Date();
  const renewalDate = new Date(createdAt);
  renewalDate.setMonth(renewalDate.getMonth() + 1);
  const plan = publicPlan(user.subscriptionPlan);

  const userTasks = tasks
    .filter(task => task.userId === user.id)
    .map(task => publicTask(task))
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  const history = userTasks.length ? userTasks : seedTasksForUser(user);

  const solved = history.filter(item => item.successful).length;
  const averageMinutes = history.length
    ? Math.round(history.reduce((sum, item) => sum + item.durationMinutes, 0) / history.length)
    : 0;

  return {
    user: publicUser(user),
    subscription: {
      plan: plan.name,
      planKey: plan.key,
      status: 'Aktív',
      renewalDate: renewalDate.toISOString(),
      includedMinutes: plan.includedMinutes,
      usedMinutes: history.reduce((sum, item) => sum + item.durationMinutes, 0),
      features: plan.features
    },
    stats: {
      solved,
      total: history.length,
      averageMinutes,
      lastHelpAt: history[0]?.completedAt || history[0]?.date || null
    },
    history
  };
}

function planRequestWithDefaults(request) {
  return {
    id: request.id || crypto.randomUUID(),
    userId: request.userId || '',
    currentPlan: request.currentPlan || 'pro',
    requestedPlan: request.requestedPlan || 'pro',
    status: ['pending', 'approved', 'rejected'].includes(request.status) ? request.status : 'pending',
    note: sanitizeMultiline(request.note || '', 600),
    adminNote: sanitizeMultiline(request.adminNote || '', 600),
    createdAt: request.createdAt || new Date().toISOString(),
    updatedAt: request.updatedAt || request.createdAt || new Date().toISOString()
  };
}

function messageWithDefaults(message) {
  return {
    id: message.id || crypto.randomUUID(),
    userId: message.userId || '',
    senderRole: message.senderRole === 'admin' ? 'admin' : 'user',
    senderName: sanitizeName(message.senderName || 'Across-platform'),
    body: sanitizeMultiline(message.body, 1200),
    createdAt: message.createdAt || new Date().toISOString()
  };
}

function contactRequestWithDefaults(request) {
  return {
    id: request.id || crypto.randomUUID(),
    name: sanitizeName(request.name || ''),
    email: normalizeEmail(request.email || ''),
    message: sanitizeMultiline(request.message || '', 1600),
    status: ['new', 'in_progress', 'replied', 'archived'].includes(request.status) ? request.status : 'new',
    adminNote: sanitizeMultiline(request.adminNote || '', 800),
    createdAt: request.createdAt || new Date().toISOString(),
    updatedAt: request.updatedAt || request.createdAt || new Date().toISOString()
  };
}

function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Nincs bejelentkezve.' });
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Nincs bejelentkezve.' });
  }
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Nincs admin jogosultság.' });
  }
  if (req.session.user.mustChangePassword) {
    return res.status(428).json({ error: 'Első belépésnél kötelező a jelszócsere.' });
  }
  return next();
}

async function ensureUsersDb() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(USERS_DB_PATH);
  } catch {
    await fs.writeFile(USERS_DB_PATH, JSON.stringify({ users: [] }, null, 2));
  }
}

async function ensureTasksDb() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(TASKS_DB_PATH);
  } catch {
    await fs.writeFile(TASKS_DB_PATH, JSON.stringify({ tasks: [] }, null, 2));
  }
}

async function ensurePlanRequestsDb() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(PLAN_REQUESTS_DB_PATH);
  } catch {
    await fs.writeFile(PLAN_REQUESTS_DB_PATH, JSON.stringify({ requests: [] }, null, 2));
  }
}

async function ensureMessagesDb() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(MESSAGES_DB_PATH);
  } catch {
    await fs.writeFile(MESSAGES_DB_PATH, JSON.stringify({ messages: [] }, null, 2));
  }
}

async function ensureContactRequestsDb() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(CONTACT_REQUESTS_DB_PATH);
  } catch {
    await fs.writeFile(CONTACT_REQUESTS_DB_PATH, JSON.stringify({ requests: [] }, null, 2));
  }
}

async function readUsers() {
  await ensureUsersDb();
  const raw = await fs.readFile(USERS_DB_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.users) ? parsed.users : [];
}

async function readTasks() {
  await ensureTasksDb();
  const raw = await fs.readFile(TASKS_DB_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.tasks) ? parsed.tasks.map(taskWithDefaults) : [];
}

async function readPlanRequests() {
  await ensurePlanRequestsDb();
  const raw = await fs.readFile(PLAN_REQUESTS_DB_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.requests) ? parsed.requests.map(planRequestWithDefaults) : [];
}

async function readMessages() {
  await ensureMessagesDb();
  const raw = await fs.readFile(MESSAGES_DB_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.messages) ? parsed.messages.map(messageWithDefaults) : [];
}

async function readContactRequests() {
  await ensureContactRequestsDb();
  const raw = await fs.readFile(CONTACT_REQUESTS_DB_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.requests) ? parsed.requests.map(contactRequestWithDefaults) : [];
}

async function writeUsers(users) {
  await fs.writeFile(USERS_DB_PATH, JSON.stringify({ users }, null, 2));
}

async function writeTasks(tasks) {
  await fs.writeFile(TASKS_DB_PATH, JSON.stringify({ tasks: tasks.map(taskWithDefaults) }, null, 2));
}

async function writePlanRequests(requests) {
  await fs.writeFile(PLAN_REQUESTS_DB_PATH, JSON.stringify({ requests: requests.map(planRequestWithDefaults) }, null, 2));
}

async function writeMessages(messages) {
  await fs.writeFile(MESSAGES_DB_PATH, JSON.stringify({ messages: messages.map(messageWithDefaults) }, null, 2));
}

async function writeContactRequests(requests) {
  await fs.writeFile(CONTACT_REQUESTS_DB_PATH, JSON.stringify({ requests: requests.map(contactRequestWithDefaults) }, null, 2));
}

function buildTaskFromRequest(body, existing = null) {
  const now = new Date().toISOString();
  const userId = sanitizeText(body?.userId, 80);
  const helper = sanitizeText(body?.helper || 'Across-platform', 80);
  const topic = sanitizeText(body?.topic, 120);
  const status = ['successful', 'followup', 'failed'].includes(body?.status) ? body.status : 'successful';
  const durationMinutes = Math.max(1, Math.min(24 * 60, Number.parseInt(body?.durationMinutes, 10) || 1));
  const completedAtRaw = String(body?.completedAt || '').trim();
  const completedAtDate = completedAtRaw ? new Date(completedAtRaw) : new Date();
  const completedAt = Number.isNaN(completedAtDate.getTime()) ? now : completedAtDate.toISOString();
  const device = sanitizeText(body?.device, 120);
  const solution = sanitizeMultiline(body?.solution || body?.note, 1200);
  const internalNote = sanitizeMultiline(body?.internalNote, 1200);

  return taskWithDefaults({
    ...(existing || {}),
    id: existing?.id || crypto.randomUUID(),
    userId,
    helper,
    topic,
    status,
    durationMinutes,
    completedAt,
    device,
    solution,
    internalNote,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  });
}

function validateTask(task, users) {
  if (!users.some(user => user.id === task.userId)) return 'Válassz létező felhasználót.';
  if (!task.topic || task.topic.length < 3) return 'Adj meg feladat témát.';
  if (!task.helper || task.helper.length < 2) return 'Add meg, ki segített.';
  if (!task.solution || task.solution.length < 3) return 'Írd le röviden a megoldást vagy az eredményt.';
  return '';
}

async function ensureAdminUser() {
  const users = (await readUsers()).map(userWithDefaults);
  const existingAdminIndex = users.findIndex(u => u.role === 'admin');
  if (existingAdminIndex >= 0) {
    const existingAdmin = users[existingAdminIndex];
    const canCheckDefault = !process.env.ADMIN_PASSWORD && existingAdmin.email === normalizeEmail(DEV_DEFAULT_ADMIN_EMAIL);
    if (canCheckDefault && !existingAdmin.mustChangePassword) {
      const stillDefault = await bcrypt.compare(DEV_DEFAULT_ADMIN_PASSWORD, existingAdmin.passwordHash);
      if (stillDefault) {
        users[existingAdminIndex].mustChangePassword = true;
        users[existingAdminIndex].updatedAt = new Date().toISOString();
        await writeUsers(users);
        console.warn('[auth] Existing default admin now requires first-login password change.');
      }
    }
    return;
  }

  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL || DEV_DEFAULT_ADMIN_EMAIL);
  const adminPassword = String(process.env.ADMIN_PASSWORD || DEV_DEFAULT_ADMIN_PASSWORD);
  const adminName = sanitizeName(process.env.ADMIN_NAME || 'Admin');
  const usesDefaultPassword = !process.env.ADMIN_PASSWORD;

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  users.push({
    id: crypto.randomUUID(),
    name: adminName,
    email: adminEmail,
    passwordHash,
    role: 'admin',
    status: 'active',
    mustChangePassword: usesDefaultPassword,
    recovery: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  await writeUsers(users);

  console.warn('[auth] Admin user created automatically for initial setup.');
  console.warn(`[auth] Email: ${adminEmail}`);
  if (usesDefaultPassword) {
    console.warn(`[auth] Password: ${DEV_DEFAULT_ADMIN_PASSWORD} (első belépéskor kötelező csere)`);
  }
}

app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const name = sanitizeName(req.body?.name);
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');

    if (!name || name.length < 2) return res.status(400).json({ error: 'Érvénytelen név.' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Érvénytelen email.' });
    if (!isStrongPassword(password)) return res.status(400).json({ error: 'A jelszó nem elég erős.' });

    const users = (await readUsers()).map(userWithDefaults);
    if (users.some(u => u.email === email)) {
      return res.status(409).json({ error: 'Ezzel az email címmel már létezik fiók.' });
    }

    users.push({
      id: crypto.randomUUID(),
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'user',
      status: 'active',
      mustChangePassword: false,
      recovery: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await writeUsers(users);
    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error('register error', error);
    return res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const remember = !!req.body?.remember;

    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ error: 'Hibás bejelentkezési adatok.' });
    }

    const users = (await readUsers()).map(userWithDefaults);
    const user = users.find(u => u.email === email);
    if (!user) return res.status(401).json({ error: 'Hibás bejelentkezési adatok.' });
    if (user.status !== 'active') return res.status(403).json({ error: 'A fiók inaktív. Kérj visszaállítást.' });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(401).json({ error: 'Hibás bejelentkezési adatok.' });

    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: !!user.mustChangePassword
    };

    req.session.cookie.maxAge = remember ? (1000 * 60 * 60 * 24 * 7) : (1000 * 60 * 60 * 24);

    return res.status(200).json({ ok: true, user: req.session.user, mustChangePassword: !!user.mustChangePassword });
  } catch (error) {
    console.error('login error', error);
    return res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.post('/api/auth/change-password', requireAuth, authLimiter, async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Hiányzó jelszó adatok.' });
    }
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ error: 'Az új jelszó nem elég erős.' });
    }

    const users = (await readUsers()).map(userWithDefaults);
    const index = users.findIndex(u => u.id === req.session.user.id);
    if (index < 0) return res.status(404).json({ error: 'Felhasználó nem található.' });

    const isCurrentValid = await bcrypt.compare(currentPassword, users[index].passwordHash);
    if (!isCurrentValid) return res.status(401).json({ error: 'A jelenlegi jelszó hibás.' });

    const isSame = await bcrypt.compare(newPassword, users[index].passwordHash);
    if (isSame) return res.status(400).json({ error: 'Az új jelszó nem egyezhet a régivel.' });

    users[index].passwordHash = await bcrypt.hash(newPassword, 12);
    users[index].mustChangePassword = false;
    users[index].updatedAt = new Date().toISOString();
    await writeUsers(users);

    req.session.user.mustChangePassword = false;
    return res.status(200).json({ ok: true, message: 'A jelszó sikeresen módosítva.' });
  } catch (error) {
    console.error('change-password error', error);
    return res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('across_sid');
    res.status(200).json({ ok: true });
  });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  return res.status(200).json({ user: req.session.user });
});

app.post('/api/contact-requests', contactLimiter, async (req, res) => {
  try {
    const name = sanitizeName(req.body?.name);
    const email = normalizeEmail(req.body?.email);
    const message = sanitizeMultiline(req.body?.message, 1600);

    if (!name || name.length < 2) return res.status(400).json({ error: 'Add meg a neved.' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Adj meg érvényes email címet.' });
    if (!message || message.length < 3) return res.status(400).json({ error: 'Írj rövid üzenetet.' });

    const now = new Date().toISOString();
    const request = contactRequestWithDefaults({
      id: crypto.randomUUID(),
      name,
      email,
      message,
      status: 'new',
      createdAt: now,
      updatedAt: now
    });
    const requests = await readContactRequests();
    requests.push(request);
    await writeContactRequests(requests);

    return res.status(201).json({ ok: true, request, message: 'Megkeresés elküldve. Hamarosan jelentkezünk.' });
  } catch (error) {
    console.error('contact request error', error);
    return res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.get('/api/account/overview', requireAuth, async (req, res) => {
  try {
    const users = (await readUsers()).map(userWithDefaults);
    const user = users.find(u => u.id === req.session.user.id);
    if (!user) return res.status(404).json({ error: 'Felhasználó nem található.' });
    if (user.status !== 'active') return res.status(403).json({ error: 'A fiók inaktív.' });

    const tasks = await readTasks();
    const planRequests = (await readPlanRequests())
      .filter(request => request.userId === user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const messages = (await readMessages())
      .filter(message => message.userId === user.id)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return res.status(200).json({
      ...buildAccountOverview(user, tasks),
      plans: Object.values(SUPPORT_PLANS),
      planRequests,
      messages
    });
  } catch (error) {
    console.error('account overview error', error);
    return res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.put('/api/account/profile', requireAuth, authLimiter, async (req, res) => {
  try {
    const name = sanitizeName(req.body?.name);
    const email = normalizeEmail(req.body?.email);
    const currentPassword = String(req.body?.currentPassword || '');

    if (!name || name.length < 2) return res.status(400).json({ error: 'Érvénytelen név.' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Érvénytelen email.' });

    const users = (await readUsers()).map(userWithDefaults);
    const index = users.findIndex(u => u.id === req.session.user.id);
    if (index < 0) return res.status(404).json({ error: 'Felhasználó nem található.' });

    const emailChanged = users[index].email !== email;
    if (emailChanged) {
      if (!currentPassword) return res.status(400).json({ error: 'Email módosításhoz add meg a jelenlegi jelszavad.' });
      const validPassword = await bcrypt.compare(currentPassword, users[index].passwordHash);
      if (!validPassword) return res.status(401).json({ error: 'A jelenlegi jelszó hibás.' });
      if (users.some(user => user.id !== users[index].id && user.email === email)) {
        return res.status(409).json({ error: 'Ezzel az email címmel már létezik fiók.' });
      }
    }

    users[index].name = name;
    users[index].email = email;
    users[index].updatedAt = new Date().toISOString();
    await writeUsers(users);

    req.session.user.name = users[index].name;
    req.session.user.email = users[index].email;
    return res.status(200).json({ ok: true, user: publicUser(users[index]), message: 'Adatlap frissítve.' });
  } catch (error) {
    console.error('account profile update error', error);
    return res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.post('/api/account/plan-requests', requireAuth, async (req, res) => {
  try {
    const requestedPlan = sanitizeText(req.body?.plan, 40);
    const note = sanitizeMultiline(req.body?.note, 600);
    if (!SUPPORT_PLANS[requestedPlan]) return res.status(400).json({ error: 'Ismeretlen csomag.' });

    const users = (await readUsers()).map(userWithDefaults);
    const user = users.find(u => u.id === req.session.user.id);
    if (!user) return res.status(404).json({ error: 'Felhasználó nem található.' });
    if (user.subscriptionPlan === requestedPlan) return res.status(400).json({ error: 'Ez már az aktív csomagod.' });

    const requests = await readPlanRequests();
    const hasPending = requests.some(request => request.userId === user.id && request.status === 'pending');
    if (hasPending) return res.status(409).json({ error: 'Már van folyamatban lévő csomagmódosítási kérelmed.' });

    const now = new Date().toISOString();
    const request = planRequestWithDefaults({
      id: crypto.randomUUID(),
      userId: user.id,
      currentPlan: user.subscriptionPlan || 'pro',
      requestedPlan,
      status: 'pending',
      note,
      createdAt: now,
      updatedAt: now
    });
    requests.push(request);
    await writePlanRequests(requests);

    return res.status(201).json({ ok: true, request, message: 'Csomagmódosítási kérelem elküldve.' });
  } catch (error) {
    console.error('account plan request error', error);
    return res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.get('/api/account/messages', requireAuth, async (req, res) => {
  try {
    const messages = (await readMessages())
      .filter(message => message.userId === req.session.user.id)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return res.status(200).json({ messages });
  } catch (error) {
    console.error('account messages error', error);
    return res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.post('/api/account/messages', requireAuth, async (req, res) => {
  try {
    const body = sanitizeMultiline(req.body?.message || req.body?.body, 1200);
    if (!body || body.length < 2) return res.status(400).json({ error: 'Írj üzenetet.' });

    const message = messageWithDefaults({
      id: crypto.randomUUID(),
      userId: req.session.user.id,
      senderRole: 'user',
      senderName: req.session.user.name,
      body,
      createdAt: new Date().toISOString()
    });
    const messages = await readMessages();
    messages.push(message);
    await writeMessages(messages);
    return res.status(201).json({ ok: true, message, notice: 'Üzenet elküldve.' });
  } catch (error) {
    console.error('account message send error', error);
    return res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.post('/api/auth/request-reset', authLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) {
      return res.status(200).json({ ok: true, message: 'Ha létezik ilyen fiók, küldtünk visszaállítási lehetőséget.' });
    }

    const users = (await readUsers()).map(userWithDefaults);
    const index = users.findIndex(u => u.email === email);

    if (index >= 0) {
      const rawToken = crypto.randomBytes(20).toString('hex');
      users[index].recovery = {
        tokenHash: toSha256(rawToken),
        expiresAt: Date.now() + 1000 * 60 * 15,
        createdAt: Date.now()
      };
      users[index].updatedAt = new Date().toISOString();
      await writeUsers(users);

      if (!IS_PROD) {
        return res.status(200).json({
          ok: true,
          message: 'Fejlesztői mód: használd ezt a visszaállító tokent.',
          resetToken: rawToken
        });
      }
    }

    return res.status(200).json({ ok: true, message: 'Ha létezik ilyen fiók, küldtünk visszaállítási lehetőséget.' });
  } catch (error) {
    console.error('request-reset error', error);
    return res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.post('/api/auth/restore-account', authLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const token = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.newPassword || '');

    if (!isValidEmail(email) || !token) return res.status(400).json({ error: 'Hiányzó visszaállítási adatok.' });
    if (!isStrongPassword(newPassword)) return res.status(400).json({ error: 'Az új jelszó nem elég erős.' });

    const users = (await readUsers()).map(userWithDefaults);
    const index = users.findIndex(u => u.email === email);
    if (index < 0 || !users[index].recovery) return res.status(400).json({ error: 'Érvénytelen vagy lejárt token.' });

    const recovery = users[index].recovery;
    if (!recovery.expiresAt || recovery.expiresAt < Date.now()) {
      users[index].recovery = null;
      await writeUsers(users);
      return res.status(400).json({ error: 'A token lejárt, kérj újat.' });
    }

    if (recovery.tokenHash !== toSha256(token)) return res.status(400).json({ error: 'Érvénytelen vagy lejárt token.' });

    users[index].passwordHash = await bcrypt.hash(newPassword, 12);
    users[index].status = 'active';
    users[index].mustChangePassword = false;
    users[index].recovery = null;
    users[index].updatedAt = new Date().toISOString();
    await writeUsers(users);

    return res.status(200).json({ ok: true, message: 'A fiók visszaállítva, most már bejelentkezhetsz.' });
  } catch (error) {
    console.error('restore-account error', error);
    return res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = (await readUsers()).map(userWithDefaults).map(publicUser);
    return res.status(200).json({ users });
  } catch (error) {
    console.error('admin users error', error);
    return res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.get('/api/admin/tasks', requireAdmin, async (req, res) => {
  try {
    const users = (await readUsers()).map(userWithDefaults).map(publicUser);
    const userById = new Map(users.map(user => [user.id, user]));
    const tasks = (await readTasks())
      .map(task => ({
        ...publicTask(task, true),
        userName: userById.get(task.userId)?.name || 'Ismeretlen felhasználó',
        userEmail: userById.get(task.userId)?.email || ''
      }))
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

    return res.status(200).json({ tasks });
  } catch (error) {
    console.error('admin tasks error', error);
    return res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.get('/api/admin/plan-requests', requireAdmin, async (req, res) => {
  try {
    const users = (await readUsers()).map(userWithDefaults).map(publicUser);
    const userById = new Map(users.map(user => [user.id, user]));
    const requests = (await readPlanRequests())
      .map(request => ({
        ...request,
        currentPlanName: publicPlan(request.currentPlan).name,
        requestedPlanName: publicPlan(request.requestedPlan).name,
        userName: userById.get(request.userId)?.name || 'Ismeretlen felhasználó',
        userEmail: userById.get(request.userId)?.email || ''
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.status(200).json({ requests });
  } catch (error) {
    console.error('admin plan requests error', error);
    return res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.patch('/api/admin/plan-requests/:requestId', requireAdmin, async (req, res) => {
  try {
    const requestId = String(req.params.requestId || '');
    const status = sanitizeText(req.body?.status, 40);
    const adminNote = sanitizeMultiline(req.body?.adminNote, 600);
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Érvénytelen kérelem státusz.' });
    }

    const requests = await readPlanRequests();
    const index = requests.findIndex(request => request.id === requestId);
    if (index < 0) return res.status(404).json({ error: 'Kérelem nem található.' });

    requests[index].status = status;
    requests[index].adminNote = adminNote;
    requests[index].updatedAt = new Date().toISOString();

    if (status === 'approved') {
      const users = (await readUsers()).map(userWithDefaults);
      const userIndex = users.findIndex(user => user.id === requests[index].userId);
      if (userIndex >= 0) {
        users[userIndex].subscriptionPlan = requests[index].requestedPlan;
        users[userIndex].updatedAt = new Date().toISOString();
        await writeUsers(users);
      }
    }

    await writePlanRequests(requests);
    return res.status(200).json({ ok: true, request: requests[index], message: status === 'approved' ? 'Kérelem jóváhagyva.' : 'Kérelem elutasítva.' });
  } catch (error) {
    console.error('admin plan request update error', error);
    return res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.get('/api/admin/contact-requests', requireAdmin, async (req, res) => {
  try {
    const requests = (await readContactRequests())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.status(200).json({ requests });
  } catch (error) {
    console.error('admin contact requests error', error);
    return res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.patch('/api/admin/contact-requests/:requestId', requireAdmin, async (req, res) => {
  try {
    const requestId = String(req.params.requestId || '');
    const status = sanitizeText(req.body?.status, 40);
    const adminNote = sanitizeMultiline(req.body?.adminNote, 800);
    if (!['new', 'in_progress', 'replied', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Érvénytelen megkeresés státusz.' });
    }

    const requests = await readContactRequests();
    const index = requests.findIndex(request => request.id === requestId);
    if (index < 0) return res.status(404).json({ error: 'Megkeresés nem található.' });

    requests[index].status = status;
    requests[index].adminNote = adminNote;
    requests[index].updatedAt = new Date().toISOString();
    await writeContactRequests(requests);

    return res.status(200).json({ ok: true, request: requests[index], message: 'Megkeresés frissítve.' });
  } catch (error) {
    console.error('admin contact request update error', error);
    return res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.get('/api/admin/messages', requireAdmin, async (req, res) => {
  try {
    const users = (await readUsers()).map(userWithDefaults).map(publicUser);
    const userById = new Map(users.map(user => [user.id, user]));
    const messages = (await readMessages())
      .map(message => ({
        ...message,
        userName: userById.get(message.userId)?.name || 'Ismeretlen felhasználó',
        userEmail: userById.get(message.userId)?.email || ''
      }))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return res.status(200).json({ messages });
  } catch (error) {
    console.error('admin messages error', error);
    return res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.post('/api/admin/messages', requireAdmin, async (req, res) => {
  try {
    const userId = sanitizeText(req.body?.userId, 80);
    const body = sanitizeMultiline(req.body?.message || req.body?.body, 1200);
    if (!body || body.length < 2) return res.status(400).json({ error: 'Írj üzenetet.' });

    const users = (await readUsers()).map(userWithDefaults);
    const user = users.find(item => item.id === userId && item.role !== 'admin');
    if (!user) return res.status(404).json({ error: 'Felhasználó nem található.' });

    const message = messageWithDefaults({
      id: crypto.randomUUID(),
      userId,
      senderRole: 'admin',
      senderName: req.session.user.name || 'Admin',
      body,
      createdAt: new Date().toISOString()
    });
    const messages = await readMessages();
    messages.push(message);
    await writeMessages(messages);
    return res.status(201).json({ ok: true, message, notice: 'Válasz elküldve.' });
  } catch (error) {
    console.error('admin message send error', error);
    return res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.post('/api/admin/tasks', requireAdmin, async (req, res) => {
  try {
    const users = (await readUsers()).map(userWithDefaults);
    const task = buildTaskFromRequest(req.body);
    const validationError = validateTask(task, users);
    if (validationError) return res.status(400).json({ error: validationError });

    const tasks = await readTasks();
    tasks.push(task);
    await writeTasks(tasks);
    return res.status(201).json({ ok: true, task: publicTask(task, true), message: 'Feladat rögzítve.' });
  } catch (error) {
    console.error('admin create task error', error);
    return res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.put('/api/admin/tasks/:taskId', requireAdmin, async (req, res) => {
  try {
    const taskId = String(req.params.taskId || '');
    const users = (await readUsers()).map(userWithDefaults);
    const tasks = await readTasks();
    const index = tasks.findIndex(task => task.id === taskId);
    if (index < 0) return res.status(404).json({ error: 'Feladat nem található.' });

    const task = buildTaskFromRequest(req.body, tasks[index]);
    const validationError = validateTask(task, users);
    if (validationError) return res.status(400).json({ error: validationError });

    tasks[index] = task;
    await writeTasks(tasks);
    return res.status(200).json({ ok: true, task: publicTask(task, true), message: 'Feladat frissítve.' });
  } catch (error) {
    console.error('admin update task error', error);
    return res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.delete('/api/admin/tasks/:taskId', requireAdmin, async (req, res) => {
  try {
    const taskId = String(req.params.taskId || '');
    const tasks = await readTasks();
    const nextTasks = tasks.filter(task => task.id !== taskId);
    if (nextTasks.length === tasks.length) return res.status(404).json({ error: 'Feladat nem található.' });

    await writeTasks(nextTasks);
    return res.status(200).json({ ok: true, message: 'Feladat törölve.' });
  } catch (error) {
    console.error('admin delete task error', error);
    return res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.post('/api/admin/users/:userId/password', requireAdmin, authLimiter, async (req, res) => {
  try {
    const userId = String(req.params.userId || '');
    const newPassword = String(req.body?.newPassword || '');

    if (!isStrongPassword(newPassword)) return res.status(400).json({ error: 'Az új jelszó nem elég erős.' });

    const users = (await readUsers()).map(userWithDefaults);
    const index = users.findIndex(u => u.id === userId);
    if (index < 0) return res.status(404).json({ error: 'Felhasználó nem található.' });

    users[index].passwordHash = await bcrypt.hash(newPassword, 12);
    users[index].mustChangePassword = true;
    users[index].recovery = null;
    users[index].updatedAt = new Date().toISOString();
    await writeUsers(users);

    return res.status(200).json({ ok: true, message: 'Jelszó frissítve. Következő belépéskor kötelező csere.' });
  } catch (error) {
    console.error('admin password change error', error);
    return res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.post('/api/admin/users/:userId/restore', requireAdmin, async (req, res) => {
  try {
    const userId = String(req.params.userId || '');
    const users = (await readUsers()).map(userWithDefaults);
    const index = users.findIndex(u => u.id === userId);
    if (index < 0) return res.status(404).json({ error: 'Felhasználó nem található.' });

    users[index].status = 'active';
    users[index].updatedAt = new Date().toISOString();
    await writeUsers(users);

    return res.status(200).json({ ok: true, message: 'Fiók visszaállítva.' });
  } catch (error) {
    console.error('admin restore error', error);
    return res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.post('/api/admin/users/:userId/disable', requireAdmin, async (req, res) => {
  try {
    const userId = String(req.params.userId || '');
    const users = (await readUsers()).map(userWithDefaults);
    const index = users.findIndex(u => u.id === userId);
    if (index < 0) return res.status(404).json({ error: 'Felhasználó nem található.' });

    if (users[index].role === 'admin') {
      return res.status(400).json({ error: 'Admin fiók nem tiltható le ezen a felületen.' });
    }

    users[index].status = 'disabled';
    users[index].updatedAt = new Date().toISOString();
    await writeUsers(users);

    return res.status(200).json({ ok: true, message: 'Fiók letiltva.' });
  } catch (error) {
    console.error('admin disable error', error);
    return res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.delete('/api/admin/users/:userId', requireAdmin, async (req, res) => {
  try {
    const userId = String(req.params.userId || '');
    const users = (await readUsers()).map(userWithDefaults);
    const index = users.findIndex(u => u.id === userId);
    if (index < 0) return res.status(404).json({ error: 'Felhasználó nem található.' });

    if (users[index].role === 'admin') {
      return res.status(400).json({ error: 'Admin fiók nem törölhető ezen a felületen.' });
    }

    const nextUsers = users.filter(user => user.id !== userId);
    const tasks = await readTasks();
    const nextTasks = tasks.filter(task => task.userId !== userId);
    const planRequests = await readPlanRequests();
    const nextPlanRequests = planRequests.filter(request => request.userId !== userId);
    const messages = await readMessages();
    const nextMessages = messages.filter(message => message.userId !== userId);

    await writeUsers(nextUsers);
    await writeTasks(nextTasks);
    await writePlanRequests(nextPlanRequests);
    await writeMessages(nextMessages);

    const removedTasks = tasks.length - nextTasks.length;
    const removedRequests = planRequests.length - nextPlanRequests.length;
    const removedMessages = messages.length - nextMessages.length;
    const removedDetails = [
      removedTasks ? `${removedTasks} előzmény` : '',
      removedRequests ? `${removedRequests} csomagkérelem` : '',
      removedMessages ? `${removedMessages} üzenet` : ''
    ].filter(Boolean).join(', ');
    return res.status(200).json({
      ok: true,
      message: removedDetails ? `Fiók törölve, kapcsolódó adatokkal együtt: ${removedDetails}.` : 'Fiók törölve.'
    });
  } catch (error) {
    console.error('admin delete user error', error);
    return res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.post('/api/admin/users/:userId/reset-token', requireAdmin, authLimiter, async (req, res) => {
  try {
    const userId = String(req.params.userId || '');
    const users = (await readUsers()).map(userWithDefaults);
    const index = users.findIndex(u => u.id === userId);
    if (index < 0) return res.status(404).json({ error: 'Felhasználó nem található.' });

    const rawToken = crypto.randomBytes(20).toString('hex');
    users[index].recovery = {
      tokenHash: toSha256(rawToken),
      expiresAt: Date.now() + 1000 * 60 * 15,
      createdAt: Date.now()
    };
    users[index].updatedAt = new Date().toISOString();
    await writeUsers(users);

    if (!IS_PROD) {
      return res.status(200).json({ ok: true, message: 'Reset token generálva.', resetToken: rawToken });
    }
    return res.status(200).json({ ok: true, message: 'Reset token generálva.' });
  } catch (error) {
    console.error('admin reset-token error', error);
    return res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.use(express.static(ROOT_DIR, {
  extensions: ['html'],
  index: 'index.html'
}));

app.get('*', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

ensureAdminUser()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Across auth server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize users database', error);
    process.exit(1);
  });
