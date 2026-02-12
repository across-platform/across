# Across-platform

Statikus weboldal minimál, biztonságos auth backenddel.

## Követelmények

- Node.js 18+

## Indítás

```bash
npm install
npm start
```

Alapértelmezett cím: `http://localhost:3000`

## Auth API

- `POST /api/auth/register`
  - body: `{ "name": "Teszt Elek", "email": "teszt@example.com", "password": "Er0sJelszo!2026" }`
- `POST /api/auth/login`
  - body: `{ "email": "teszt@example.com", "password": "Er0sJelszo!2026", "remember": true }`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/change-password` (bejelentkezett felhasználó)
  - body: `{ "currentPassword": "...", "newPassword": "..." }`
- `POST /api/auth/request-reset`
  - body: `{ "email": "teszt@example.com" }`
- `POST /api/auth/restore-account`
  - body: `{ "email": "teszt@example.com", "token": "...", "newPassword": "Er0sJelszo!2026" }`

## Admin API

Az endpointok admin sessiont igényelnek.

- `GET /api/admin/users`
- `POST /api/admin/users/:userId/password`
  - body: `{ "newPassword": "Er0sJelszo!2026" }`
- `POST /api/admin/users/:userId/disable`
- `POST /api/admin/users/:userId/restore`
- `POST /api/admin/users/:userId/reset-token`

## Admin felület

- Oldal: `http://localhost:3000/admin.html`
- Első induláskor automatikusan létrejön egy admin user, ha még nincs:
  - email: `admin@across-platform.hu`
  - jelszó: `Admin!ChangeMe2026`
- Ha a default admin jelszóval indult a rendszer, első belépéskor kötelező a jelszócsere.
- Ezt productionben azonnal cseréld le, vagy add meg környezeti változóval:
  - `ADMIN_EMAIL`
  - `ADMIN_PASSWORD`
  - `ADMIN_NAME`

## Biztonsági elemek

- `bcrypt` jelszó hash (`12` salt round)
- `helmet` biztonsági headerek + CSP
- Auth rate limit az auth endpointokra
- `httpOnly` session cookie (`sameSite=lax`, productionben `secure=true`)
- Szerveroldali email/jelszó validáció
- Szerepkör alapú hozzáférés (admin / user)
- Egyszerű bot-védelem (frontend honeypot) és kliensoldali validáció
- Visszaállító tokenes fiók-helyreállítás (15 perc)

## Konfiguráció

Ajánlott környezeti változók:

- `PORT` (alapértelmezett: `3000`)
- `SESSION_SECRET` (productionben kötelezően állítsd be)
- `NODE_ENV=production`

## Megjegyzés

A felhasználók egy helyi JSON fájlban tárolódnak (`data/users.json`), ami fejlesztéshez jó. Éles környezetben érdemes adatbázisra (pl. PostgreSQL) és dedikált session store-ra váltani.
