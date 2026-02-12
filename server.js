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

const DEV_DEFAULT_ADMIN_EMAIL = 'admin@across-platform.hu';
const DEV_DEFAULT_ADMIN_PASSWORD = 'Admin!ChangeMe2026';

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

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function sanitizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
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
    mustChangePassword: !!user.mustChangePassword,
    createdAt: user.createdAt
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

async function readUsers() {
  await ensureUsersDb();
  const raw = await fs.readFile(USERS_DB_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.users) ? parsed.users : [];
}

async function writeUsers(users) {
  await fs.writeFile(USERS_DB_PATH, JSON.stringify({ users }, null, 2));
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
