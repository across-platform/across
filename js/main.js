// Minimal form handling: prevent full-page submit, validate, and log data.
// The server endpoint `/contact` is not implemented — a fetch() example is
// included but commented out for future integration.

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
					// price tag style SVG with a dollar path for crispness
					return '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M21 10v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h8l6 5z" fill="currentColor" opacity="0.12"/><path d="M10.5 7.5c0-1.1.9-2 2-2s2 .9 2 2c0 .8-.5 1.5-1.2 1.8-.8.3-1.3.9-1.3 1.7 0 1.1.9 2 2 2s2-.9 2-2" stroke="currentColor" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
				}
				if (key.includes('contact') || key.includes('kapcsolat')) {
					// at-sign icon drawn as path for consistent rendering
					return '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M12 2a10 10 0 1 0 9.95 9H20a8 8 0 1 1-8-8v0.5a3.5 3.5 0 1 0 .5 7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.5 12a3.5 3.5 0 1 1-3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
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
				// make $ and @ icons slightly smaller for visual balance
				if (key.includes('árak') || key.includes('pricing') || key.includes('kap') || key.includes('kapcsolat') || key.includes('contact')) {
					iconWrapper.classList.add('icon--small');
				}
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

	const form = document.querySelector('form');
	if (!form) return;

	const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	form.addEventListener('submit', async (e) => {
		e.preventDefault();

		const name = form.querySelector('input[type="text"]')?.value?.trim() || '';
		const email = form.querySelector('input[type="email"]')?.value?.trim() || '';
		const message = form.querySelector('textarea')?.value?.trim() || '';

		// Basic validation
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

		const formData = { name, email, message };

		// For now: log the data and show a confirmation to the user.
		// Replace this with a real POST to your backend when available.
		console.log('Contact form submit (stub):', formData);
		alert('Köszönjük! Az üzeneted elküldésre került (demo).');

		// Example stub for future backend integration (commented out):
		/*
		try {
			const resp = await fetch('/contact', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formData)
			});
			if (!resp.ok) throw new Error('Network response was not ok');
			// handle success
		} catch (err) {
			console.error('Failed to send contact:', err);
			alert('Hiba történt az üzenet küldése közben. Kérlek próbáld újra később.');
		}
		*/

		// Optionally clear the form after submit
		form.reset();
	});
});
