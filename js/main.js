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
	const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
	function resolveTheme(theme) {
		if (theme === 'system') return systemThemeQuery.matches ? 'dark' : 'light';
		return theme === 'light' ? 'light' : 'dark';
	}
	function applyTheme(theme) {
		const html = document.documentElement;
		const btn = document.getElementById('theme-toggle');
		const resolved = resolveTheme(theme);
		if (resolved === 'dark') {
			html.setAttribute('data-theme', 'dark');
			if (btn) btn.setAttribute('aria-pressed', 'true');
		} else {
			html.removeAttribute('data-theme');
			if (btn) btn.setAttribute('aria-pressed', 'false');
		}
	}
	function currentStoredTheme() {
		try { return localStorage.getItem(THEME_KEY) || 'dark'; } catch (e) { return 'dark'; }
	}

	function themeToggleLabel() {
		const resolved = resolveTheme(currentStoredTheme());
		return resolved === 'dark' ? 'Világos mód' : 'Sötét mód';
	}

	// initialize theme from storage or default to dark
	const storedTheme = currentStoredTheme();
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
	const handleSystemThemeChange = () => {
		if (currentStoredTheme() === 'system') applyTheme('system');
	};
	if (typeof systemThemeQuery.addEventListener === 'function') {
		systemThemeQuery.addEventListener('change', handleSystemThemeChange);
	} else if (typeof systemThemeQuery.addListener === 'function') {
		systemThemeQuery.addListener(handleSystemThemeChange);
	}

	const isBackendOrigin = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

	function markActiveNav() {
		document.querySelectorAll('.navbar nav a[href]').forEach(link => {
			const href = link.getAttribute('href') || '';
			if (!href || href.startsWith('http')) return;
			try {
				const url = new URL(href, window.location.href);
				const currentPage = window.location.pathname.split('/').pop() || 'index.html';
				const linkPage = url.pathname.split('/').pop() || 'index.html';
				const currentHash = window.location.hash || (currentPage === 'auth.html' ? '#login' : '');
				const samePage = linkPage === currentPage;
				const sameHash = url.hash ? url.hash === currentHash : !currentHash;
				link.classList.toggle('is-active', samePage && sameHash);
			} catch (err) {
				/* ignore malformed local links */
			}
		});
	}

	window.addEventListener('hashchange', markActiveNav);

	async function revealPrivateNavIfAllowed() {
		if (!isBackendOrigin) return;
		const nav = document.querySelector('.navbar nav');
		if (!nav) return;
		try {
			const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
			const payload = await response.json().catch(() => ({}));
			if (!response.ok || !payload.user) {
				setPublicAuthNavVisibility(false);
				return;
			}
			setPublicAuthNavVisibility(true);

			if (payload.user.role !== 'admin' && !nav.querySelector('[data-subscription-nav]')) {
				const subscriptionLink = document.createElement('a');
				subscriptionLink.href = 'auth.html#account-status';
				subscriptionLink.dataset.subscriptionNav = 'true';
				subscriptionLink.textContent = 'Ügyfélportál';
				nav.appendChild(subscriptionLink);
			}

			if (payload.user.role === 'admin' && !nav.querySelector('[data-admin-nav]')) {
				const adminLink = document.createElement('a');
				adminLink.href = 'admin.html';
				adminLink.dataset.adminNav = 'true';
				adminLink.textContent = 'Admin';
				nav.appendChild(adminLink);
			}
		} catch (err) {
			setPublicAuthNavVisibility(false);
			/* anonymous visitors simply do not see private nav links */
		}
	}

	function removePrivateNavLinks() {
		document.querySelectorAll('[data-subscription-nav], [data-admin-nav]').forEach(link => link.remove());
		setPublicAuthNavVisibility(false);
	}

		function setPublicAuthNavVisibility(isLoggedIn) {
			document.querySelectorAll('.navbar nav a[href="auth.html#login"], .navbar nav a[href="auth.html#register"]').forEach(link => {
				link.hidden = isLoggedIn;
				link.style.display = isLoggedIn ? 'none' : '';
			});
		}

		function createTextEl(tagName, className, text) {
			const el = document.createElement(tagName);
			if (className) el.className = className;
			el.textContent = text || '';
			return el;
		}

		function formatNotificationDate(value) {
			if (!value) return '';
			try {
				return new Intl.DateTimeFormat('hu-HU', {
					month: '2-digit',
					day: '2-digit',
					hour: '2-digit',
					minute: '2-digit'
				}).format(new Date(value));
			} catch (err) {
				return '';
			}
		}

		function closeNotificationPanels() {
			document.querySelectorAll('.notification-panel').forEach(panel => panel.remove());
			document.querySelectorAll('.nav-bell[aria-expanded="true"]').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
		}

		function showNotificationPanel(anchorBtn, items, emptyText = 'Nincs új értesítés.') {
			if (!anchorBtn) return;
			const alreadyOpen = anchorBtn.getAttribute('aria-expanded') === 'true';
			closeNotificationPanels();
			if (alreadyOpen) return;

			const panel = document.createElement('div');
			panel.className = 'notification-panel';
			panel.setAttribute('role', 'menu');
			const heading = document.createElement('strong');
			heading.textContent = 'Értesítések';
			panel.appendChild(heading);

			if (!items.length) {
				panel.appendChild(createTextEl('p', 'auth-hint', emptyText));
			} else {
				items.slice(0, 8).forEach(item => {
					const button = document.createElement('button');
					button.type = 'button';
					button.className = 'notification-item';
					button.replaceChildren(
						createTextEl('span', 'notification-title', item.title),
						createTextEl('span', 'notification-body', item.body),
						createTextEl('small', '', item.time || '')
					);
					button.addEventListener('click', () => {
						closeNotificationPanels();
						if (typeof item.onClick === 'function') {
							item.onClick();
						} else if (item.href) {
							window.location.href = item.href;
						}
					});
					panel.appendChild(button);
				});
			}

			anchorBtn.setAttribute('aria-expanded', 'true');
			anchorBtn.insertAdjacentElement('afterend', panel);
		}

		async function syncGlobalBellVisibility() {
			const bell = document.getElementById('global-notify-btn');
			const badge = document.getElementById('global-notify-badge');
		if (!bell) return;
		if (!isBackendOrigin) {
			bell.hidden = true;
			bell.style.display = 'none';
			if (badge) {
				badge.hidden = true;
				badge.style.display = 'none';
			}
			return;
		}
		try {
				const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
				const payload = await response.json().catch(() => ({}));
				const isLoggedIn = response.ok && Boolean(payload.user);
				bell.hidden = !isLoggedIn;
				bell.style.display = isLoggedIn ? '' : 'none';
			if (badge) {
				badge.hidden = true;
				badge.style.display = 'none';
			}
		} catch (err) {
			bell.hidden = true;
			bell.style.display = 'none';
			if (badge) {
				badge.hidden = true;
				badge.style.display = 'none';
			}
			}
		}

		document.addEventListener('click', (event) => {
			if (!event.target.closest('.nav-bell') && !event.target.closest('.notification-panel')) {
				closeNotificationPanels();
			}
		});

		const globalNotifyBtn = document.getElementById('global-notify-btn');
		if (globalNotifyBtn) {
			globalNotifyBtn.addEventListener('click', async (event) => {
				event.stopPropagation();
				try {
					const meResponse = await fetch('/api/auth/me', { credentials: 'same-origin' });
					const mePayload = await meResponse.json().catch(() => ({}));
					if (!meResponse.ok || !mePayload.user) return showNotificationPanel(globalNotifyBtn, []);
					const isAdmin = mePayload.user.role === 'admin';
					const messageResponse = await fetch(isAdmin ? '/api/admin/messages' : '/api/account/messages', { credentials: 'same-origin' });
					const messagePayload = await messageResponse.json().catch(() => ({}));
					const messages = Array.isArray(messagePayload.messages) ? messagePayload.messages : [];
					const messageItems = messages
						.filter(message => isAdmin ? message.senderRole === 'user' : message.senderRole === 'admin')
						.map(message => ({
						title: isAdmin ? 'Új ügyfélüzenet' : 'Admin válasz érkezett',
						body: message.body || 'Üzenet',
						time: formatNotificationDate(message.createdAt),
						timestamp: new Date(message.createdAt).getTime(),
						href: isAdmin ? 'admin.html#messages' : 'auth.html#account-messages'
					}));
					let requestItems = [];
					let contactItems = [];
					if (isAdmin) {
						const requestResponse = await fetch('/api/admin/plan-requests', { credentials: 'same-origin' });
						const requestPayload = await requestResponse.json().catch(() => ({}));
						requestItems = (Array.isArray(requestPayload.requests) ? requestPayload.requests : [])
							.filter(request => request.status === 'pending')
							.map(request => ({
								title: 'Új csomagmódosítási kérelem',
								body: `${request.userName || 'Ügyfél'}: ${request.currentPlanName || request.currentPlan} -> ${request.requestedPlanName || request.requestedPlan}`,
								time: formatNotificationDate(request.createdAt),
								timestamp: new Date(request.createdAt).getTime(),
								href: 'admin.html#requests'
							}));
						const contactResponse = await fetch('/api/admin/contact-requests', { credentials: 'same-origin' });
						const contactPayload = await contactResponse.json().catch(() => ({}));
						contactItems = (Array.isArray(contactPayload.requests) ? contactPayload.requests : [])
							.filter(request => request.status === 'new')
							.map(request => ({
								title: 'Új kapcsolatfelvétel',
								body: `${request.name}: ${request.message || 'Megkeresés'}`,
								time: formatNotificationDate(request.createdAt),
								timestamp: new Date(request.createdAt).getTime(),
								href: 'admin.html#contacts'
							}));
					}
					const items = [...contactItems, ...requestItems, ...messageItems].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
					showNotificationPanel(globalNotifyBtn, items);
				} catch (err) {
					showNotificationPanel(globalNotifyBtn, []);
				}
			});
		}

		markActiveNav();
	revealPrivateNavIfAllowed().finally(() => {
		markActiveNav();
		syncGlobalBellVisibility().catch(() => {});
	});
	document.querySelectorAll('.navbar nav a[href]').forEach(link => {
		link.addEventListener('click', () => {
			window.setTimeout(markActiveNav, 0);
			if (typeof link.blur === 'function') window.setTimeout(() => link.blur(), 80);
		});
	});

	// Mobile nav toggle (slide-in panel)
	const navToggle = document.getElementById('nav-toggle');
	const mobileNavQuery = window.matchMedia('(max-width: 880px)');
	let mobilePanel = null;
	let mobileOverlay = null;
	let _prevFocused = null;
	let _focusableEls = [];
	let _firstFocusable = null;
	let _lastFocusable = null;
	let _trapHandler = null;

	function isMobileNavAllowed() {
		return mobileNavQuery.matches;
	}

	function createMobilePanel() {
		if (!isMobileNavAllowed()) return null;
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

		const mobileThemeBtn = document.createElement('button');
		mobileThemeBtn.type = 'button';
		mobileThemeBtn.className = 'mobile-theme-toggle';
		mobileThemeBtn.setAttribute('aria-label', 'Téma váltása');
		mobileThemeBtn.textContent = themeToggleLabel();
		mobileThemeBtn.addEventListener('click', () => {
			const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
			const next = isDark ? 'light' : 'dark';
			applyTheme(next);
			try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore storage errors */ }
			mobileThemeBtn.textContent = themeToggleLabel();
		});
		mobilePanel.appendChild(mobileThemeBtn);

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
		if (!isMobileNavAllowed()) {
			removeMobilePanel();
			return;
		}
		const panel = createMobilePanel();
		if (!panel) return;
		panel.classList.add('open');
		document.documentElement.style.overflow = 'hidden';
		if (mobileOverlay) mobileOverlay.classList.add('visible');
		if (navToggle) navToggle.setAttribute('aria-expanded', 'true');

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
		if (navToggle) navToggle.setAttribute('aria-expanded', 'false');

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

	function removeMobilePanel() {
		try { closePanel(); } catch (err) { /* ignore stale mobile nav state */ }
		if (mobilePanel && mobilePanel.parentNode) {
			mobilePanel.parentNode.removeChild(mobilePanel);
		}
		if (mobileOverlay && mobileOverlay.parentNode) {
			mobileOverlay.parentNode.removeChild(mobileOverlay);
		}
		mobilePanel = null;
		mobileOverlay = null;
		document.documentElement.style.overflow = '';
		if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
	}

	if (navToggle) {
		navToggle.addEventListener('click', () => {
			if (!isMobileNavAllowed()) {
				removeMobilePanel();
				return;
			}
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
		if (!isMobileNavAllowed()) removeMobilePanel();
	});

	const handleMobileNavBreakpoint = (event) => {
		if (!event.matches) removeMobilePanel();
	};
	if (typeof mobileNavQuery.addEventListener === 'function') {
		mobileNavQuery.addEventListener('change', handleMobileNavBreakpoint);
	} else if (typeof mobileNavQuery.addListener === 'function') {
		mobileNavQuery.addListener(handleMobileNavBreakpoint);
	}
	if (!isMobileNavAllowed()) removeMobilePanel();

	const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	function setSubmitDisabled(formEl, disabled) {
		if (!formEl) return;
		const btn = formEl.querySelector('button[type="submit"]');
		if (btn) btn.disabled = !!disabled;
	}

		const contactForm = document.getElementById('contact-form');
		if (contactForm) {
			const contactStatus = document.getElementById('contact-status');
			function setContactStatus(message, tone) {
				if (!contactStatus) return;
				contactStatus.textContent = message || '';
				contactStatus.classList.remove('is-error', 'is-success');
				if (tone === 'error') contactStatus.classList.add('is-error');
				if (tone === 'success') contactStatus.classList.add('is-success');
			}

			function openContactMailFallback(name, email, message) {
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
			}

			contactForm.addEventListener('submit', async (e) => {
				e.preventDefault();
				setContactStatus('');

				const name = contactForm.querySelector('input[name="name"]')?.value?.trim() || '';
				const email = contactForm.querySelector('input[name="email"]')?.value?.trim() || '';
				const message = contactForm.querySelector('textarea[name="message"]')?.value?.trim() || '';

				if (!name) {
					setContactStatus('Kérlek add meg a neved.', 'error');
					return;
				}
				if (!email || !emailPattern.test(email)) {
					setContactStatus('Kérlek adj meg egy érvényes email címet.', 'error');
					return;
				}
				if (!message) {
					setContactStatus('Kérlek írj üzenetet.', 'error');
					return;
				}

				setSubmitDisabled(contactForm, true);
				try {
					const response = await fetch('/api/contact-requests', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ name, email, message })
					});
					const payload = await response.json().catch(() => ({}));
					if (!response.ok) {
						if ([404, 405].includes(response.status)) {
							openContactMailFallback(name, email, message);
							setContactStatus('Az online beküldés itt nem érhető el, ezért megnyitottuk az email kliensedet.', 'success');
							contactForm.reset();
							return;
						}
						setContactStatus(payload.error || 'A megkeresés elküldése nem sikerült.', 'error');
						return;
					}
					setContactStatus(payload.message || 'Megkeresés elküldve. Hamarosan jelentkezünk.', 'success');
					contactForm.reset();
				} catch (err) {
					openContactMailFallback(name, email, message);
					setContactStatus('A szerver most nem érhető el, ezért megnyitottuk az email kliensedet.', 'error');
				} finally {
					setSubmitDisabled(contactForm, false);
				}
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
		const panels = {
			login: document.getElementById('auth-login-panel'),
			register: document.getElementById('auth-register-panel')
		};
		const authStatus = document.getElementById('auth-status');
		const loginForm = document.getElementById('login-form');
		const forcePasswordForm = document.getElementById('force-password-form');
		const registerForm = document.getElementById('register-form');
		const registerPasswordInput = document.getElementById('register-password');
		const registerPasswordConfirmInput = document.getElementById('register-password-confirm');
		const passwordHint = document.getElementById('password-hint');
		const accountDashboard = document.getElementById('account-dashboard');
		const accountGreeting = document.getElementById('account-greeting');
		const accountEmail = document.getElementById('account-email');
		const accountLogoutBtn = document.getElementById('account-logout');
		const accountNavBtns = authRoot.querySelectorAll('.account-nav-btn');
		const accountViews = {
			status: document.getElementById('account-status-view'),
			profile: document.getElementById('account-profile-view'),
			settings: document.getElementById('account-settings-view'),
			stats: document.getElementById('account-stats-view'),
			worklog: document.getElementById('account-worklog-view'),
			plans: document.getElementById('account-plans-view'),
			messages: document.getElementById('account-messages-view')
		};
		const accountProfileForm = document.getElementById('account-profile-form');
		const accountPasswordForm = document.getElementById('account-password-form');
		const accountSettingsForm = document.getElementById('account-settings-form');
		const accountThemeMode = document.getElementById('account-theme-mode');
		const accountStatusBadge = document.getElementById('account-status-badge');
		const accountStatusTitle = document.getElementById('account-status-title');
		const accountStatusDescription = document.getElementById('account-status-description');
		const accountStatusAction = document.getElementById('account-status-action');
		const accountStatusSteps = document.getElementById('account-status-steps');
		const accountSolved = document.getElementById('account-solved');
		const accountAverageTime = document.getElementById('account-average-time');
		const accountLastHelp = document.getElementById('account-last-help');
		const subscriptionStatus = document.getElementById('subscription-status');
		const subscriptionPlan = document.getElementById('subscription-plan');
		const subscriptionRenewal = document.getElementById('subscription-renewal');
		const subscriptionFeatures = document.getElementById('subscription-features');
		const accountPlanOptions = document.getElementById('account-plan-options');
		const accountPlanRequests = document.getElementById('account-plan-requests');
		const supportHistoryList = document.getElementById('support-history-list');
		const accountMessageList = document.getElementById('account-message-list');
		const accountMessageForm = document.getElementById('account-message-form');
		const accountNotifyBtn = document.getElementById('account-notify-btn');
		const accountNotifyBadge = document.getElementById('account-notify-badge');
		let latestAccountData = null;
		let isAccountAuthenticated = false;
		const ACCOUNT_LAST_SEEN_KEY = 'across-account-last-seen';

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

		function readAccountLastSeen() {
			try { return Number(localStorage.getItem(ACCOUNT_LAST_SEEN_KEY) || 0); } catch (err) { return 0; }
		}

		function writeAccountLastSeen(value) {
			try { localStorage.setItem(ACCOUNT_LAST_SEEN_KEY, String(value)); } catch (err) { /* ignore */ }
		}

		function updateAccountNotifications(messages) {
			if (!accountNotifyBtn || !accountNotifyBadge) return;
			const unread = Array.isArray(messages)
				? messages.filter(message => message.senderRole === 'admin' && new Date(message.createdAt).getTime() > readAccountLastSeen()).length
				: 0;
			const showBell = isAccountAuthenticated;
			const showBubble = showBell && unread > 0;
			accountNotifyBtn.hidden = !showBell;
			accountNotifyBtn.style.display = showBell ? '' : 'none';
			accountNotifyBadge.hidden = !showBubble;
			accountNotifyBadge.style.display = showBubble ? '' : 'none';
			accountNotifyBadge.textContent = String(unread);
		}

		function markAccountMessagesSeen(messages) {
			const latest = Array.isArray(messages) && messages.length
				? messages.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
				: null;
			if (latest) writeAccountLastSeen(new Date(latest.createdAt).getTime());
			updateAccountNotifications(messages);
		}

		function formatAccountDate(value, includeTime = false) {
			if (!value) return 'Nincs adat';
			try {
				return new Intl.DateTimeFormat('hu-HU', {
					year: 'numeric',
					month: '2-digit',
					day: '2-digit',
					...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {})
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

		function planStatusLabel(status) {
			if (status === 'approved') return 'Jóváhagyva';
			if (status === 'rejected') return 'Elutasítva';
			return 'Folyamatban';
		}

		function toggleForcePasswordForm(show) {
			if (!forcePasswordForm) return;
			forcePasswordForm.hidden = !show;
			if (!show) forcePasswordForm.reset();
		}

		function setAccountView(viewName) {
			const next = accountViews[viewName] ? viewName : 'status';
			Object.entries(accountViews).forEach(([name, panel]) => {
				if (panel) panel.hidden = name !== next;
			});
			accountNavBtns.forEach(btn => {
				btn.classList.toggle('is-active', btn.getAttribute('data-account-view') === next);
			});
			if (next === 'messages') {
				loadAccountMessages().catch(() => {});
				markAccountMessagesSeen(Array.isArray(latestAccountData?.messages) ? latestAccountData.messages : []);
			}
		}

		function buildAccountStatus(data) {
			const requests = Array.isArray(data.planRequests) ? data.planRequests : [];
			const messages = Array.isArray(data.messages) ? data.messages : [];
			const history = Array.isArray(data.history) ? data.history : [];
			const pendingRequest = requests.find(request => request.status === 'pending');
			const latestMessage = messages[messages.length - 1] || null;
			const latestHistory = history[0] || null;

			if (pendingRequest) {
				return {
					badge: 'Folyamatban',
					title: 'Csomagmódosítási kérelem ellenőrzés alatt',
					description: `A kérelmed beérkezett. Jelenlegi csomag: ${pendingRequest.currentPlan}, kért csomag: ${pendingRequest.requestedPlan}.`,
					action: 'Csomagok megnyitása',
					target: 'plans',
					steps: [
						['Kérelem elküldve', 'A csomagmódosítási igény beérkezett.', true],
						['Admin ellenőrzés', 'Átnézzük a kérést és a kapcsolódó fiókadatokat.', true],
						['Döntés', 'Jóváhagyás vagy egyeztetés következik.', false],
						['Csomag frissítése', 'Jóváhagyás után az aktív csomag átáll.', false]
					]
				};
			}

			if (latestMessage?.senderRole === 'admin') {
				return {
					badge: 'Új válasz',
					title: 'Admin válasz érkezett',
					description: latestMessage.body || 'Új üzeneted érkezett az admin csapattól.',
					action: 'Üzenetek megnyitása',
					target: 'messages',
					steps: [
						['Üzenet érkezett', 'Az admin válaszolt a fiókodban.', true],
						['Átnézés', 'Olvasd el a választ és jelezz vissza, ha szükséges.', false],
						['Egyeztetés', 'A további lépések üzenetben folytathatók.', false],
						['Lezárás', 'A megoldott munka bekerül a munkanaplóba.', false]
					]
				};
			}

			if (latestMessage?.senderRole === 'user') {
				return {
					badge: 'Válaszra vár',
					title: 'Üzeneted elküldve',
					description: 'Az üzeneted beérkezett, az admin válasza után itt és az üzeneteknél is látni fogod a frissítést.',
					action: 'Üzenetek megnyitása',
					target: 'messages',
					steps: [
						['Üzenet elküldve', 'A kérésed beérkezett.', true],
						['Válasz előkészítése', 'Az admin átnézi a leírtakat.', true],
						['Admin válasz', 'A következő válasz a fiókodban jelenik meg.', false],
						['Megoldás', 'Szükség esetén munkanapló bejegyzés készül.', false]
					]
				};
			}

			if (latestHistory) {
				return {
					badge: latestHistory.successful ? 'Lezárva' : 'Utánkövetés',
					title: latestHistory.topic || 'Legutóbbi munkafolyamat',
					description: `${latestHistory.result || 'Munkanapló bejegyzés'} · ${formatAccountDate(latestHistory.completedAt || latestHistory.date, true)} · ${formatDuration(latestHistory.durationMinutes)}`,
					action: 'Munkanapló megnyitása',
					target: 'worklog',
					steps: [
						['Kapcsolatfelvétel', 'A segítségkérés rögzítve lett.', true],
						['Hibaelhárítás', `Segített: ${latestHistory.helper || 'Across-platform'}.`, true],
						['Eredmény', latestHistory.result || 'Az eredmény rögzítve lett.', true],
						['Munkanapló', 'A részleteket a munkanaplóban találod.', true]
					]
				};
			}

			return {
				badge: 'Nincs aktív ügy',
				title: 'Jelenleg nincs nyitott folyamat',
				description: 'Ha segítségre van szükséged, írj üzenetet, és itt követheted majd az állapotát.',
				action: 'Üzenet írása',
				target: 'messages',
				steps: [
					['Kérés indítása', 'Írj üzenetet vagy kérj kapcsolatfelvételt.', false],
					['Egyeztetés', 'Átnézzük, miben tudunk segíteni.', false],
					['Távoli segítség', 'Szükség esetén biztonságos kapcsolaton dolgozunk.', false],
					['Munkanapló', 'A lezárt feladat bekerül az előzmények közé.', false]
				]
			};
		}

		function renderAccountStatus(data) {
			const status = buildAccountStatus(data);
			if (accountStatusBadge) accountStatusBadge.textContent = status.badge;
			if (accountStatusTitle) accountStatusTitle.textContent = status.title;
			if (accountStatusDescription) accountStatusDescription.textContent = status.description;
			if (accountStatusAction) {
				accountStatusAction.textContent = status.action;
				accountStatusAction.onclick = () => setAccountView(status.target);
			}
			if (accountStatusSteps) {
				accountStatusSteps.innerHTML = '';
				status.steps.forEach(([title, description, done], index) => {
					const step = document.createElement('article');
					step.className = `account-status-step${done ? ' is-done' : ''}`;
					step.replaceChildren(
						textEl('span', '', String(index + 1).padStart(2, '0')),
						textEl('strong', '', title),
						textEl('p', 'auth-hint', description)
					);
					accountStatusSteps.appendChild(step);
				});
			}
		}

		function setAccountMode(mode) {
			const isDashboard = mode === 'dashboard';
			if (accountDashboard) accountDashboard.hidden = !isDashboard;
			Object.values(panels).forEach(panel => {
				if (panel) panel.hidden = isDashboard ? true : panel.hidden;
			});
			if (!isDashboard) {
				if (panels.login) panels.login.hidden = false;
				switchAuthTab(initialAuthTab());
			}
		}

		function renderHistory(history) {
			if (!supportHistoryList) return;
			supportHistoryList.innerHTML = '';
			if (!history.length) {
				supportHistoryList.appendChild(textEl('p', 'auth-hint', 'Még nincs rögzített munkanapló bejegyzés.'));
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
					textEl('span', '', `Mikor: ${formatAccountDate(item.date, true)}`),
					textEl('span', '', `Segített: ${item.helper || 'Across-platform'}`),
					textEl('span', '', `Időtartam: ${formatDuration(item.durationMinutes)}`)
				);
				row.replaceChildren(header, meta, textEl('p', 'auth-hint', item.note || item.solution || ''));
				supportHistoryList.appendChild(row);
			});
		}

		function renderPlans(data) {
			const subscription = data.subscription || {};
			const plans = Array.isArray(data.plans) ? data.plans : [];
			const requests = Array.isArray(data.planRequests) ? data.planRequests : [];
			const activePlan = subscription.planKey || 'pro';
			if (subscriptionStatus) subscriptionStatus.textContent = subscription.status || 'Nincs aktív csomag';
			if (subscriptionPlan) subscriptionPlan.textContent = subscription.plan || 'Nincs kiválasztott csomag';
			if (subscriptionRenewal) {
				const used = subscription.usedMinutes ?? 0;
				const included = subscription.includedMinutes ?? 0;
				subscriptionRenewal.textContent = `Következő megújulás: ${formatAccountDate(subscription.renewalDate)} · Felhasznált idő: ${used}/${included} perc`;
			}
			if (subscriptionFeatures) {
				subscriptionFeatures.innerHTML = '';
				(subscription.features || []).forEach(feature => subscriptionFeatures.appendChild(textEl('li', '', feature)));
			}
			if (accountPlanOptions) {
				accountPlanOptions.innerHTML = '';
				const pending = requests.find(request => request.status === 'pending');
				plans.forEach(plan => {
					const card = document.createElement('article');
					card.className = `subscription-card account-plan-card${plan.key === activePlan ? ' is-active' : ''}`;
					const content = document.createElement('div');
					content.replaceChildren(
						textEl('span', 'account-badge', plan.key === activePlan ? 'Aktív csomag' : plan.price),
						textEl('h4', '', plan.name),
						textEl('p', 'auth-hint', (plan.features || []).join(' · '))
					);
					const btn = textEl('button', plan.key === activePlan ? 'btn secondary' : 'btn', plan.key === activePlan ? 'Aktív' : 'Kérem ezt a csomagot');
					btn.type = 'button';
					btn.disabled = plan.key === activePlan || !!pending;
					btn.addEventListener('click', () => requestPlanChange(plan.key));
					card.replaceChildren(content, btn);
					accountPlanOptions.appendChild(card);
				});
			}
			if (accountPlanRequests) {
				accountPlanRequests.innerHTML = '';
				if (!requests.length) {
					accountPlanRequests.appendChild(textEl('p', 'auth-hint', 'Még nincs csomagmódosítási kérelem.'));
				}
				requests.forEach(request => {
					const row = document.createElement('article');
					row.className = 'history-item';
					row.replaceChildren(
						textEl('strong', '', `${request.currentPlan} -> ${request.requestedPlan}`),
						textEl('span', 'account-badge', planStatusLabel(request.status)),
						textEl('p', 'auth-hint', `${formatAccountDate(request.createdAt, true)}${request.adminNote ? ` · Admin megjegyzés: ${request.adminNote}` : ''}`)
					);
					accountPlanRequests.appendChild(row);
				});
			}
		}

		function renderAccountDashboard(data) {
			latestAccountData = data;
			isAccountAuthenticated = true;
			const user = data.user || {};
			const stats = data.stats || {};
			const history = Array.isArray(data.history) ? data.history : [];

			if (accountGreeting) accountGreeting.textContent = `Szia, ${user.name || 'felhasználó'}!`;
			if (accountEmail) accountEmail.textContent = user.email || '';
			if (accountProfileForm) {
				accountProfileForm.elements.name.value = user.name || '';
				accountProfileForm.elements.email.value = user.email || '';
				accountProfileForm.elements.currentPassword.value = '';
			}
			if (accountThemeMode) accountThemeMode.value = currentStoredTheme();
			if (accountSolved) accountSolved.textContent = `${stats.solved || 0}/${stats.total || history.length}`;
			if (accountAverageTime) accountAverageTime.textContent = formatDuration(stats.averageMinutes || 0);
			if (accountLastHelp) accountLastHelp.textContent = formatAccountDate(stats.lastHelpAt || history[0]?.date);
			updateAccountNotifications(Array.isArray(data.messages) ? data.messages : []);
			renderAccountStatus(data);
			renderHistory(history);
			renderPlans(data);
			setAccountMode('dashboard');
			const viewFromHash = window.location.hash === '#subscription' ? 'plans' : (window.location.hash || '').replace('#account-', '').replace('#', '');
			setAccountView(viewFromHash || 'status');
		}

		async function loadAccountDashboard(showSuccess) {
			const { response, payload } = await authApiJson('/api/account/overview');
			if (!response.ok) {
				isAccountAuthenticated = false;
				removePrivateNavLinks();
				if (accountNotifyBtn) accountNotifyBtn.hidden = true;
				if (accountNotifyBadge) accountNotifyBadge.hidden = true;
				setAccountMode('forms');
				setAuthStatus(payload.error || 'Jelentkezz be a fiókfelület megnyitásához.', 'error');
				return false;
			}
			renderAccountDashboard(payload);
			if (showSuccess) setAuthStatus('Sikeres bejelentkezés.', 'success');
			loadAccountMessages().catch(() => {});
			return true;
		}

		async function loadAccountMessages() {
			if (!accountMessageList) return;
			const { response, payload } = await authApiJson('/api/account/messages');
			if (!response.ok) return;
			const messages = Array.isArray(payload.messages) ? payload.messages : [];
			if (latestAccountData) {
				latestAccountData.messages = messages;
				renderAccountStatus(latestAccountData);
			}
			accountMessageList.innerHTML = '';
			if (!messages.length) accountMessageList.appendChild(textEl('p', 'auth-hint', 'Még nincs üzenetváltás. Írj nekünk, és itt követheted a válaszokat.'));
			messages.forEach(message => {
				const item = document.createElement('article');
				item.className = `message-item ${message.senderRole === 'admin' ? 'is-admin' : 'is-user'}`;
				item.replaceChildren(
					textEl('p', '', message.body || ''),
					textEl('small', '', `${message.senderRole === 'admin' ? (message.senderName || 'Across-platform') : 'Te'} · ${formatAccountDate(message.createdAt, true)}`)
				);
				accountMessageList.appendChild(item);
			});
			accountMessageList.scrollTop = accountMessageList.scrollHeight;
			updateAccountNotifications(messages);
			markAccountMessagesSeen(messages);
		}

		function switchAuthTab(tabName) {
			const nextTab = panels[tabName] ? tabName : 'login';
			if (panels.login) panels.login.hidden = nextTab !== 'login';
			if (panels.register) panels.register.hidden = nextTab !== 'register';
			if (nextTab !== 'login') toggleForcePasswordForm(false);
			setAuthStatus('');
		}

		function initialAuthTab() {
			const hash = (window.location.hash || '').replace('#', '');
			return hash === 'register' ? 'register' : 'login';
		}

		async function requestPlanChange(planKey) {
			const { response, payload } = await authApiJson('/api/account/plan-requests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ plan: planKey })
			});
			if (!response.ok) {
				setAuthStatus(payload.error || 'A csomagkérelem nem küldhető el.', 'error');
				return;
			}
			setAuthStatus(payload.message || 'Csomagkérelem elküldve.', 'success');
			await loadAccountDashboard(false);
			setAccountView('plans');
		}

		async function bootstrapAccount() {
			isAccountAuthenticated = false;
			if (!isBackendOrigin) {
				setAccountMode('forms');
				setAuthStatus('A fiókfelülethez a Node szerverről megnyitott oldalt használd.', 'error');
				return;
			}
			await loadAccountDashboard(false);
			loadAccountMessages().catch(() => {});
		}

		const mustChangeFlag = new URLSearchParams(window.location.search).get('mustChange');
		if (mustChangeFlag === '1') {
			switchAuthTab('login');
			setAuthStatus('Első belépésnél kötelező a jelszócsere.', 'error');
			toggleForcePasswordForm(true);
		}

		window.addEventListener('hashchange', () => {
			if (accountDashboard && !accountDashboard.hidden) return;
			switchAuthTab(initialAuthTab());
		});

		accountNavBtns.forEach(btn => {
			btn.addEventListener('click', () => {
				setAuthStatus('');
				setAccountView(btn.getAttribute('data-account-view') || 'profile');
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
				if (honeypot) return setAuthStatus('A kérés nem feldolgozható.', 'error');
				if (!name || name.length < 2) return setAuthStatus('Add meg a teljes neved.', 'error');
				if (!emailPattern.test(email)) return setAuthStatus('Adj meg érvényes email címet.', 'error');
				if (!strongPasswordPattern.test(password)) return setAuthStatus('A jelszó nem elég erős (min. 12 karakter, kis- és nagybetű, szám, speciális karakter).', 'error');
				if (password !== passwordConfirm) return setAuthStatus('A két jelszó nem egyezik.', 'error');
				if (!acceptTerms) return setAuthStatus('A regisztrációhoz el kell fogadnod a feltételeket.', 'error');
				setSubmitDisabled(registerForm, true);
				try {
					const { response, payload } = await authApiJson('/api/auth/register', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ name, email, password })
					});
					if (!response.ok) return setAuthStatus(payload.error || 'A regisztráció nem sikerült. Kérlek próbáld újra.', 'error');
					setAuthStatus('Sikeres regisztráció. Most jelentkezz be.', 'success');
					registerForm.reset();
					if (history.replaceState) history.replaceState(null, '', '#login');
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
				if (!emailPattern.test(email)) return setAuthStatus('Adj meg érvényes email címet.', 'error');
				if (password.length < 12) return setAuthStatus('A jelszó túl rövid.', 'error');
				setSubmitDisabled(loginForm, true);
				try {
					const { response, payload } = await authApiJson('/api/auth/login', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ email, password, remember })
					});
					if (!response.ok) return setAuthStatus(payload.error || 'A bejelentkezés sikertelen. Ellenőrizd az adataidat.', 'error');
					if (payload.mustChangePassword) {
						setAuthStatus('Első belépésnél kötelező a jelszócsere.', 'error');
						toggleForcePasswordForm(true);
						return;
					}
					loginForm.reset();
					toggleForcePasswordForm(false);
					if (payload.user?.role === 'admin') {
						window.location.href = 'admin.html';
					} else {
						await loadAccountDashboard(true);
						await revealPrivateNavIfAllowed();
						markActiveNav();
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
				if (!currentPassword) return setAuthStatus('Add meg a jelenlegi jelszót.', 'error');
				if (!strongPasswordPattern.test(newPassword)) return setAuthStatus('Az új jelszó nem elég erős.', 'error');
				setSubmitDisabled(forcePasswordForm, true);
				try {
					const { response, payload } = await authApiJson('/api/auth/change-password', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ currentPassword, newPassword })
					});
					if (!response.ok) return setAuthStatus(payload.error || 'A jelszócsere nem sikerült.', 'error');
					setAuthStatus(payload.message || 'A jelszó sikeresen módosítva.', 'success');
					toggleForcePasswordForm(false);
					forcePasswordForm.reset();
					await loadAccountDashboard(true);
				} catch (err) {
					setAuthStatus('A biztonságos szerverkapcsolat most nem érhető el. Kérlek próbáld újra később.', 'error');
				} finally {
					setSubmitDisabled(forcePasswordForm, false);
				}
			});
		}

		if (accountProfileForm) {
			accountProfileForm.addEventListener('submit', async (e) => {
				e.preventDefault();
				setAuthStatus('');
				const name = accountProfileForm.elements.name.value.trim();
				const email = accountProfileForm.elements.email.value.trim();
				const currentPassword = accountProfileForm.elements.currentPassword.value;
				if (!name || name.length < 2) return setAuthStatus('Add meg a teljes neved.', 'error');
				if (!emailPattern.test(email)) return setAuthStatus('Adj meg érvényes email címet.', 'error');
				setSubmitDisabled(accountProfileForm, true);
				try {
					const { response, payload } = await authApiJson('/api/account/profile', {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ name, email, currentPassword })
					});
					if (!response.ok) return setAuthStatus(payload.error || 'Az adatlap mentése nem sikerült.', 'error');
					setAuthStatus(payload.message || 'Adatlap mentve.', 'success');
					await loadAccountDashboard(false);
					setAccountView('profile');
				} catch (err) {
					setAuthStatus('Az adatlap mentése nem sikerült.', 'error');
				} finally {
					setSubmitDisabled(accountProfileForm, false);
				}
			});
		}

		if (accountPasswordForm) {
			accountPasswordForm.addEventListener('submit', async (e) => {
				e.preventDefault();
				setAuthStatus('');
				const currentPassword = accountPasswordForm.elements.currentPassword.value;
				const newPassword = accountPasswordForm.elements.newPassword.value;
				if (!currentPassword) return setAuthStatus('Add meg a jelenlegi jelszót.', 'error');
				if (!strongPasswordPattern.test(newPassword)) return setAuthStatus('Az új jelszó nem elég erős.', 'error');
				setSubmitDisabled(accountPasswordForm, true);
				try {
					const { response, payload } = await authApiJson('/api/auth/change-password', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ currentPassword, newPassword })
					});
					if (!response.ok) return setAuthStatus(payload.error || 'A jelszó módosítása nem sikerült.', 'error');
					accountPasswordForm.reset();
					setAuthStatus(payload.message || 'Jelszó módosítva.', 'success');
				} catch (err) {
					setAuthStatus('A jelszó módosítása nem sikerült.', 'error');
				} finally {
					setSubmitDisabled(accountPasswordForm, false);
				}
			});
		}

		if (accountSettingsForm && accountThemeMode) {
			accountSettingsForm.addEventListener('submit', (e) => {
				e.preventDefault();
				const nextTheme = accountThemeMode.value || 'system';
				applyTheme(nextTheme);
				try { localStorage.setItem(THEME_KEY, nextTheme); } catch (err) { /* ignore storage errors */ }
				setAuthStatus('Beállítás mentve.', 'success');
			});
		}

		if (accountMessageForm) {
			const messageTextarea = accountMessageForm.elements.message;
			if (messageTextarea) {
				const resizeMessageTextarea = () => {
					messageTextarea.style.height = 'auto';
					messageTextarea.style.height = `${Math.min(messageTextarea.scrollHeight, 140)}px`;
				};
				messageTextarea.addEventListener('input', resizeMessageTextarea);
				messageTextarea.addEventListener('keydown', (event) => {
					if (event.key === 'Enter' && !event.shiftKey) {
						event.preventDefault();
						accountMessageForm.requestSubmit();
					}
				});
			}
			accountMessageForm.addEventListener('submit', async (e) => {
				e.preventDefault();
				setAuthStatus('');
				const message = accountMessageForm.elements.message.value.trim();
				if (!message || message.length < 2) return setAuthStatus('Írj üzenetet.', 'error');
				setSubmitDisabled(accountMessageForm, true);
				try {
					const { response, payload } = await authApiJson('/api/account/messages', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ message })
					});
					if (!response.ok) return setAuthStatus(payload.error || 'Az üzenet küldése nem sikerült.', 'error');
					accountMessageForm.reset();
					if (messageTextarea) messageTextarea.style.height = '';
					setAuthStatus(payload.notice || 'Üzenet elküldve.', 'success');
					await loadAccountMessages();
				} catch (err) {
					setAuthStatus('Az üzenet küldése nem sikerült.', 'error');
				} finally {
					setSubmitDisabled(accountMessageForm, false);
				}
			});
		}

			if (accountNotifyBtn) {
				accountNotifyBtn.addEventListener('click', (event) => {
					event.stopPropagation();
					const messages = Array.isArray(latestAccountData?.messages) ? latestAccountData.messages : [];
					const items = messages
						.filter(message => message.senderRole === 'admin')
						.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
						.map(message => ({
							title: 'Admin válasz érkezett',
							body: message.body || 'Üzenet',
							time: formatNotificationDate(message.createdAt),
							onClick: () => {
								setAccountView('messages');
								markAccountMessagesSeen(messages);
							}
						}));
					showNotificationPanel(accountNotifyBtn, items);
				});
			}

		if (accountLogoutBtn) {
			accountLogoutBtn.addEventListener('click', async () => {
				await authApiJson('/api/auth/logout', { method: 'POST' });
				latestAccountData = null;
				isAccountAuthenticated = false;
				removePrivateNavLinks();
				if (accountNotifyBtn) accountNotifyBtn.hidden = true;
				if (accountNotifyBadge) accountNotifyBadge.hidden = true;
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
				overview: document.getElementById('admin-overview-view'),
				users: document.getElementById('admin-users-view'),
				tasks: document.getElementById('admin-tasks-view'),
				contacts: document.getElementById('admin-contacts-view'),
				requests: document.getElementById('admin-requests-view'),
				messages: document.getElementById('admin-messages-view')
			};
			const adminUsersList = document.getElementById('admin-users');
			const adminUserSearch = document.getElementById('admin-user-search');
			const adminUserSelect = document.getElementById('admin-user-select');
		const adminTaskUserSelect = document.getElementById('admin-task-user');
			const adminMessageUserSelect = document.getElementById('admin-message-user');
			const adminPasswordForm = document.getElementById('admin-password-form');
			const adminDisableBtn = document.getElementById('admin-disable-user');
			const adminRestoreBtn = document.getElementById('admin-restore-user');
			const adminGenerateTokenBtn = document.getElementById('admin-generate-token');
			const adminDeleteBtn = document.getElementById('admin-delete-user');
			const adminRefreshAllBtn = document.getElementById('admin-refresh-all');
			const adminRefreshUsersBtn = document.getElementById('admin-refresh-users');
		const adminTokenOutput = document.getElementById('admin-token-output');
		const adminSelectedSummary = document.getElementById('admin-selected-summary');
		const adminStatUsers = document.getElementById('admin-stat-users');
		const adminStatTasks = document.getElementById('admin-stat-tasks');
		const adminStatSuccess = document.getElementById('admin-stat-success');
		const adminRecentContacts = document.getElementById('admin-recent-contacts');
		const adminRecentTasks = document.getElementById('admin-recent-tasks');
		const adminActiveClients = document.getElementById('admin-active-clients');
		const adminSystemState = document.getElementById('admin-system-state');
		const adminTaskForm = document.getElementById('admin-task-form');
		const adminTaskId = document.getElementById('admin-task-id');
		const adminTaskFormTitle = document.getElementById('admin-task-form-title');
		const adminTaskList = document.getElementById('admin-task-list');
		const adminNewTaskBtn = document.getElementById('admin-new-task');
			const adminTaskResetBtn = document.getElementById('admin-task-reset');
			const adminContactList = document.getElementById('admin-contact-list');
			const adminRefreshContactsBtn = document.getElementById('admin-refresh-contacts');
			const adminRequestList = document.getElementById('admin-request-list');
		const adminRefreshRequestsBtn = document.getElementById('admin-refresh-requests');
		const adminMessageList = document.getElementById('admin-message-list');
		const adminConversationList = document.getElementById('admin-conversation-list');
		const adminChatUser = document.getElementById('admin-chat-user');
		const adminChatSubtitle = document.getElementById('admin-chat-subtitle');
		const adminMessageForm = document.getElementById('admin-message-form');
		const adminRefreshMessagesBtn = document.getElementById('admin-refresh-messages');
		const adminNotifyBtn = document.getElementById('admin-notify-btn');
		const adminNotifyBadge = document.getElementById('admin-notify-badge');

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
			let cachedRequests = [];
			let cachedMessages = [];
			let cachedContactRequests = [];
			let selectedAdminUserId = '';
			let adminUserFilter = '';
			let selectedConversationUserId = '';
		const ADMIN_LAST_SEEN_KEY = 'across-admin-last-seen';

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
			if (adminNotifyBtn) adminNotifyBtn.hidden = mode !== 'ready';
			if (adminNotifyBadge) adminNotifyBadge.hidden = true;
		}

			function selectedUser() {
				const selectedId = selectedAdminUserId || adminUserSelect?.value || '';
				return cachedUsers.find(user => user.id === selectedId) || null;
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
				if (status === 'pending') return 'Folyamatban';
				if (status === 'approved') return 'Jóváhagyva';
				if (status === 'rejected') return 'Elutasítva';
				if (status === 'new') return 'Új';
				if (status === 'in_progress') return 'Folyamatban';
				if (status === 'replied') return 'Megválaszolva';
				if (status === 'archived') return 'Archiválva';
				return status === 'active' ? 'Aktív' : 'Letiltva';
			}

		function textEl(tagName, className, text) {
			const el = document.createElement(tagName);
			if (className) el.className = className;
			el.textContent = text;
			return el;
		}

			function setAdminView(viewName) {
				const nextView = adminViews[viewName] ? viewName : 'overview';
				Object.entries(adminViews).forEach(([name, panel]) => {
					if (panel) panel.hidden = name !== nextView;
				});
				adminNavBtns.forEach(btn => {
					btn.classList.toggle('is-active', btn.getAttribute('data-admin-view') === nextView);
				});
			}

			function openAdminView(viewName) {
				setAdminView(viewName);
				setAdminStatus('');
				if (viewName === 'tasks') resetTaskForm();
				if (viewName === 'contacts') loadAdminContactRequests().catch(err => setAdminStatus(err.message, 'error'));
				if (viewName === 'requests') loadAdminPlanRequests().catch(err => setAdminStatus(err.message, 'error'));
				if (viewName === 'messages') {
					markAdminMessagesSeen();
					loadAdminMessages().catch(err => setAdminStatus(err.message, 'error'));
				}
			}

		function userName(userId) {
			const user = cachedUsers.find(item => item.id === userId);
			return user ? `${user.name} (${user.email})` : 'Ismeretlen felhasználó';
		}

		function readAdminLastSeen() {
			try { return Number(localStorage.getItem(ADMIN_LAST_SEEN_KEY) || 0); } catch (err) { return 0; }
		}

		function writeAdminLastSeen(value) {
			try { localStorage.setItem(ADMIN_LAST_SEEN_KEY, String(value)); } catch (err) { /* ignore */ }
		}

			function updateAdminNotifications() {
				if (!adminNotifyBtn || !adminNotifyBadge) return;
				const unreadMessages = cachedMessages.filter(message => message.senderRole === 'user' && new Date(message.createdAt).getTime() > readAdminLastSeen()).length;
				const pendingRequests = cachedRequests.filter(request => request.status === 'pending').length;
				const newContacts = cachedContactRequests.filter(request => request.status === 'new').length;
				const unread = unreadMessages + pendingRequests + newContacts;
				const showBell = !adminApp?.hidden;
			const showBubble = showBell && unread > 0;
			adminNotifyBtn.hidden = !showBell;
			adminNotifyBtn.style.display = showBell ? '' : 'none';
			adminNotifyBadge.hidden = !showBubble;
			adminNotifyBadge.style.display = showBubble ? '' : 'none';
			adminNotifyBadge.textContent = String(unread);
		}

		function markAdminMessagesSeen() {
			const latest = cachedMessages.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
			if (latest) writeAdminLastSeen(new Date(latest.createdAt).getTime());
			updateAdminNotifications();
		}

		function sortByRecent(items, key = 'createdAt') {
			return items.slice().sort((a, b) => new Date(b[key] || b.createdAt || 0).getTime() - new Date(a[key] || a.createdAt || 0).getTime());
		}

		function renderWidgetList(container, items, emptyText) {
			if (!container) return;
			container.innerHTML = '';
			if (!items.length) {
				container.appendChild(textEl('p', 'auth-hint admin-widget-empty', emptyText));
				return;
			}
			items.forEach(item => container.appendChild(item));
		}

		function widgetItem(title, meta, badgeText, badgeClass = '') {
			const item = document.createElement('article');
			item.className = 'admin-widget-item';
			const top = document.createElement('div');
			top.className = 'admin-widget-item-top';
			top.replaceChildren(
				textEl('strong', '', title),
				badgeText ? textEl('span', `admin-badge ${badgeClass}`, badgeText) : document.createTextNode('')
			);
			item.replaceChildren(top, textEl('small', '', meta));
			return item;
		}

		function renderAdminOverviewWidgets() {
			const contactItems = sortByRecent(cachedContactRequests).slice(0, 3).map(request => {
				const statusClass = request.status === 'new' ? 'is-warning' : request.status === 'in_progress' ? 'is-active' : 'is-disabled';
				return widgetItem(
					request.name || 'Névtelen megkeresés',
					`${request.email || 'nincs email'} · ${formatDate(request.createdAt)}`,
					statusLabel(request.status),
					statusClass
				);
			});
			renderWidgetList(adminRecentContacts, contactItems, 'Még nincs friss megkeresés.');

			const taskItems = sortByRecent(cachedTasks, 'completedAt').slice(0, 3).map(task => widgetItem(
				task.topic || 'Feladat',
				`${userName(task.userId)} · ${task.durationMinutes || 0} perc · ${formatDate(task.completedAt)}`,
				statusLabel(task.status),
				task.status === 'successful' ? 'is-active' : 'is-disabled'
			));
			renderWidgetList(adminRecentTasks, taskItems, 'Még nincs rögzített munka.');

			const activeItems = cachedUsers
				.filter(user => user.role !== 'admin' && user.status === 'active')
				.slice(0, 4)
				.map(user => {
					const taskCount = cachedTasks.filter(task => task.userId === user.id).length;
					return widgetItem(user.name, `${user.email} · ${taskCount} munka`, 'Aktív', 'is-active');
				});
			renderWidgetList(adminActiveClients, activeItems, 'Még nincs aktív ügyfélfiók.');

			const pendingRequests = cachedRequests.filter(request => request.status === 'pending').length;
			const newContacts = cachedContactRequests.filter(request => request.status === 'new').length;
			const userMessages = cachedMessages.filter(message => message.senderRole === 'user').length;
			const systemItems = [
				widgetItem('API kapcsolat', 'Szerveroldali admin végpontok elérhetők', 'Online', 'is-active'),
				widgetItem('Megkeresések', `${newContacts} új kapcsolatfelvétel`, newContacts ? 'Figyelmet kér' : 'Rendben', newContacts ? 'is-warning' : 'is-active'),
				widgetItem('Csomagkérelmek', `${pendingRequests} függőben lévő kérés`, pendingRequests ? 'Teendő' : 'Rendben', pendingRequests ? 'is-warning' : 'is-active'),
				widgetItem('Üzenetközpont', `${userMessages} ügyfélüzenet összesen`, 'Aktív', 'is-active')
			];
			renderWidgetList(adminSystemState, systemItems, 'A rendszer állapota még nem elérhető.');
		}

		function updateAdminStats() {
			if (adminStatUsers) adminStatUsers.textContent = String(cachedUsers.length);
			if (adminStatTasks) adminStatTasks.textContent = String(cachedTasks.length);
			if (adminStatSuccess) {
				adminStatSuccess.textContent = String(cachedTasks.filter(task => task.status === 'successful').length);
			}
			renderAdminOverviewWidgets();
		}

			function updateSelectedSummary() {
				if (!adminSelectedSummary) return;
				const user = selectedUser();
				if (!user) {
				adminSelectedSummary.textContent = 'Nincs kiválasztott felhasználó.';
				updateUserActionState(null);
				return;
			}

			const taskCount = cachedTasks.filter(task => task.userId === user.id).length;
			adminSelectedSummary.replaceChildren(
				textEl('strong', '', user.name),
				textEl('span', '', user.email),
				textEl('span', '', `${roleLabel(user.role)} · ${statusLabel(user.status)} · létrehozva: ${formatDate(user.createdAt)} · feladatok: ${taskCount}`)
			);
				updateUserActionState(user);
			}

			function selectAdminUser(user) {
				selectedAdminUserId = user?.id || '';
				if (adminUserSelect && selectedAdminUserId) adminUserSelect.value = selectedAdminUserId;
				if (adminTokenOutput) adminTokenOutput.textContent = '';
				updateSelectedSummary();
				renderUsers(cachedUsers);
			}

			async function changeUserPassword(user) {
				if (!user) return setAdminStatus('Válassz ki felhasználót.', 'error');
				const newPassword = window.prompt(`Ideiglenes új jelszó ehhez a fiókhoz:\n${user.name} (${user.email})`);
				if (newPassword === null) return;
				if (!strongPasswordPattern.test(newPassword)) {
					setAdminStatus('Az új jelszó nem elég erős.', 'error');
					return;
				}
				const { response, payload } = await apiJson(`/api/admin/users/${encodeURIComponent(user.id)}/password`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ newPassword })
				});
				if (!response.ok) return setAdminStatus(payload.error || 'Jelszó módosítás sikertelen.', 'error');
				setAdminStatus(payload.message || 'Jelszó frissítve.', 'success');
				await loadAdminUsers();
			}

			async function disableUser(user) {
				if (!user) return setAdminStatus('Válassz ki felhasználót.', 'error');
				if (user.role === 'admin') return setAdminStatus('Admin fiók nem tiltható le ezen a felületen.', 'error');
				const { response, payload } = await apiJson(`/api/admin/users/${encodeURIComponent(user.id)}/disable`, { method: 'POST' });
				if (!response.ok) return setAdminStatus(payload.error || 'A letiltás nem sikerült.', 'error');
				setAdminStatus(payload.message || 'Fiók letiltva.', 'success');
				await loadAdminUsers();
			}

			async function restoreUser(user) {
				if (!user) return setAdminStatus('Válassz ki felhasználót.', 'error');
				const { response, payload } = await apiJson(`/api/admin/users/${encodeURIComponent(user.id)}/restore`, { method: 'POST' });
				if (!response.ok) return setAdminStatus(payload.error || 'A visszaállítás nem sikerült.', 'error');
				setAdminStatus(payload.message || 'Fiók visszaállítva.', 'success');
				await loadAdminUsers();
			}

			async function generateUserResetToken(user) {
				if (adminTokenOutput) adminTokenOutput.textContent = '';
				if (!user) return setAdminStatus('Válassz ki felhasználót.', 'error');
				const { response, payload } = await apiJson(`/api/admin/users/${encodeURIComponent(user.id)}/reset-token`, { method: 'POST' });
				if (!response.ok) return setAdminStatus(payload.error || 'A token generálás nem sikerült.', 'error');
				setAdminStatus(payload.message || 'Reset token generálva.', 'success');
				if (payload.resetToken && adminTokenOutput) {
					adminTokenOutput.textContent = `Fejlesztői token (${user.email}): ${payload.resetToken}`;
				}
			}

			async function deleteUser(user) {
				if (adminTokenOutput) adminTokenOutput.textContent = '';
				if (!user) return setAdminStatus('Válassz ki felhasználót.', 'error');
				if (user.role === 'admin') return setAdminStatus('Admin fiók nem törölhető ezen a felületen.', 'error');
				const taskCount = cachedTasks.filter(task => task.userId === user.id).length;
				const confirmed = window.confirm(`Biztosan törlöd ezt a fiókot?\n\n${user.name} (${user.email})\nKapcsolódó előzmények: ${taskCount} db\n\nA művelet nem vonható vissza.`);
				if (!confirmed) return;
				const { response, payload } = await apiJson(`/api/admin/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' });
				if (!response.ok) return setAdminStatus(payload.error || 'A fiók törlése nem sikerült.', 'error');
				setAdminStatus(payload.message || 'Fiók törölve.', 'success');
				selectedAdminUserId = '';
				await refreshAdminData();
				resetTaskForm();
			}

		function updateUserActionState(user) {
			const isAdminUser = user?.role === 'admin';
			[adminDisableBtn, adminDeleteBtn].forEach(btn => {
				if (btn) {
					btn.disabled = !user || isAdminUser;
					btn.title = isAdminUser ? 'Admin fiók nem törölhető vagy tiltható le ezen a felületen.' : '';
				}
			});
			if (adminRestoreBtn) adminRestoreBtn.disabled = !user;
			if (adminGenerateTokenBtn) adminGenerateTokenBtn.disabled = !user;
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
				renderUserOptions(adminMessageUserSelect, false);
				updateSelectedSummary();

				if (adminUsersList) {
					adminUsersList.innerHTML = '';
					const query = adminUserFilter.trim().toLowerCase();
					const visibleUsers = cachedUsers.filter(user => {
						const haystack = [
							user.name,
							user.email,
							roleLabel(user.role),
							statusLabel(user.status),
							String(cachedTasks.filter(task => task.userId === user.id).length)
						].join(' ').toLowerCase();
						return !query || haystack.includes(query);
					});
					if (!visibleUsers.length) {
						const empty = document.createElement('li');
						empty.className = 'admin-user-row';
						empty.appendChild(textEl('span', 'auth-hint', 'Nincs találat erre a keresésre.'));
						adminUsersList.appendChild(empty);
						updateAdminStats();
						return;
					}
					visibleUsers.forEach(user => {
						const li = document.createElement('li');
						li.className = `admin-user-row${user.id === selectedAdminUserId ? ' is-selected' : ''}`;
						const statusClass = user.status === 'active' ? 'is-active' : 'is-disabled';
						const identity = document.createElement('div');
						identity.className = 'admin-user-identity';
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

						const actions = document.createElement('div');
						actions.className = 'admin-user-actions';
						const passwordBtn = textEl('button', 'btn secondary compact', 'Jelszó');
						const disableBtn = textEl('button', 'btn secondary compact', 'Letiltás');
						const restoreBtn = textEl('button', 'btn secondary compact', 'Visszaállítás');
						const tokenBtn = textEl('button', 'btn secondary compact', 'Reset token');
						const deleteBtn = textEl('button', 'btn secondary danger compact', 'Törlés');
						[passwordBtn, disableBtn, restoreBtn, tokenBtn, deleteBtn].forEach(btn => { btn.type = 'button'; });
						disableBtn.disabled = user.role === 'admin' || user.status !== 'active';
						restoreBtn.disabled = user.status === 'active';
						deleteBtn.disabled = user.role === 'admin';
						passwordBtn.addEventListener('click', () => { selectAdminUser(user); changeUserPassword(user).catch(err => setAdminStatus(err.message, 'error')); });
						disableBtn.addEventListener('click', () => { selectAdminUser(user); disableUser(user).catch(err => setAdminStatus(err.message, 'error')); });
						restoreBtn.addEventListener('click', () => { selectAdminUser(user); restoreUser(user).catch(err => setAdminStatus(err.message, 'error')); });
						tokenBtn.addEventListener('click', () => { selectAdminUser(user); generateUserResetToken(user).catch(err => setAdminStatus(err.message, 'error')); });
						deleteBtn.addEventListener('click', () => { selectAdminUser(user); deleteUser(user).catch(err => setAdminStatus(err.message, 'error')); });
						actions.replaceChildren(passwordBtn, disableBtn, restoreBtn, tokenBtn, deleteBtn);

						li.replaceChildren(identity, meta, actions);
						adminUsersList.appendChild(li);
					});
				}
				updateAdminStats();
			}

			function renderPlanRequests(requests) {
				cachedRequests = Array.isArray(requests) ? requests : [];
				if (!adminRequestList) return;
			adminRequestList.innerHTML = '';
			if (!cachedRequests.length) {
				adminRequestList.appendChild(textEl('p', 'auth-hint', 'Még nincs csomagmódosítási kérelem.'));
				updateAdminStats();
				return;
			}
			cachedRequests.forEach(request => {
				const item = document.createElement('article');
				item.className = 'admin-task-item';
				const header = document.createElement('div');
				header.className = 'admin-task-item-header';
				header.replaceChildren(
					textEl('strong', '', `${request.userName} (${request.userEmail})`),
					textEl('span', `admin-badge ${request.status === 'pending' ? 'is-warning' : request.status === 'approved' ? 'is-active' : 'is-disabled'}`, statusLabel(request.status))
				);
				const meta = document.createElement('div');
				meta.className = 'history-meta';
				meta.replaceChildren(
					textEl('span', '', `${request.currentPlanName || request.currentPlan} -> ${request.requestedPlanName || request.requestedPlan}`),
					textEl('span', '', formatDate(request.createdAt))
				);
				const actions = document.createElement('div');
				actions.className = 'admin-task-actions';
				const approveBtn = textEl('button', 'btn', 'Jóváhagyás');
				approveBtn.type = 'button';
				approveBtn.disabled = request.status !== 'pending';
				approveBtn.addEventListener('click', () => updatePlanRequest(request.id, 'approved'));
				const rejectBtn = textEl('button', 'btn secondary danger', 'Elutasítás');
				rejectBtn.type = 'button';
				rejectBtn.disabled = request.status !== 'pending';
				rejectBtn.addEventListener('click', () => updatePlanRequest(request.id, 'rejected'));
				actions.replaceChildren(approveBtn, rejectBtn);
				item.replaceChildren(header, meta, textEl('p', 'auth-hint', request.note || request.adminNote || ''), actions);
				adminRequestList.appendChild(item);
			});
			updateAdminStats();
		}

		function renderAdminMessages(messages) {
			cachedMessages = Array.isArray(messages) ? messages : [];
			const grouped = new Map();
			cachedMessages.forEach(message => {
				const key = message.userId || 'unknown';
				if (!grouped.has(key)) grouped.set(key, []);
				grouped.get(key).push(message);
			});
			const users = Array.from(grouped.entries()).sort((a, b) => new Date(b[1][b[1].length - 1].createdAt).getTime() - new Date(a[1][a[1].length - 1].createdAt).getTime());

			if (!adminConversationList) return;
			adminConversationList.innerHTML = '';
				if (!users.length) {
					adminConversationList.appendChild(textEl('p', 'auth-hint', 'Még nincs üzenetváltás.'));
					if (adminMessageList) adminMessageList.innerHTML = '';
					if (adminChatUser) adminChatUser.textContent = 'Nincs beszélgetés';
					if (adminChatSubtitle) adminChatSubtitle.textContent = 'Az új ügyfélüzenetek itt jelennek majd meg.';
					if (adminMessageForm) {
						adminMessageForm.elements.message.disabled = true;
						adminMessageForm.querySelector('button[type="submit"]').disabled = true;
					}
					updateAdminNotifications();
					updateAdminStats();
					return;
				}

			if (!selectedConversationUserId || !grouped.has(selectedConversationUserId)) {
				selectedConversationUserId = users[0][0];
			}

				users.forEach(([userId, items]) => {
					const latest = items.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
					const unread = items.filter(message => message.senderRole === 'user' && new Date(message.createdAt).getTime() > readAdminLastSeen()).length;
					const article = document.createElement('button');
					article.type = 'button';
					article.className = `admin-conversation-item ${userId === selectedConversationUserId ? 'is-active' : ''}`;
					const selectedUser = cachedUsers.find(user => user.id === userId) || null;
					const initials = (selectedUser?.name || 'AP').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
					const avatar = textEl('span', 'chat-avatar small', initials || 'AP');
					const body = document.createElement('div');
					body.className = 'conversation-body';
					const row = document.createElement('div');
					row.className = 'admin-conversation-meta';
					row.replaceChildren(
						textEl('strong', '', selectedUser ? selectedUser.name : userName(userId)),
						textEl('small', '', formatNotificationDate(latest?.createdAt))
					);
					const preview = textEl('span', 'auth-hint', (latest && latest.body) ? latest.body.slice(0, 92) : 'Nincs előző üzenet');
					body.replaceChildren(row, preview);
					const badge = unread ? textEl('span', 'admin-conversation-badge', String(unread)) : document.createTextNode('');
					article.replaceChildren(avatar, body, badge);
					article.addEventListener('click', () => {
						selectedConversationUserId = userId;
						renderAdminMessages(cachedMessages);
						markAdminMessagesSeen();
				});
				adminConversationList.appendChild(article);
			});

			const selectedItems = grouped.get(selectedConversationUserId) || users[0][1];
				if (adminMessageList) {
					adminMessageList.innerHTML = '';
					const selectedUser = cachedUsers.find(user => user.id === selectedConversationUserId) || null;
					if (adminChatUser) adminChatUser.textContent = selectedUser ? selectedUser.name : 'Válassz beszélgetést';
					if (adminChatSubtitle) adminChatSubtitle.textContent = selectedUser ? selectedUser.email : 'Az üzenetek itt jelennek meg.';
					if (adminMessageUserSelect) adminMessageUserSelect.value = selectedConversationUserId;
					if (adminMessageForm) {
						adminMessageForm.elements.message.disabled = !selectedConversationUserId;
						adminMessageForm.querySelector('button[type="submit"]').disabled = !selectedConversationUserId;
					}
					selectedItems.slice().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).forEach(message => {
						const item = document.createElement('article');
						item.className = `message-item ${message.senderRole === 'admin' ? 'is-admin' : 'is-user'}`;
						item.replaceChildren(
							textEl('p', '', message.body || ''),
							textEl('small', '', formatNotificationDate(message.createdAt))
						);
						adminMessageList.appendChild(item);
					});
				adminMessageList.scrollTop = adminMessageList.scrollHeight;
			}
			updateAdminNotifications();
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

			async function loadAdminPlanRequests() {
				const { response, payload } = await apiJson('/api/admin/plan-requests');
				if (!response.ok) throw new Error(payload.error || 'A csomagkérelmek nem tölthetők be.');
				renderPlanRequests(payload.requests || []);
			}

			async function loadAdminContactRequests() {
				const { response, payload } = await apiJson('/api/admin/contact-requests');
				if (!response.ok) throw new Error(payload.error || 'A megkeresések nem tölthetők be.');
				renderContactRequests(payload.requests || []);
			}

		async function loadAdminMessages() {
			const { response, payload } = await apiJson('/api/admin/messages');
			if (!response.ok) throw new Error(payload.error || 'Az üzenetek nem tölthetők be.');
			renderAdminMessages(payload.messages || []);
			if (!readAdminLastSeen()) markAdminMessagesSeen();
		}

		async function refreshAdminData() {
				await loadAdminUsers();
				await loadAdminTasks();
				await loadAdminContactRequests();
				await loadAdminPlanRequests();
				await loadAdminMessages();
				renderUsers(cachedUsers);
			}

			function openAdminMessages(userId) {
				if (userId) selectedConversationUserId = userId;
				setAdminView('messages');
				markAdminMessagesSeen();
				loadAdminMessages().catch(err => setAdminStatus(err.message, 'error'));
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

			async function updatePlanRequest(requestId, status) {
			const adminNote = window.prompt(status === 'approved' ? 'Megjegyzés a jóváhagyáshoz (opcionális):' : 'Elutasítás oka (opcionális):') || '';
			const { response, payload } = await apiJson(`/api/admin/plan-requests/${encodeURIComponent(requestId)}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status, adminNote })
			});
			if (!response.ok) {
				setAdminStatus(payload.error || 'A kérelem frissítése nem sikerült.', 'error');
				return;
			}
			setAdminStatus(payload.message || 'Kérelem frissítve.', 'success');
				await refreshAdminData();
				setAdminView('requests');
			}

			async function updateContactRequest(requestId, status) {
				const adminNote = window.prompt('Admin megjegyzés (opcionális):') || '';
				const { response, payload } = await apiJson(`/api/admin/contact-requests/${encodeURIComponent(requestId)}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ status, adminNote })
				});
				if (!response.ok) {
					setAdminStatus(payload.error || 'A megkeresés frissítése nem sikerült.', 'error');
					return;
				}
				setAdminStatus(payload.message || 'Megkeresés frissítve.', 'success');
				await refreshAdminData();
				setAdminView('contacts');
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
				const initialAdminView = window.location.hash === '#messages' ? 'messages' : window.location.hash === '#requests' ? 'requests' : window.location.hash === '#contacts' ? 'contacts' : 'overview';
				setAdminView(initialAdminView);
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
					openAdminView(btn.getAttribute('data-admin-view') || 'overview');
				});
			});

			adminRoot.querySelectorAll('[data-admin-shortcut]').forEach(btn => {
				btn.addEventListener('click', () => {
					openAdminView(btn.getAttribute('data-admin-shortcut') || 'overview');
				});
			});

			if (adminNotifyBtn) {
				adminNotifyBtn.addEventListener('click', (event) => {
					event.stopPropagation();
					const messageItems = cachedMessages
						.filter(message => message.senderRole === 'user')
						.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
						.map(message => ({
							title: userName(message.userId),
							body: message.body || 'Üzenet',
							time: formatNotificationDate(message.createdAt),
							timestamp: new Date(message.createdAt).getTime(),
							onClick: () => openAdminMessages(message.userId)
						}));
					const requestItems = cachedRequests
						.filter(request => request.status === 'pending')
						.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
						.map(request => ({
							title: 'Új csomagmódosítási kérelem',
							body: `${request.userName || 'Ügyfél'}: ${request.currentPlanName || request.currentPlan} -> ${request.requestedPlanName || request.requestedPlan}`,
							time: formatNotificationDate(request.createdAt),
							timestamp: new Date(request.createdAt).getTime(),
							onClick: () => openAdminView('requests')
						}));
					const contactItems = cachedContactRequests
						.filter(request => request.status === 'new')
						.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
						.map(request => ({
							title: 'Új kapcsolatfelvétel',
							body: `${request.name}: ${request.message || 'Megkeresés'}`,
							time: formatNotificationDate(request.createdAt),
							timestamp: new Date(request.createdAt).getTime(),
							onClick: () => openAdminView('contacts')
						}));
					const items = [...contactItems, ...requestItems, ...messageItems].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
					showNotificationPanel(adminNotifyBtn, items);
				});
			}

			function renderContactRequests(requests) {
				cachedContactRequests = Array.isArray(requests) ? requests : [];
				if (!adminContactList) return;
				adminContactList.innerHTML = '';
				if (!cachedContactRequests.length) {
					adminContactList.appendChild(textEl('p', 'auth-hint', 'Még nincs kapcsolatfelvételi megkeresés.'));
					updateAdminStats();
					return;
				}
				cachedContactRequests.forEach(request => {
					const item = document.createElement('article');
					item.className = 'admin-task-item';
					const header = document.createElement('div');
					header.className = 'admin-task-item-header';
					header.replaceChildren(
						textEl('strong', '', `${request.name} (${request.email})`),
						textEl('span', `admin-badge ${request.status === 'new' ? 'is-warning' : request.status === 'replied' ? 'is-active' : 'is-disabled'}`, statusLabel(request.status))
					);
					const meta = document.createElement('div');
					meta.className = 'history-meta';
					meta.replaceChildren(
						textEl('span', '', formatDate(request.createdAt)),
						textEl('span', '', request.adminNote ? `Megjegyzés: ${request.adminNote}` : 'Nincs admin megjegyzés')
					);
					const actions = document.createElement('div');
					actions.className = 'admin-task-actions';
					const progressBtn = textEl('button', 'btn secondary', 'Folyamatban');
					const repliedBtn = textEl('button', 'btn secondary', 'Megválaszolva');
					const archiveBtn = textEl('button', 'btn secondary danger', 'Archiválás');
					[progressBtn, repliedBtn, archiveBtn].forEach(btn => { btn.type = 'button'; });
					progressBtn.disabled = request.status === 'in_progress';
					repliedBtn.disabled = request.status === 'replied';
					archiveBtn.disabled = request.status === 'archived';
					progressBtn.addEventListener('click', () => updateContactRequest(request.id, 'in_progress'));
					repliedBtn.addEventListener('click', () => updateContactRequest(request.id, 'replied'));
					archiveBtn.addEventListener('click', () => updateContactRequest(request.id, 'archived'));
					actions.replaceChildren(progressBtn, repliedBtn, archiveBtn);
					item.replaceChildren(header, meta, textEl('p', 'auth-hint', request.message || ''), actions);
					adminContactList.appendChild(item);
				});
				updateAdminStats();
			}

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

			if (adminRefreshAllBtn) {
				adminRefreshAllBtn.addEventListener('click', async () => {
					try {
						await refreshAdminData();
						setAdminStatus('Admin adatok frissítve.', 'success');
					} catch (err) {
						setAdminStatus(err.message, 'error');
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

			if (adminRefreshRequestsBtn) {
				adminRefreshRequestsBtn.addEventListener('click', async () => {
					try {
						await loadAdminPlanRequests();
						setAdminStatus('Csomagkérelmek frissítve.', 'success');
				} catch (err) {
					setAdminStatus(err.message, 'error');
				}
				});
			}

			if (adminRefreshContactsBtn) {
				adminRefreshContactsBtn.addEventListener('click', async () => {
					try {
						await loadAdminContactRequests();
						setAdminStatus('Megkeresések frissítve.', 'success');
					} catch (err) {
						setAdminStatus(err.message, 'error');
					}
				});
			}

			if (adminRefreshMessagesBtn) {
				adminRefreshMessagesBtn.addEventListener('click', async () => {
					try {
						await loadAdminMessages();
						setAdminStatus('Üzenetek frissítve.', 'success');
				} catch (err) {
					setAdminStatus(err.message, 'error');
				}
				});
			}

			if (adminUserSearch) {
				adminUserSearch.addEventListener('input', () => {
					adminUserFilter = adminUserSearch.value || '';
					renderUsers(cachedUsers);
				});
			}

			if (adminUserSelect) {
				adminUserSelect.addEventListener('change', () => {
					if (adminTokenOutput) adminTokenOutput.textContent = '';
					selectedAdminUserId = adminUserSelect.value || '';
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

			if (adminMessageForm) {
				const messageTextarea = adminMessageForm.elements.message;
				if (messageTextarea) {
					const resizeMessageTextarea = () => {
						messageTextarea.style.height = 'auto';
						messageTextarea.style.height = `${Math.min(messageTextarea.scrollHeight, 130)}px`;
					};
					messageTextarea.addEventListener('input', resizeMessageTextarea);
					messageTextarea.addEventListener('keydown', (event) => {
						if (event.key === 'Enter' && !event.shiftKey) {
							event.preventDefault();
							adminMessageForm.requestSubmit();
						}
					});
				}
				adminMessageForm.addEventListener('submit', async (e) => {
					e.preventDefault();
					setAdminStatus('');
				const userId = adminMessageForm.elements.userId.value;
				const message = adminMessageForm.elements.message.value.trim();
				if (!userId) return setAdminStatus('Válassz ügyfelet.', 'error');
				if (!message || message.length < 2) return setAdminStatus('Írj üzenetet.', 'error');
				setSubmitDisabled(adminMessageForm, true);
				try {
					const { response, payload } = await apiJson('/api/admin/messages', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ userId, message })
					});
					if (!response.ok) {
						setAdminStatus(payload.error || 'Az üzenet küldése nem sikerült.', 'error');
						return;
					}
						adminMessageForm.reset();
						if (messageTextarea) messageTextarea.style.height = '';
						renderUserOptions(adminMessageUserSelect, false);
					setAdminStatus(payload.notice || 'Válasz elküldve.', 'success');
					await loadAdminMessages();
					selectedConversationUserId = userId;
					renderAdminMessages(cachedMessages);
				} catch (err) {
					setAdminStatus('Az üzenet küldése nem sikerült.', 'error');
				} finally {
					setSubmitDisabled(adminMessageForm, false);
				}
			});
		}

		if (adminDeleteBtn) {
			adminDeleteBtn.addEventListener('click', async () => {
				if (adminTokenOutput) adminTokenOutput.textContent = '';
				const user = selectedUser();
				if (!user) {
					setAdminStatus('Válassz ki felhasználót.', 'error');
					return;
				}
				if (user.role === 'admin') {
					setAdminStatus('Admin fiók nem törölhető ezen a felületen.', 'error');
					return;
				}

				const taskCount = cachedTasks.filter(task => task.userId === user.id).length;
				const confirmed = window.confirm(`Biztosan törlöd ezt a fiókot?\n\n${user.name} (${user.email})\nKapcsolódó előzmények: ${taskCount} db\n\nA művelet nem vonható vissza.`);
				if (!confirmed) return;

				const { response, payload } = await apiJson(`/api/admin/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' });
				if (!response.ok) {
					setAdminStatus(payload.error || 'A fiók törlése nem sikerült.', 'error');
					return;
				}

				setAdminStatus(payload.message || 'Fiók törölve.', 'success');
				await refreshAdminData();
				resetTaskForm();
			});
		}

		if (adminLogoutBtn) {
			adminLogoutBtn.addEventListener('click', async () => {
				await apiJson('/api/auth/logout', { method: 'POST' });
				setAdminMode('unauth');
				setAdminStatus('Kijelentkezve.', 'success');
				if (adminSessionUser) adminSessionUser.textContent = 'Nincs bejelentkezve';
				window.location.href = 'index.html';
			});
		}

		bootstrapAdmin().catch(() => {
			setAdminStatus('Az admin felület nem érhető el.', 'error');
		});

		window.setInterval(() => {
			if (adminApp && !adminApp.hidden) {
				loadAdminMessages().catch(() => {});
			}
		}, 15000);
	}
});
