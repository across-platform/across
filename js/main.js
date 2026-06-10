// Contact form handling for static hosting: validates and opens the user's
// email client with prefilled message data.

document.addEventListener('DOMContentLoaded', () => {
	// Ensure the page starts scrolled to the top on load (fixes some browsers' anchor/restore behaviour)
	try { window.scrollTo({ top: 0, left: 0 }); } catch (e) { window.scrollTo(0, 0); }

	// Trigger contact-card fade-in when on the contact page
	const contactGlasses = document.querySelectorAll('.contact-form.glass, .contact-form .glass');
	if (contactGlasses && contactGlasses.length) {
		// small timeout so the browser paints initial state before transitioning
		contactGlasses.forEach((el, i) => {
			setTimeout(() => el.classList.add('fade-in'), 80 + i * 90);
		});
	}

	// Theme switcher: toggles dark/light themes and persists preference
	const THEME_KEY = 'ap_theme';
	function applyTheme(theme) {
		const html = document.documentElement;
		const btn = document.getElementById('theme-toggle');
		if (theme === 'dark') {
			html.setAttribute('data-theme', 'dark');
			if (btn) btn.setAttribute('aria-pressed', 'true');
		} else {
			html.removeAttribute('data-theme');
			if (btn) btn.setAttribute('aria-pressed', 'false');
		}
	}

	// initialize theme from storage or default to dark
	const storedTheme = (() => { try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }})();
	if (storedTheme) {
		applyTheme(storedTheme);
	} else {
		// default to dark
		applyTheme('dark');
	}

	const themeToggle = document.getElementById('theme-toggle');
	if (themeToggle) {
		themeToggle.addEventListener('click', () => {
			const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
			const next = isDark ? 'light' : 'dark';
			applyTheme(next);
			try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore storage errors */ }
		});
	}

	document.querySelectorAll('.navbar nav a[href]').forEach(link => {
		const href = link.getAttribute('href') || '';
		if (!href || href.startsWith('http')) return;
		try {
			const url = new URL(href, window.location.href);
			const samePage = url.pathname.split('/').pop() === window.location.pathname.split('/').pop();
			const sameHash = url.hash ? url.hash === window.location.hash : !window.location.hash;
			link.classList.toggle('is-active', samePage && sameHash);
		} catch (err) {
			/* ignore malformed local links */
		}
	});

	// Mobile nav toggle (slide-in panel)
	const navToggle = document.getElementById('nav-toggle');
	let mobilePanel = null;
	let mobileOverlay = null;
	let _prevFocused = null;
	let _focusableEls = [];
	let _firstFocusable = null;
	let _lastFocusable = null;
	let _trapHandler = null;

	function createMobilePanel() {
		if (mobilePanel) return mobilePanel;
		// create overlay
		mobileOverlay = document.createElement('div');
		mobileOverlay.className = 'mobile-nav-overlay';
		document.body.appendChild(mobileOverlay);

		mobilePanel = document.createElement('div');
		mobilePanel.className = 'mobile-nav-panel';
		mobilePanel.id = 'site-nav';
		mobilePanel.setAttribute('role', 'navigation');
		// clone nav links into panel
		const nav = document.querySelector('.navbar nav');
		if (nav) {
			const clone = nav.cloneNode(true);
			// helper to return an icon SVG by link href/text
			function getIconSVG(key) {
				key = (key || '').toLowerCase();
				if (key.includes('index') || key.includes('főoldal') || key === '/') {
					return '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M3 11.5L12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5z"/></svg>';
				}
				if (key.includes('services') || key.includes('szolg')) {
					return '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M12 2l4 4h6v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6h6l4-4zM9 13h6v2H9v-2zm0-4h6v2H9V9z"/></svg>';
				}
				if (key.includes('pricing') || key.includes('árak')) {
					return '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h12.6a1.5 1.5 0 0 1 1.06.44l2.4 2.4a1.5 1.5 0 0 1 0 2.12l-7.6 7.6a1.5 1.5 0 0 1-1.06.44H4.5A1.5 1.5 0 0 1 3 18.5v-10z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="11" r="1.2" fill="currentColor"/></svg>';
				}
				if (key.includes('contact') || key.includes('kapcsolat')) {
					return '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="14" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4.5 7l7.5 6 7.5-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
				}
				if (key.includes('auth') || key.includes('fiók') || key.includes('fiok') || key.includes('bejelent') || key.includes('regisztr')) {
					return '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
				}
				if (key.includes('admin')) {
					return '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M12 3l7 3v5c0 5-3.2 8.9-7 10-3.8-1.1-7-5-7-10V6l7-3z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
				}
				// default: envelope
				return '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M2 4h20v16H2V4zm10 8L4 6h16l-8 6z"/></svg>';
			}

			clone.querySelectorAll('a').forEach(a => {
				// determine a key by href or text
				const href = (a.getAttribute('href') || '').toLowerCase();
				const text = a.textContent.trim().toLowerCase();
				const key = href || text;
				const iconWrapper = document.createElement('span');
				iconWrapper.className = 'mobile-nav-icon';
				iconWrapper.innerHTML = getIconSVG(key);
				a.prepend(iconWrapper);
				a.addEventListener('click', () => closePanel());
			});
			mobilePanel.appendChild(clone);
		}
		const closeBtn = document.createElement('button');
		closeBtn.className = 'mobile-nav-close';
		closeBtn.setAttribute('aria-label', 'Bezárás');
		closeBtn.innerHTML = '&times;';
		closeBtn.addEventListener('click', () => closePanel());
		mobilePanel.appendChild(closeBtn);
		document.body.appendChild(mobilePanel);
		// clicking overlay closes the panel
		mobileOverlay.addEventListener('click', () => closePanel());
		return mobilePanel;
	}

	function openPanel() {
		const panel = createMobilePanel();
		panel.classList.add('open');
		document.documentElement.style.overflow = 'hidden';
		if (mobileOverlay) mobileOverlay.classList.add('visible');
		navToggle.setAttribute('aria-expanded', 'true');

		// Focus trap: save previous focus and trap Tab inside the panel
		try {
			_prevFocused = document.activeElement;
			_focusableEls = Array.from(panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'))
				.filter(el => el.offsetParent !== null);
			_firstFocusable = _focusableEls[0] || null;
			_lastFocusable = _focusableEls[_focusableEls.length - 1] || null;
			if (_firstFocusable) _firstFocusable.focus();

			_trapHandler = function(e) {
				if (e.key !== 'Tab') return;
				if (!_focusableEls.length) {
					e.preventDefault();
					return;
				}
				const active = document.activeElement;
				if (e.shiftKey) {
					if (active === _firstFocusable) {
						e.preventDefault();
						_lastFocusable.focus();
					}
				} else {
					if (active === _lastFocusable) {
						e.preventDefault();
						_firstFocusable.focus();
					}
				}
			};
			document.addEventListener('keydown', _trapHandler);
		} catch (err) { /* swallow focus trap errors */ }
	}

	function closePanel() {
		if (!mobilePanel) return;
		mobilePanel.classList.remove('open');
		document.documentElement.style.overflow = '';
		if (mobileOverlay) mobileOverlay.classList.remove('visible');
		navToggle.setAttribute('aria-expanded', 'false');

		// release focus trap and restore previous focus
		try {
			if (_trapHandler) document.removeEventListener('keydown', _trapHandler);
			_trapHandler = null;
			_focusableEls = [];
			_firstFocusable = null;
			_lastFocusable = null;
			if (_prevFocused && typeof _prevFocused.focus === 'function') _prevFocused.focus();
			_prevFocused = null;
		} catch (err) { /* ignore */ }
	}

	if (navToggle) {
		navToggle.addEventListener('click', () => {
			const expanded = navToggle.getAttribute('aria-expanded') === 'true';
			if (expanded) closePanel(); else openPanel();
		});
		// close panel on ESC
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') closePanel();
		});
	}

	// Ensure the UI adapts when resizing the window: if switching back to
	// desktop width, close and remove the mobile panel to avoid stale state.
	window.addEventListener('resize', () => {
		const isDesktop = window.innerWidth > 880;
		if (isDesktop) {
			// close panel if open
			try { if (mobilePanel && mobilePanel.classList.contains('open')) closePanel(); } catch (e) {}
			// remove the panel DOM so it can be re-created fresh later
			if (mobilePanel && mobilePanel.parentNode) {
				mobilePanel.parentNode.removeChild(mobilePanel);
			}
			if (mobileOverlay && mobileOverlay.parentNode) {
				mobileOverlay.parentNode.removeChild(mobileOverlay);
			}
			mobilePanel = null;
			mobileOverlay = null;
			if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
		}
	});

	const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const isBackendOrigin = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

	function setSubmitDisabled(formEl, disabled) {
		if (!formEl) return;
		const btn = formEl.querySelector('button[type="submit"]');
		if (btn) btn.disabled = !!disabled;
	}

	const contactForm = document.getElementById('contact-form');
	if (contactForm) {
		contactForm.addEventListener('submit', (e) => {
			e.preventDefault();

			const name = contactForm.querySelector('input[name="name"]')?.value?.trim() || '';
			const email = contactForm.querySelector('input[name="email"]')?.value?.trim() || '';
			const message = contactForm.querySelector('textarea[name="message"]')?.value?.trim() || '';

			if (!name) {
				alert('Kérlek add meg a neved.');
				return;
			}
			if (!email || !emailPattern.test(email)) {
				alert('Kérlek adj meg egy érvényes email címet.');
				return;
			}
			if (!message) {
				alert('Kérlek írj üzenetet.');
				return;
			}

			const recipient = contactForm.getAttribute('data-contact-email') || 'info@across-platform.hu';
			const subject = 'Új kapcsolatfelvétel az across-platform oldalról';
			const body = [
				`Név: ${name}`,
				`Email: ${email}`,
				'',
				'Üzenet:',
				message
			].join('\n');
			const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

			window.location.href = mailtoUrl;
			alert('Megnyitottuk az email kliensedet az előtöltött üzenettel.');
			contactForm.reset();
		});
	}

	const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,}$/;

	function passwordStrengthLabel(password) {
		if (!password || password.length < 8) return 'Jelszóerősség: gyenge';
		if (strongPasswordPattern.test(password)) return 'Jelszóerősség: erős';
		return 'Jelszóerősség: közepes';
	}

	const authRoot = document.getElementById('auth');
	if (authRoot) {
		const tabs = authRoot.querySelectorAll('.auth-tab');
		const panels = {
			login: document.getElementById('auth-login-panel'),
			register: document.getElementById('auth-register-panel'),
			recover: document.getElementById('auth-recover-panel')
		};
		const authStatus = document.getElementById('auth-status');
		const loginForm = document.getElementById('login-form');
		const forcePasswordForm = document.getElementById('force-password-form');
		const registerForm = document.getElementById('register-form');
		const recoverRequestForm = document.getElementById('recover-request-form');
		const recoverApplyForm = document.getElementById('recover-apply-form');
		const registerPasswordInput = document.getElementById('register-password');
		const registerPasswordConfirmInput = document.getElementById('register-password-confirm');
		const passwordHint = document.getElementById('password-hint');
		const accountDashboard = document.getElementById('account-dashboard');
		const accountGreeting = document.getElementById('account-greeting');
		const accountEmail = document.getElementById('account-email');
		const accountLogoutBtn = document.getElementById('account-logout');
		const accountSolved = document.getElementById('account-solved');
		const accountAverageTime = document.getElementById('account-average-time');
		const accountLastHelp = document.getElementById('account-last-help');
		const subscriptionStatus = document.getElementById('subscription-status');
		const subscriptionPlan = document.getElementById('subscription-plan');
		const subscriptionRenewal = document.getElementById('subscription-renewal');
		const subscriptionFeatures = document.getElementById('subscription-features');
		const supportHistoryList = document.getElementById('support-history-list');

		function setAuthStatus(message, tone) {
			if (!authStatus) return;
			authStatus.textContent = message || '';
			authStatus.classList.remove('is-error', 'is-success');
			if (tone === 'error') authStatus.classList.add('is-error');
			if (tone === 'success') authStatus.classList.add('is-success');
		}

		async function authApiJson(url, options) {
			const response = await fetch(url, {
				credentials: 'same-origin',
				...options
			});
			const payload = await response.json().catch(() => ({}));
			return { response, payload };
		}

		function textEl(tagName, className, text) {
			const el = document.createElement(tagName);
			if (className) el.className = className;
			el.textContent = text;
			return el;
		}

		function formatAccountDate(value) {
			if (!value) return 'Nincs adat';
			try {
				return new Intl.DateTimeFormat('hu-HU', {
					year: 'numeric',
					month: '2-digit',
					day: '2-digit'
				}).format(new Date(value));
			} catch (err) {
				return 'Nincs adat';
			}
		}

		function formatDuration(minutes) {
			const value = Number(minutes) || 0;
			if (value < 60) return `${value} perc`;
			const hours = Math.floor(value / 60);
			const rest = value % 60;
			return rest ? `${hours} óra ${rest} perc` : `${hours} óra`;
		}

		function toggleForcePasswordForm(show) {
			if (!forcePasswordForm) return;
			forcePasswordForm.hidden = !show;
			if (!show) forcePasswordForm.reset();
		}

		function setAccountMode(mode) {
			const isDashboard = mode === 'dashboard';
			if (accountDashboard) accountDashboard.hidden = !isDashboard;
			tabs.forEach(btn => { btn.hidden = isDashboard; });
			Object.values(panels).forEach(panel => {
				if (panel) panel.hidden = isDashboard ? true : panel.hidden;
			});
			const tabsWrap = authRoot.querySelector('.auth-tabs');
			if (tabsWrap) tabsWrap.hidden = isDashboard;
			if (!isDashboard) {
				if (panels.login) panels.login.hidden = false;
				switchAuthTab('login');
			}
		}

		function renderAccountDashboard(data) {
			const user = data.user || {};
			const stats = data.stats || {};
			const subscription = data.subscription || {};
			const history = Array.isArray(data.history) ? data.history : [];

			if (accountGreeting) accountGreeting.textContent = `Szia, ${user.name || 'felhasználó'}!`;
			if (accountEmail) accountEmail.textContent = user.email || '';
			if (accountSolved) accountSolved.textContent = `${stats.solved || 0}/${stats.total || history.length}`;
			if (accountAverageTime) accountAverageTime.textContent = formatDuration(stats.averageMinutes || 0);
			if (accountLastHelp) accountLastHelp.textContent = formatAccountDate(stats.lastHelpAt || history[0]?.date);
			if (subscriptionStatus) subscriptionStatus.textContent = subscription.status || 'Nincs aktív csomag';
			if (subscriptionPlan) subscriptionPlan.textContent = subscription.plan || 'Nincs kiválasztott csomag';
			if (subscriptionRenewal) {
				const used = subscription.usedMinutes ?? 0;
				const included = subscription.includedMinutes ?? 0;
				subscriptionRenewal.textContent = `Következő megújulás: ${formatAccountDate(subscription.renewalDate)} · Felhasznált idő: ${used}/${included} perc`;
			}

			if (subscriptionFeatures) {
				subscriptionFeatures.innerHTML = '';
				(subscription.features || []).forEach(feature => {
					const li = textEl('li', '', feature);
					subscriptionFeatures.appendChild(li);
				});
			}

			if (supportHistoryList) {
				supportHistoryList.innerHTML = '';
				if (!history.length) {
					supportHistoryList.appendChild(textEl('p', 'auth-hint', 'Még nincs rögzített segítségkérés.'));
				}
				history.forEach(item => {
					const row = document.createElement('article');
					row.className = 'history-item';

					const header = document.createElement('div');
					header.className = 'history-item-header';
					header.replaceChildren(
						textEl('strong', '', item.topic || 'Segítségkérés'),
						textEl('span', item.successful ? 'account-badge is-success' : 'account-badge is-warning', item.result || 'Feldolgozás alatt')
					);

					const meta = document.createElement('div');
					meta.className = 'history-meta';
					meta.replaceChildren(
						textEl('span', '', `Mikor: ${formatAccountDate(item.date)}`),
						textEl('span', '', `Segített: ${item.helper || 'Across-platform'}`),
						textEl('span', '', `Időtartam: ${formatDuration(item.durationMinutes)}`)
					);

					row.replaceChildren(header, meta, textEl('p', 'auth-hint', item.note || ''));
					supportHistoryList.appendChild(row);
				});
			}

			setAccountMode('dashboard');
			if (window.location.hash) {
				const targetId = window.location.hash.slice(1);
				const target = targetId ? document.getElementById(targetId) : null;
				if (target) setTimeout(() => target.scrollIntoView({ block: 'start' }), 60);
			}
		}

		async function loadAccountDashboard(showSuccess) {
			const { response, payload } = await authApiJson('/api/account/overview');
			if (!response.ok) {
				setAccountMode('forms');
				setAuthStatus(payload.error || 'Jelentkezz be a fiókfelület megnyitásához.', 'error');
				return false;
			}
			renderAccountDashboard(payload);
			if (showSuccess) setAuthStatus('Sikeres bejelentkezés.', 'success');
			return true;
		}

		function switchAuthTab(tabName) {
			tabs.forEach(btn => {
				const isActive = btn.getAttribute('data-auth-tab') === tabName;
				btn.classList.toggle('is-active', isActive);
				btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
			});

			if (panels.login) panels.login.hidden = tabName !== 'login';
			if (panels.register) panels.register.hidden = tabName !== 'register';
			if (panels.recover) panels.recover.hidden = tabName !== 'recover';
			if (tabName !== 'login') toggleForcePasswordForm(false);
			setAuthStatus('');
		}

		async function bootstrapAccount() {
			if (!isBackendOrigin) {
				setAccountMode('forms');
				setAuthStatus('A fiókfelülethez a Node szerverről megnyitott oldalt használd.', 'error');
				return;
			}
			await loadAccountDashboard(false);
		}

		const mustChangeFlag = new URLSearchParams(window.location.search).get('mustChange');
		if (mustChangeFlag === '1') {
			switchAuthTab('login');
			setAuthStatus('Első belépésnél kötelező a jelszócsere.', 'error');
			toggleForcePasswordForm(true);
		}

		tabs.forEach(btn => {
			btn.addEventListener('click', () => {
				const tabName = btn.getAttribute('data-auth-tab');
				if (!tabName) return;
				switchAuthTab(tabName);
			});
		});

		if (registerPasswordInput && passwordHint) {
			registerPasswordInput.addEventListener('input', () => {
				const password = registerPasswordInput.value || '';
				passwordHint.textContent = `${passwordStrengthLabel(password)}. Tartalmazzon kis- és nagybetűt, számot, valamint speciális karaktert.`;
			});
		}

		if (registerForm) {
			registerForm.addEventListener('submit', async (e) => {
				e.preventDefault();
				setAuthStatus('');

				const name = registerForm.querySelector('input[name="name"]')?.value?.trim() || '';
				const email = registerForm.querySelector('input[name="email"]')?.value?.trim() || '';
				const password = registerPasswordInput?.value || '';
				const passwordConfirm = registerPasswordConfirmInput?.value || '';
				const acceptTerms = registerForm.querySelector('input[name="acceptTerms"]')?.checked;
				const honeypot = registerForm.querySelector('input[name="company"]')?.value?.trim() || '';

				if (honeypot) {
					setAuthStatus('A kérés nem feldolgozható.', 'error');
					return;
				}
				if (!name || name.length < 2) {
					setAuthStatus('Add meg a teljes neved.', 'error');
					return;
				}
				if (!emailPattern.test(email)) {
					setAuthStatus('Adj meg érvényes email címet.', 'error');
					return;
				}
				if (!strongPasswordPattern.test(password)) {
					setAuthStatus('A jelszó nem elég erős (min. 12 karakter, kis- és nagybetű, szám, speciális karakter).', 'error');
					return;
				}
				if (password !== passwordConfirm) {
					setAuthStatus('A két jelszó nem egyezik.', 'error');
					return;
				}
				if (!acceptTerms) {
					setAuthStatus('A regisztrációhoz el kell fogadnod a feltételeket.', 'error');
					return;
				}

				setSubmitDisabled(registerForm, true);
				try {
					const { response, payload } = await authApiJson('/api/auth/register', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ name, email, password })
					});

					if (!response.ok) {
						setAuthStatus(payload.error || 'A regisztráció nem sikerült. Kérlek próbáld újra.', 'error');
						return;
					}

					setAuthStatus('Sikeres regisztráció. Most jelentkezz be.', 'success');
					registerForm.reset();
					switchAuthTab('login');
				} catch (err) {
					setAuthStatus('A biztonságos szerverkapcsolat most nem érhető el. Kérlek próbáld újra később.', 'error');
				} finally {
					setSubmitDisabled(registerForm, false);
				}
			});
		}

		if (loginForm) {
			loginForm.addEventListener('submit', async (e) => {
				e.preventDefault();
				setAuthStatus('');

				const email = loginForm.querySelector('input[name="email"]')?.value?.trim() || '';
				const password = loginForm.querySelector('input[name="password"]')?.value || '';
				const remember = !!loginForm.querySelector('input[name="remember"]')?.checked;

				if (!emailPattern.test(email)) {
					setAuthStatus('Adj meg érvényes email címet.', 'error');
					return;
				}
				if (password.length < 12) {
					setAuthStatus('A jelszó túl rövid.', 'error');
					return;
				}

				setSubmitDisabled(loginForm, true);
				try {
					const { response, payload } = await authApiJson('/api/auth/login', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ email, password, remember })
					});

					if (!response.ok) {
						setAuthStatus(payload.error || 'A bejelentkezés sikertelen. Ellenőrizd az adataidat.', 'error');
						return;
					}

					if (payload.mustChangePassword) {
						setAuthStatus('Első belépésnél kötelező a jelszócsere.', 'error');
						toggleForcePasswordForm(true);
						return;
					}

					setAuthStatus('Sikeres bejelentkezés.', 'success');
					loginForm.reset();
					toggleForcePasswordForm(false);
					if (payload.user?.role === 'admin') {
						window.location.href = 'admin.html';
					} else {
						await loadAccountDashboard(true);
					}
				} catch (err) {
					setAuthStatus('A biztonságos szerverkapcsolat most nem érhető el. Kérlek próbáld újra később.', 'error');
				} finally {
					setSubmitDisabled(loginForm, false);
				}
			});
		}

		if (forcePasswordForm) {
			forcePasswordForm.addEventListener('submit', async (e) => {
				e.preventDefault();
				setAuthStatus('');

				const currentPassword = forcePasswordForm.querySelector('input[name="currentPassword"]')?.value || '';
				const newPassword = forcePasswordForm.querySelector('input[name="newPassword"]')?.value || '';

				if (!currentPassword) {
					setAuthStatus('Add meg a jelenlegi jelszót.', 'error');
					return;
				}
				if (!strongPasswordPattern.test(newPassword)) {
					setAuthStatus('Az új jelszó nem elég erős.', 'error');
					return;
				}

				setSubmitDisabled(forcePasswordForm, true);
				try {
					const { response, payload } = await authApiJson('/api/auth/change-password', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ currentPassword, newPassword })
					});
					if (!response.ok) {
						setAuthStatus(payload.error || 'A jelszócsere nem sikerült.', 'error');
						return;
					}

					setAuthStatus(payload.message || 'A jelszó sikeresen módosítva.', 'success');
					toggleForcePasswordForm(false);
					forcePasswordForm.reset();
					const meResponse = await fetch('/api/auth/me', { credentials: 'same-origin' });
					const mePayload = await meResponse.json().catch(() => ({}));
					if (meResponse.ok && mePayload.user?.role === 'admin') {
						window.location.href = 'admin.html';
					} else {
						await loadAccountDashboard(true);
					}
				} catch (err) {
					setAuthStatus('A biztonságos szerverkapcsolat most nem érhető el. Kérlek próbáld újra később.', 'error');
				} finally {
					setSubmitDisabled(forcePasswordForm, false);
				}
			});
		}

		if (recoverRequestForm) {
			recoverRequestForm.addEventListener('submit', async (e) => {
				e.preventDefault();
				setAuthStatus('');
				const email = recoverRequestForm.querySelector('input[name="email"]')?.value?.trim() || '';
				if (!emailPattern.test(email)) {
					setAuthStatus('Adj meg érvényes email címet.', 'error');
					return;
				}

				setSubmitDisabled(recoverRequestForm, true);
				try {
					const { response, payload } = await authApiJson('/api/auth/request-reset', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ email })
					});
					if (!response.ok) {
						setAuthStatus(payload.error || 'A visszaállítási kérés nem sikerült.', 'error');
						return;
					}

					if (payload.resetToken) {
						setAuthStatus(`${payload.message} Token: ${payload.resetToken}`, 'success');
					} else {
						setAuthStatus(payload.message || 'Ha létezik ilyen fiók, küldtünk visszaállítási lehetőséget.', 'success');
					}
					recoverRequestForm.reset();
				} catch (err) {
					setAuthStatus('A biztonságos szerverkapcsolat most nem érhető el. Kérlek próbáld újra később.', 'error');
				} finally {
					setSubmitDisabled(recoverRequestForm, false);
				}
			});
		}

		if (recoverApplyForm) {
			recoverApplyForm.addEventListener('submit', async (e) => {
				e.preventDefault();
				setAuthStatus('');

				const email = recoverApplyForm.querySelector('input[name="email"]')?.value?.trim() || '';
				const token = recoverApplyForm.querySelector('input[name="token"]')?.value?.trim() || '';
				const newPassword = recoverApplyForm.querySelector('input[name="newPassword"]')?.value || '';

				if (!emailPattern.test(email)) {
					setAuthStatus('Adj meg érvényes email címet.', 'error');
					return;
				}
				if (!token) {
					setAuthStatus('Add meg a visszaállító tokent.', 'error');
					return;
				}
				if (!strongPasswordPattern.test(newPassword)) {
					setAuthStatus('Az új jelszó nem elég erős.', 'error');
					return;
				}

				setSubmitDisabled(recoverApplyForm, true);
				try {
					const { response, payload } = await authApiJson('/api/auth/restore-account', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ email, token, newPassword })
					});
					if (!response.ok) {
						setAuthStatus(payload.error || 'A fiók visszaállítása nem sikerült.', 'error');
						return;
					}

					setAuthStatus(payload.message || 'A fiók visszaállítva.', 'success');
					recoverApplyForm.reset();
					switchAuthTab('login');
				} catch (err) {
					setAuthStatus('A biztonságos szerverkapcsolat most nem érhető el. Kérlek próbáld újra később.', 'error');
				} finally {
					setSubmitDisabled(recoverApplyForm, false);
				}
			});
		}

		if (accountLogoutBtn) {
			accountLogoutBtn.addEventListener('click', async () => {
				await authApiJson('/api/auth/logout', { method: 'POST' });
				setAccountMode('forms');
				setAuthStatus('Kijelentkezve.', 'success');
			});
		}

		bootstrapAccount().catch(() => {
			setAccountMode('forms');
			setAuthStatus('A fiókfelület most nem érhető el.', 'error');
		});
	}

	const adminRoot = document.getElementById('admin');
	if (adminRoot) {
		const adminStatus = document.getElementById('admin-status');
		const adminLoginForm = document.getElementById('admin-login-form');
		const adminForcePasswordForm = document.getElementById('admin-force-password-form');
		const adminSessionUser = document.getElementById('admin-session-user');
		const adminLogoutBtn = document.getElementById('admin-logout');
		const adminApp = document.getElementById('admin-app');
		const adminNavBtns = adminRoot.querySelectorAll('.admin-nav-btn');
		const adminViews = {
			users: document.getElementById('admin-users-view'),
			tasks: document.getElementById('admin-tasks-view')
		};
		const adminUsersList = document.getElementById('admin-users');
		const adminUserSelect = document.getElementById('admin-user-select');
		const adminTaskUserSelect = document.getElementById('admin-task-user');
		const adminPasswordForm = document.getElementById('admin-password-form');
		const adminDisableBtn = document.getElementById('admin-disable-user');
		const adminRestoreBtn = document.getElementById('admin-restore-user');
		const adminGenerateTokenBtn = document.getElementById('admin-generate-token');
		const adminRefreshUsersBtn = document.getElementById('admin-refresh-users');
		const adminTokenOutput = document.getElementById('admin-token-output');
		const adminSelectedSummary = document.getElementById('admin-selected-summary');
		const adminStatUsers = document.getElementById('admin-stat-users');
		const adminStatTasks = document.getElementById('admin-stat-tasks');
		const adminStatSuccess = document.getElementById('admin-stat-success');
		const adminTaskForm = document.getElementById('admin-task-form');
		const adminTaskId = document.getElementById('admin-task-id');
		const adminTaskFormTitle = document.getElementById('admin-task-form-title');
		const adminTaskList = document.getElementById('admin-task-list');
		const adminNewTaskBtn = document.getElementById('admin-new-task');
		const adminTaskResetBtn = document.getElementById('admin-task-reset');

		if (!isBackendOrigin) {
			setAdminMode('unauth');
			setAdminStatus('Az admin belépéshez a Node szerverről megnyitott oldalt használd.', 'error');
			if (adminSessionUser) adminSessionUser.textContent = 'Live Serveren az API nem érhető el';
			return;
		}

		function setAdminStatus(message, tone) {
			if (!adminStatus) return;
			adminStatus.textContent = message || '';
			adminStatus.classList.remove('is-error', 'is-success');
			if (tone === 'error') adminStatus.classList.add('is-error');
			if (tone === 'success') adminStatus.classList.add('is-success');
		}

		async function apiJson(url, options) {
			const response = await fetch(url, {
				credentials: 'same-origin',
				...options
			});
			const payload = await response.json().catch(() => ({}));
			return { response, payload };
		}

		let cachedUsers = [];
		let cachedTasks = [];

		function setAdminMode(mode) {
			const showLogin = mode === 'unauth';
			const showForce = mode === 'must-change';
			const showMain = mode === 'ready';

			if (adminLoginForm) {
				adminLoginForm.hidden = !showLogin;
				if (!showLogin) adminLoginForm.reset();
			}
			if (adminForcePasswordForm) {
				adminForcePasswordForm.hidden = !showForce;
				if (!showForce) adminForcePasswordForm.reset();
			}
			if (adminApp) adminApp.hidden = !showMain;
			if (adminLogoutBtn) adminLogoutBtn.hidden = mode === 'unauth';
		}

		function selectedUser() {
			if (!adminUserSelect) return null;
			return cachedUsers.find(user => user.id === adminUserSelect.value) || null;
		}

		function formatDate(value) {
			if (!value) return 'ismeretlen';
			try {
				return new Intl.DateTimeFormat('hu-HU', {
					year: 'numeric',
					month: '2-digit',
					day: '2-digit'
				}).format(new Date(value));
			} catch (err) {
				return 'ismeretlen';
			}
		}

		function formatDateTimeInput(value) {
			const date = value ? new Date(value) : new Date();
			if (Number.isNaN(date.getTime())) return '';
			const offset = date.getTimezoneOffset();
			const local = new Date(date.getTime() - offset * 60000);
			return local.toISOString().slice(0, 16);
		}

		function roleLabel(role) {
			return role === 'admin' ? 'Admin' : 'Felhasználó';
		}

		function statusLabel(status) {
			if (status === 'successful') return 'Sikeres';
			if (status === 'followup') return 'Utánkövetés';
			if (status === 'failed') return 'Sikertelen';
			return status === 'active' ? 'Aktív' : 'Letiltva';
		}

		function textEl(tagName, className, text) {
			const el = document.createElement(tagName);
			if (className) el.className = className;
			el.textContent = text;
			return el;
		}

		function setAdminView(viewName) {
			Object.entries(adminViews).forEach(([name, panel]) => {
				if (panel) panel.hidden = name !== viewName;
			});
			adminNavBtns.forEach(btn => {
				btn.classList.toggle('is-active', btn.getAttribute('data-admin-view') === viewName);
			});
		}

		function userName(userId) {
			const user = cachedUsers.find(item => item.id === userId);
			return user ? `${user.name} (${user.email})` : 'Ismeretlen felhasználó';
		}

		function updateAdminStats() {
			if (adminStatUsers) adminStatUsers.textContent = String(cachedUsers.length);
			if (adminStatTasks) adminStatTasks.textContent = String(cachedTasks.length);
			if (adminStatSuccess) {
				adminStatSuccess.textContent = String(cachedTasks.filter(task => task.status === 'successful').length);
			}
		}

		function updateSelectedSummary() {
			if (!adminSelectedSummary) return;
			const user = selectedUser();
			if (!user) {
				adminSelectedSummary.textContent = 'Nincs kiválasztott felhasználó.';
				return;
			}

			const taskCount = cachedTasks.filter(task => task.userId === user.id).length;
			adminSelectedSummary.replaceChildren(
				textEl('strong', '', user.name),
				textEl('span', '', user.email),
				textEl('span', '', `${roleLabel(user.role)} · ${statusLabel(user.status)} · létrehozva: ${formatDate(user.createdAt)} · feladatok: ${taskCount}`)
			);
		}

		function renderUserOptions(selectEl, includeAdmins) {
			if (!selectEl) return;
			const currentValue = selectEl.value;
			selectEl.innerHTML = '';
			cachedUsers
				.filter(user => includeAdmins || user.role !== 'admin')
				.forEach(user => {
					const option = document.createElement('option');
					option.value = user.id;
					option.textContent = `${user.name} (${user.email})`;
					selectEl.appendChild(option);
				});
			if (currentValue && Array.from(selectEl.options).some(option => option.value === currentValue)) {
				selectEl.value = currentValue;
			}
		}

		function renderUsers(users) {
			cachedUsers = Array.isArray(users) ? users : [];
			renderUserOptions(adminUserSelect, true);
			renderUserOptions(adminTaskUserSelect, false);
			updateSelectedSummary();

			if (adminUsersList) {
				adminUsersList.innerHTML = '';
				cachedUsers.forEach(user => {
					const li = document.createElement('li');
					const statusClass = user.status === 'active' ? 'is-active' : 'is-disabled';
					const identity = document.createElement('div');
					identity.replaceChildren(
						textEl('strong', '', user.name),
						textEl('span', '', user.email)
					);

					const meta = document.createElement('div');
					meta.className = 'admin-user-meta';
					meta.replaceChildren(
						textEl('span', 'admin-badge', roleLabel(user.role)),
						textEl('span', `admin-badge ${statusClass}`, statusLabel(user.status)),
						textEl('span', 'admin-badge', `${cachedTasks.filter(task => task.userId === user.id).length} feladat`)
					);

					li.replaceChildren(identity, meta);
					adminUsersList.appendChild(li);
				});
			}
			updateAdminStats();
		}

		function renderTasks(tasks) {
			cachedTasks = Array.isArray(tasks) ? tasks : [];
			if (!adminTaskList) return;
			adminTaskList.innerHTML = '';

			if (!cachedTasks.length) {
				adminTaskList.appendChild(textEl('p', 'auth-hint', 'Még nincs rögzített elvégzett feladat.'));
				updateAdminStats();
				updateSelectedSummary();
				return;
			}

			cachedTasks.forEach(task => {
				const item = document.createElement('article');
				item.className = 'admin-task-item';

				const header = document.createElement('div');
				header.className = 'admin-task-item-header';
				header.replaceChildren(
					textEl('strong', '', task.topic || 'Feladat'),
					textEl('span', `admin-badge ${task.status === 'successful' ? 'is-active' : 'is-disabled'}`, statusLabel(task.status))
				);

				const meta = document.createElement('div');
				meta.className = 'history-meta';
				meta.replaceChildren(
					textEl('span', '', userName(task.userId)),
					textEl('span', '', `Segített: ${task.helper || 'Across-platform'}`),
					textEl('span', '', `${formatDate(task.completedAt)} · ${task.durationMinutes || 0} perc`)
				);

				const actions = document.createElement('div');
				actions.className = 'admin-task-actions';
				const editBtn = textEl('button', 'btn secondary', 'Szerkesztés');
				editBtn.type = 'button';
				editBtn.addEventListener('click', () => populateTaskForm(task));
				const deleteBtn = textEl('button', 'btn secondary danger', 'Törlés');
				deleteBtn.type = 'button';
				deleteBtn.addEventListener('click', () => deleteTask(task.id));
				actions.replaceChildren(editBtn, deleteBtn);

				item.replaceChildren(header, meta, textEl('p', 'auth-hint', task.solution || task.note || ''), actions);
				adminTaskList.appendChild(item);
			});

			updateAdminStats();
			updateSelectedSummary();
		}

		async function loadAdminUsers() {
			const { response, payload } = await apiJson('/api/admin/users');
			if (!response.ok) throw new Error(payload.error || 'A felhasználólista nem tölthető be.');
			renderUsers(payload.users || []);
		}

		async function loadAdminTasks() {
			const { response, payload } = await apiJson('/api/admin/tasks');
			if (!response.ok) throw new Error(payload.error || 'A feladatlista nem tölthető be.');
			renderTasks(payload.tasks || []);
		}

		async function refreshAdminData() {
			await loadAdminUsers();
			await loadAdminTasks();
			renderUsers(cachedUsers);
		}

		function resetTaskForm() {
			if (!adminTaskForm) return;
			adminTaskForm.reset();
			if (adminTaskId) adminTaskId.value = '';
			if (adminTaskFormTitle) adminTaskFormTitle.textContent = 'Feladat rögzítése';
			const completedInput = document.getElementById('admin-task-completed');
			if (completedInput) completedInput.value = formatDateTimeInput(new Date().toISOString());
			renderUserOptions(adminTaskUserSelect, false);
		}

		function populateTaskForm(task) {
			if (!adminTaskForm) return;
			setAdminView('tasks');
			if (adminTaskId) adminTaskId.value = task.id || '';
			if (adminTaskFormTitle) adminTaskFormTitle.textContent = 'Feladat szerkesztése';
			adminTaskForm.elements.userId.value = task.userId || '';
			adminTaskForm.elements.helper.value = task.helper || '';
			adminTaskForm.elements.completedAt.value = formatDateTimeInput(task.completedAt);
			adminTaskForm.elements.topic.value = task.topic || '';
			adminTaskForm.elements.status.value = task.status || 'successful';
			adminTaskForm.elements.durationMinutes.value = task.durationMinutes || '';
			adminTaskForm.elements.device.value = task.device || '';
			adminTaskForm.elements.solution.value = task.solution || task.note || '';
			adminTaskForm.elements.internalNote.value = task.internalNote || '';
			adminTaskForm.scrollIntoView({ block: 'start' });
		}

		function taskPayloadFromForm() {
			return {
				userId: adminTaskForm.elements.userId.value,
				helper: adminTaskForm.elements.helper.value.trim(),
				completedAt: adminTaskForm.elements.completedAt.value,
				topic: adminTaskForm.elements.topic.value.trim(),
				status: adminTaskForm.elements.status.value,
				durationMinutes: adminTaskForm.elements.durationMinutes.value,
				device: adminTaskForm.elements.device.value.trim(),
				solution: adminTaskForm.elements.solution.value.trim(),
				internalNote: adminTaskForm.elements.internalNote.value.trim()
			};
		}

		async function deleteTask(taskId) {
			if (!taskId) return;
			const { response, payload } = await apiJson(`/api/admin/tasks/${encodeURIComponent(taskId)}`, { method: 'DELETE' });
			if (!response.ok) {
				setAdminStatus(payload.error || 'A feladat törlése nem sikerült.', 'error');
				return;
			}
			setAdminStatus(payload.message || 'Feladat törölve.', 'success');
			resetTaskForm();
			await loadAdminTasks();
			renderUsers(cachedUsers);
		}

		async function bootstrapAdmin() {
			setAdminStatus('Jogosultság ellenőrzése...');
			const { response, payload } = await apiJson('/api/auth/me');
			if (!response.ok) {
				setAdminMode('unauth');
				setAdminStatus('Jelentkezz be admin fiókkal.', 'error');
				if (adminSessionUser) adminSessionUser.textContent = 'Nincs bejelentkezve';
				return;
			}

			const user = payload.user || {};
			if (user.mustChangePassword) {
				setAdminMode('must-change');
				setAdminStatus('Első belépésnél kötelező a jelszócsere.', 'error');
				if (adminSessionUser) adminSessionUser.textContent = `Bejelentkezve: ${user.name} (${user.email})`;
				return;
			}
			if (user.role !== 'admin') {
				setAdminMode('unauth');
				setAdminStatus('Ehhez az oldalhoz admin jogosultság kell.', 'error');
				if (adminSessionUser) adminSessionUser.textContent = `Bejelentkezve: ${user.name} (${user.email})`;
				return;
			}

			setAdminMode('ready');
			setAdminView('users');
			if (adminSessionUser) adminSessionUser.textContent = `Bejelentkezve: ${user.name} (${user.email})`;
			await refreshAdminData();
			resetTaskForm();
			setAdminStatus('Admin felület betöltve.', 'success');
		}

		if (adminLoginForm) {
			adminLoginForm.addEventListener('submit', async (e) => {
				e.preventDefault();
				setAdminStatus('');

				const email = adminLoginForm.querySelector('input[name="email"]')?.value?.trim() || '';
				const password = adminLoginForm.querySelector('input[name="password"]')?.value || '';
				if (!emailPattern.test(email)) {
					setAdminStatus('Adj meg érvényes email címet.', 'error');
					return;
				}
				if (!password) {
					setAdminStatus('Add meg a jelszót.', 'error');
					return;
				}

				setSubmitDisabled(adminLoginForm, true);
				try {
					const { response, payload } = await apiJson('/api/auth/login', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ email, password, remember: true })
					});
					if (!response.ok) {
						setAdminStatus(payload.error || 'A belépés sikertelen.', 'error');
						return;
					}

					await bootstrapAdmin();
				} catch (err) {
					setAdminStatus('A szerver most nem érhető el.', 'error');
				} finally {
					setSubmitDisabled(adminLoginForm, false);
				}
			});
		}

		if (adminForcePasswordForm) {
			adminForcePasswordForm.addEventListener('submit', async (e) => {
				e.preventDefault();
				setAdminStatus('');
				const currentPassword = adminForcePasswordForm.querySelector('input[name="currentPassword"]')?.value || '';
				const newPassword = adminForcePasswordForm.querySelector('input[name="newPassword"]')?.value || '';

				if (!currentPassword) {
					setAdminStatus('Add meg a jelenlegi jelszót.', 'error');
					return;
				}
				if (!strongPasswordPattern.test(newPassword)) {
					setAdminStatus('Az új jelszó nem elég erős.', 'error');
					return;
				}

				setSubmitDisabled(adminForcePasswordForm, true);
				try {
					const { response, payload } = await apiJson('/api/auth/change-password', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ currentPassword, newPassword })
					});
					if (!response.ok) {
						setAdminStatus(payload.error || 'A jelszócsere nem sikerült.', 'error');
						return;
					}

					setAdminStatus(payload.message || 'A jelszó sikeresen módosítva.', 'success');
					await bootstrapAdmin();
				} catch (err) {
					setAdminStatus('A szerver most nem érhető el.', 'error');
				} finally {
					setSubmitDisabled(adminForcePasswordForm, false);
				}
			});
		}

		adminNavBtns.forEach(btn => {
			btn.addEventListener('click', () => {
				const viewName = btn.getAttribute('data-admin-view') || 'users';
				setAdminView(viewName);
				setAdminStatus('');
			});
		});

		if (adminNewTaskBtn) {
			adminNewTaskBtn.addEventListener('click', () => {
				setAdminView('tasks');
				resetTaskForm();
			});
		}

		if (adminTaskResetBtn) {
			adminTaskResetBtn.addEventListener('click', () => {
				resetTaskForm();
				setAdminStatus('');
			});
		}

		if (adminTaskForm) {
			adminTaskForm.addEventListener('submit', async (e) => {
				e.preventDefault();
				setAdminStatus('');

				const payload = taskPayloadFromForm();
				if (!payload.userId) {
					setAdminStatus('Válassz ügyfelet a feladathoz.', 'error');
					return;
				}
				if (!payload.topic || payload.topic.length < 3) {
					setAdminStatus('Adj meg feladat témát.', 'error');
					return;
				}
				if (!payload.helper || payload.helper.length < 2) {
					setAdminStatus('Add meg, ki segített.', 'error');
					return;
				}
				if (!payload.solution || payload.solution.length < 3) {
					setAdminStatus('Írd le röviden a megoldást vagy az eredményt.', 'error');
					return;
				}

				const taskId = adminTaskId?.value || '';
				const url = taskId ? `/api/admin/tasks/${encodeURIComponent(taskId)}` : '/api/admin/tasks';
				const method = taskId ? 'PUT' : 'POST';

				setSubmitDisabled(adminTaskForm, true);
				try {
					const { response, payload: responsePayload } = await apiJson(url, {
						method,
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload)
					});
					if (!response.ok) {
						setAdminStatus(responsePayload.error || 'A feladat mentése nem sikerült.', 'error');
						return;
					}

					setAdminStatus(responsePayload.message || 'Feladat mentve.', 'success');
					resetTaskForm();
					await loadAdminTasks();
					renderUsers(cachedUsers);
				} catch (err) {
					setAdminStatus('A feladat mentése nem sikerült.', 'error');
				} finally {
					setSubmitDisabled(adminTaskForm, false);
				}
			});
		}

		if (adminRefreshUsersBtn) {
			adminRefreshUsersBtn.addEventListener('click', async () => {
				try {
					await refreshAdminData();
					setAdminStatus('Admin adatok frissítve.', 'success');
				} catch (err) {
					setAdminStatus(err.message, 'error');
				}
			});
		}

		if (adminUserSelect) {
			adminUserSelect.addEventListener('change', () => {
				if (adminTokenOutput) adminTokenOutput.textContent = '';
				updateSelectedSummary();
			});
		}

		if (adminPasswordForm) {
			adminPasswordForm.addEventListener('submit', async (e) => {
				e.preventDefault();
				setAdminStatus('');
				if (adminTokenOutput) adminTokenOutput.textContent = '';

				const user = selectedUser();
				const newPassword = adminPasswordForm.querySelector('input[name="newPassword"]')?.value || '';
				if (!user) {
					setAdminStatus('Válassz ki felhasználót.', 'error');
					return;
				}
				if (!strongPasswordPattern.test(newPassword)) {
					setAdminStatus('Az új jelszó nem elég erős.', 'error');
					return;
				}

				try {
					const { response, payload } = await apiJson(`/api/admin/users/${encodeURIComponent(user.id)}/password`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ newPassword })
					});
					if (!response.ok) {
						setAdminStatus(payload.error || 'Jelszó módosítás sikertelen.', 'error');
						return;
					}

					adminPasswordForm.reset();
					setAdminStatus(payload.message || 'Jelszó frissítve.', 'success');
					await loadAdminUsers();
				} catch (err) {
					setAdminStatus('A művelet nem sikerült.', 'error');
				}
			});
		}

		if (adminDisableBtn) {
			adminDisableBtn.addEventListener('click', async () => {
				const user = selectedUser();
				if (!user) {
					setAdminStatus('Válassz ki felhasználót.', 'error');
					return;
				}
				const { response, payload } = await apiJson(`/api/admin/users/${encodeURIComponent(user.id)}/disable`, { method: 'POST' });
				if (!response.ok) {
					setAdminStatus(payload.error || 'A letiltás nem sikerült.', 'error');
					return;
				}
				setAdminStatus(payload.message || 'Fiók letiltva.', 'success');
				await loadAdminUsers();
			});
		}

		if (adminRestoreBtn) {
			adminRestoreBtn.addEventListener('click', async () => {
				const user = selectedUser();
				if (!user) {
					setAdminStatus('Válassz ki felhasználót.', 'error');
					return;
				}
				const { response, payload } = await apiJson(`/api/admin/users/${encodeURIComponent(user.id)}/restore`, { method: 'POST' });
				if (!response.ok) {
					setAdminStatus(payload.error || 'A visszaállítás nem sikerült.', 'error');
					return;
				}
				setAdminStatus(payload.message || 'Fiók visszaállítva.', 'success');
				await loadAdminUsers();
			});
		}

		if (adminGenerateTokenBtn) {
			adminGenerateTokenBtn.addEventListener('click', async () => {
				if (adminTokenOutput) adminTokenOutput.textContent = '';
				const user = selectedUser();
				if (!user) {
					setAdminStatus('Válassz ki felhasználót.', 'error');
					return;
				}

				const { response, payload } = await apiJson(`/api/admin/users/${encodeURIComponent(user.id)}/reset-token`, { method: 'POST' });
				if (!response.ok) {
					setAdminStatus(payload.error || 'A token generálás nem sikerült.', 'error');
					return;
				}
				setAdminStatus(payload.message || 'Reset token generálva.', 'success');
				if (payload.resetToken && adminTokenOutput) {
					adminTokenOutput.textContent = `Fejlesztői token: ${payload.resetToken}`;
				}
			});
		}

		if (adminLogoutBtn) {
			adminLogoutBtn.addEventListener('click', async () => {
				await apiJson('/api/auth/logout', { method: 'POST' });
				setAdminMode('unauth');
				setAdminStatus('Kijelentkezve.', 'success');
				if (adminSessionUser) adminSessionUser.textContent = 'Nincs bejelentkezve';
			});
		}

		bootstrapAdmin().catch(() => {
			setAdminStatus('Az admin felület nem érhető el.', 'error');
		});
	}
});
