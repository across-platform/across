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
				if (key.includes('portfolio') || key.includes('portfólió')) {
					return '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M21 3H3v18h18V3zM8 8h8v2H8V8zm0 4h8v6H8v-6z"/></svg>';
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
	const isBackendOrigin = window.location.origin.includes('localhost:3000') || window.location.origin.includes('127.0.0.1:3000');

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

		function setAuthStatus(message, tone) {
			if (!authStatus) return;
			authStatus.textContent = message || '';
			authStatus.classList.remove('is-error', 'is-success');
			if (tone === 'error') authStatus.classList.add('is-error');
			if (tone === 'success') authStatus.classList.add('is-success');
		}

		function toggleForcePasswordForm(show) {
			if (!forcePasswordForm) return;
			forcePasswordForm.hidden = !show;
			if (!show) forcePasswordForm.reset();
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
					const response = await fetch('/api/auth/register', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						credentials: 'same-origin',
						body: JSON.stringify({ name, email, password })
					});
					const payload = await response.json().catch(() => ({}));

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
					const response = await fetch('/api/auth/login', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						credentials: 'same-origin',
						body: JSON.stringify({ email, password, remember })
					});
					const payload = await response.json().catch(() => ({}));

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
					const response = await fetch('/api/auth/change-password', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						credentials: 'same-origin',
						body: JSON.stringify({ currentPassword, newPassword })
					});
					const payload = await response.json().catch(() => ({}));
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
					const response = await fetch('/api/auth/request-reset', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						credentials: 'same-origin',
						body: JSON.stringify({ email })
					});
					const payload = await response.json().catch(() => ({}));
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
					const response = await fetch('/api/auth/restore-account', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						credentials: 'same-origin',
						body: JSON.stringify({ email, token, newPassword })
					});
					const payload = await response.json().catch(() => ({}));
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
	}

	const adminRoot = document.getElementById('admin');
	if (adminRoot) {
		const adminStatus = document.getElementById('admin-status');
		const adminLoginForm = document.getElementById('admin-login-form');
		const adminForcePasswordForm = document.getElementById('admin-force-password-form');
		const adminSessionUser = document.getElementById('admin-session-user');
		const adminLogoutBtn = document.getElementById('admin-logout');
		const adminSelectForm = document.getElementById('admin-select-form');
		const adminUsersList = document.getElementById('admin-users');
		const adminUserSelect = document.getElementById('admin-user-select');
		const adminPasswordForm = document.getElementById('admin-password-form');
		const adminActionsPanel = adminRoot.querySelector('.admin-actions');
		const adminUsersListPanel = adminRoot.querySelector('.admin-users-list');
		const adminDisableBtn = document.getElementById('admin-disable-user');
		const adminRestoreBtn = document.getElementById('admin-restore-user');
		const adminGenerateTokenBtn = document.getElementById('admin-generate-token');
		const adminRefreshUsersBtn = document.getElementById('admin-refresh-users');
		const adminTokenOutput = document.getElementById('admin-token-output');
		const adminSelectedSummary = document.getElementById('admin-selected-summary');

		if (!isBackendOrigin) {
			setAdminMode('unauth');
			setAdminStatus('Az admin belépéshez a Node szervert használd: http://localhost:3000/admin.html', 'error');
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
			if (adminSelectForm) adminSelectForm.hidden = !showMain;
			if (adminActionsPanel) adminActionsPanel.hidden = !showMain;
			if (adminUsersListPanel) adminUsersListPanel.hidden = !showMain;
			if (adminLogoutBtn) adminLogoutBtn.hidden = mode === 'unauth';
		}

		function selectedUser() {
			if (!adminUserSelect) return null;
			const id = adminUserSelect.value;
			return cachedUsers.find(user => user.id === id) || null;
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

		function roleLabel(role) {
			return role === 'admin' ? 'Admin' : 'Felhasználó';
		}

		function statusLabel(status) {
			return status === 'active' ? 'Aktív' : 'Letiltva';
		}

		function textEl(tagName, className, text) {
			const el = document.createElement(tagName);
			if (className) el.className = className;
			el.textContent = text;
			return el;
		}

		function updateSelectedSummary() {
			if (!adminSelectedSummary) return;
			const user = selectedUser();
			if (!user) {
				adminSelectedSummary.textContent = 'Nincs kiválasztott felhasználó.';
				return;
			}

			adminSelectedSummary.replaceChildren(
				textEl('strong', '', user.name),
				textEl('span', '', user.email),
				textEl('span', '', `${roleLabel(user.role)} · ${statusLabel(user.status)} · létrehozva: ${formatDate(user.createdAt)}`)
			);
		}

		function renderUsers(users) {
			cachedUsers = Array.isArray(users) ? users : [];
			if (adminUserSelect) {
				adminUserSelect.innerHTML = '';
				cachedUsers.forEach(user => {
					const option = document.createElement('option');
					option.value = user.id;
					option.textContent = `${user.name} (${user.email}) - ${statusLabel(user.status)}`;
					adminUserSelect.appendChild(option);
				});
				updateSelectedSummary();
			}

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
						textEl('span', `admin-badge ${statusClass}`, statusLabel(user.status))
					);

					li.replaceChildren(identity, meta);
					adminUsersList.appendChild(li);
				});
			}
		}

		async function loadAdminUsers() {
			const { response, payload } = await apiJson('/api/admin/users');
			if (!response.ok) {
				throw new Error(payload.error || 'A felhasználólista nem tölthető be.');
			}
			renderUsers(payload.users || []);
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
				if (adminSessionUser) {
					adminSessionUser.textContent = `Bejelentkezve: ${user.name} (${user.email})`;
				}
				return;
			}
			if (user.role !== 'admin') {
				setAdminMode('unauth');
				setAdminStatus('Ehhez az oldalhoz admin jogosultság kell.', 'error');
				if (adminSessionUser) adminSessionUser.textContent = `Bejelentkezve: ${user.name} (${user.email})`;
				return;
			}

			setAdminMode('ready');

			if (adminSessionUser) {
				adminSessionUser.textContent = `Bejelentkezve: ${user.name} (${user.email})`;
			}

			await loadAdminUsers();
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

		if (adminRefreshUsersBtn) {
			adminRefreshUsersBtn.addEventListener('click', async () => {
				try {
					await loadAdminUsers();
					setAdminStatus('Felhasználólista frissítve.', 'success');
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
