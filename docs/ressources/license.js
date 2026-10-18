// Every version of the license: version -> { date: "YYYY-MM-DD" }
// Keep the newest version FIRST: this is the order shown in the side nav,
// and the first entry is used if init() is called without a version.
// Keep keys as non-integer strings ("1.0.0", not "1") so the order is preserved.
const versions = {
	"0.1": {
		date: "2026-10-18",
		lang: ["en", "fr", "es"]
	},
	"0.0": {
		date: "2026-10-17",
		lang: ["en"]
	}
};

// Every language the site knows. Which of them a given license version is available in is set by `lang` in `versions`.
// code: short id (also the flag file name), name: text shown in the button and the dropdown,
// lic: the word for "license" in that language, used in the page URL (/license, /licence, /licencia).
const languages = [
	{ code: "en", name: "English", lic: "license" },
	{ code: "fr", name: "Fran\u00e7ais", lic: "licence" },
	{ code: "es", name: "Espa\u00f1ol", lic: "licencia" }
];
const defaultLanguage = "en";

// Flag image shown next to a language in the dropdown: /ressources/flags/<code>.png
function langFlag(lang) {
	return "/ressources/flags/" + lang.code + ".png";
}

// Language codes a version is available in (a version without `lang` is English only).
function versionLangs(version) {
	return (versions[version] && versions[version].lang) || [defaultLanguage];
}

// The newest version is the first entry of `versions`.
function latestVersion() {
	return Object.keys(versions)[0];
}

// Where a version's page lives in a given language. Edit this if your URL scheme differs.
// The newest version is served directly at /<word>, archived ones at /<word>/<version>,
// where <word> is the language's `lic` (English: /license, /license/1.0 - Spanish: /licencia, /licencia/1.0).
// If the version isn't available in that language, the English page is used.
// Same idea as docu.createHref: ".html" is appended on localhost.
function versionHref(version, langCode) {
	const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
	const code = versionLangs(version).includes(langCode) ? langCode : defaultLanguage;
	const word = languages.find(l => l.code === code).lic;
	const path = "/" + word + (version === latestVersion() ? "" : "/" + version);
	return isLocal ? path + ".html" : path;
}

// "2026-10-18" -> "October 18, 2026" (built from parts so time zones can't shift the day)
function formatLicenseDate(iso) {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(y, m - 1, d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// Sections shown in the side nav, read straight from the page: [nav label, id of the section div].
// Every `.license-section` that has an id and an <h2> becomes one entry, in page order,
// so adding, removing or renaming a section in the HTML needs no change here.
function readSections() {
	const result = [];
	document.querySelectorAll(".license-section[id]").forEach(div => {
		const heading = div.querySelector("h2");
		if (!heading) return;
		result.push([heading.textContent.replace(/\s+/g, " ").trim(), div.id]);
	});
	return result;
}

// Same structure as docu.js: scroll observer + nav highlighting + hash scrolling
window.lic = {

	subNavs: {},
	visibleEntries: new Set(),
	observer: null,
	lenis: null,
	isScrollingToHash: false,
	hashScrollInterval: null,
	hashScrollTicks: 0,

	stopHashScrollRepeat: function () {
		if (lic.hashScrollInterval) {
			clearInterval(lic.hashScrollInterval);
			lic.hashScrollInterval = null;
			lic.isScrollingToHash = false;
			lic.renderSubNavs();
		}
	},

	// Marks the nav entry of the section currently on screen
	renderSubNavs: function () {
		const keys = Object.keys(lic.subNavs);
		if (keys.length < 1) return;
		keys.forEach(key => lic.subNavs[key].classList.remove("inter"));

		const scrollEl = document.scrollingElement || document.documentElement;
		const atBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 60;
		if (atBottom) {
			lic.subNavs[keys[keys.length - 1]].classList.add("inter");
			return;
		}

		// 1. first section whose heading is visible ("h-<id>")
		for (const key of keys) {
			if (lic.visibleEntries.has("h-" + key)) {
				lic.subNavs[key].classList.add("inter");
				return;
			}
		}
		// 2. otherwise first section whose div is visible ("<id>")
		for (const key of keys) {
			if (lic.visibleEntries.has(key)) {
				lic.subNavs[key].classList.add("inter");
				return;
			}
		}
		// 3. fallback: last one
		lic.subNavs[keys[keys.length - 1]].classList.add("inter");
	},

	// version: the version of the license this page shows (a key of `versions`)
	// langCode: the language this page is written in (one of that version's `lang`)
	init: function (version, langCode) {
		if (version === undefined) version = Object.keys(versions)[0];
		if (!versions[version]) console.error("lic.init: unknown license version '" + version + "'. Add it to `versions`.");

		const availableCodes = versionLangs(version);
		if (langCode === undefined) langCode = defaultLanguage;
		if (!availableCodes.includes(langCode)) {
			console.error("lic.init: version '" + version + "' is not available in '" + langCode + "'. Add it to `versions[\"" + version + "\"].lang`.");
			langCode = availableCodes.includes(defaultLanguage) ? defaultLanguage : availableCodes[0];
		}

		const sections = readSections();
		const body = document.body;
		const content = document.getElementById("scroll-container");

		lic.lenis = new Lenis({
			lerp: 0.1,
			wheelMultiplier: 1,
		});

		function licRaf(time) {
			lic.lenis.raf(time);
			requestAnimationFrame(licRaf);
		}
		requestAnimationFrame(licRaf);

		fog.init([0.0, 0.0, 0.0], [0.45, 0.5, 0.65], lic.lenis, document.scrollingElement, 0.02, 2, 0.08, -1);


		// Scroll observer for selecting the right nav entry
		lic.observer = new IntersectionObserver((entries) => {
			entries.forEach(entry => {
				if (entry.isIntersecting) lic.visibleEntries.add(entry.target.id);
				else lic.visibleEntries.delete(entry.target.id);
			});
			if (!lic.isScrollingToHash) lic.renderSubNavs();
		}, { threshold: 0.0001 });

		let initialHash = location.hash ? location.hash.slice(1) : null;
		if (initialHash) {
			history.scrollRestoration = 'manual';
			history.replaceState(null, '', location.pathname + location.search);
			window.scrollTo(0, 0);
		}

		function repeatScrollToHash(id) {
			lic.stopHashScrollRepeat();
			lic.hashScrollTicks = 0;
			lic.hashScrollInterval = setInterval(() => {
				lic.hashScrollTicks++;
				scrollToHash(id, true);
				if (lic.hashScrollTicks >= 50) lic.stopHashScrollRepeat();
			}, 100);
		}

		function scrollToHash(id, updateHistory = true) {
			const el = document.getElementById(id);
			if (!el || !lic.lenis) return;
			if (updateHistory) history.pushState(null, '', location.pathname + location.search);
			lic.lenis.scrollTo(el, {
				onComplete: () => { lic.isScrollingToHash = false; }
			});
		}

		const interruptScroll = () => {
			if (lic.isScrollingToHash) {
				lic.isScrollingToHash = false;
				lic.renderSubNavs();
			}
			lic.stopHashScrollRepeat();
		};

		const interruptScrollForce = () => {
			lic.isScrollingToHash = false;
			lic.renderSubNavs();
			lic.stopHashScrollRepeat();
		};

		content.addEventListener('wheel', interruptScrollForce, { passive: true });
		content.addEventListener('touchstart', interruptScrollForce, { passive: true });
		content.addEventListener('mousedown', interruptScroll, { passive: true });
		window.addEventListener('keydown', (e) => {
			if (['ArrowUp', 'ArrowDown', ' ', 'PageUp', 'PageDown'].includes(e.key)) interruptScroll();
		}, { passive: true });

		document.addEventListener('click', (e) => {
			const link = e.target.closest('a');
			if (!link || !link.hash) return;

			const url = new URL(link.href, location.href);
			if (url.pathname !== location.pathname) return;

			e.preventDefault();
			lic.stopHashScrollRepeat();
			scrollToHash(url.hash.slice(1));
		});

		window.addEventListener('popstate', () => {
			if (location.hash) scrollToHash(location.hash.slice(1), false);
		});


		// Mini nav bar + tab button (phones)
		const miniNav = document.createElement("div");
		miniNav.classList.add("site-mini-nav");

		const tabButton = document.createElement("button");
		tabButton.classList.add("site-tab");
		const tabImage = document.createElement("img");
		tabImage.alt = "Tab";
		tabImage.src = "/ressources/ham.png";
		tabButton.append(tabImage);

		function tabButtonClick() {
			nav.classList.toggle("hidden");
		}
		tabButton.addEventListener('click', tabButtonClick);

		// Home icon
		const homeIcon = document.createElement("a");
		homeIcon.href = "/";
		homeIcon.classList.add("site-icon", "site-home");
		const homeImage = document.createElement("img");
		homeImage.alt = "Home";
		homeImage.src = "/ressources/home.png";
		homeIcon.append(homeImage);

		body.append(homeIcon);
		body.append(tabButton);
		body.append(miniNav);


		// Language switcher: icon + current language, placed right after the home button
		// (after the hamburger button while the top bar is visible). The dropdown lists this version's languages.
		const langWrap = document.createElement("div");
		langWrap.className = "site-lang";

		const langButton = document.createElement("button");
		langButton.type = "button";
		langButton.className = "site-lang-btn";
		langButton.setAttribute("aria-haspopup", "listbox");
		langButton.setAttribute("aria-expanded", "false");
		const langIcon = document.createElement("img");
		langIcon.className = "site-lang-icon";
		langIcon.alt = "Language";
		langIcon.src = "/ressources/lang.png";
		const langLabel = document.createElement("span");
		langLabel.className = "site-lang-label";
		langButton.append(langIcon, langLabel);

		const langMenu = document.createElement("div");
		langMenu.className = "site-lang-menu";
		langMenu.setAttribute("role", "listbox");

		const langOptions = {};

		function setLanguage(code) {
			const lang = languages.find(l => l.code === code) || languages[0];
			lic.lang = lang.code;
			langLabel.textContent = lang.name;
			Object.entries(langOptions).forEach(([c, el]) => {
				const selected = c === lang.code;
				el.classList.toggle("selected", selected);
				el.setAttribute("aria-selected", selected ? "true" : "false");
			});
		}

		function toggleLangMenu(open) {
			const willOpen = open === undefined ? !langWrap.classList.contains("open") : open;
			langWrap.classList.toggle("open", willOpen);
			langButton.setAttribute("aria-expanded", willOpen ? "true" : "false");
		}

		const availableLanguages = availableCodes.map(c => languages.find(l => l.code === c)).filter(Boolean);
		availableLanguages.forEach(lang => {
			const option = document.createElement("button");
			option.type = "button";
			option.className = "site-lang-option";
			option.setAttribute("role", "option");
			const flag = document.createElement("img");
			flag.className = "site-lang-flag";
			flag.alt = "";
			flag.src = langFlag(lang);
			const name = document.createElement("span");
			name.textContent = lang.name;
			option.append(flag, name);
			option.addEventListener("click", () => {
				toggleLangMenu(false);
				// Go to this version's page in that language (the selection updates when the page loads)
				if (lang.code !== lic.lang) location.href = versionHref(version, lang.code);
			});
			langMenu.appendChild(option);
			langOptions[lang.code] = option;
		});

		langButton.addEventListener("click", () => toggleLangMenu());
		document.addEventListener("click", (e) => {
			if (!langWrap.contains(e.target)) toggleLangMenu(false);
		});
		window.addEventListener("keydown", (e) => {
			if (e.key === "Escape") toggleLangMenu(false);
		});

		langWrap.append(langButton, langMenu);
		body.append(langWrap);
		setLanguage(langCode);

		// Follow the home button, or the hamburger button while the top bar is shown
		// Horizontally: right after the button's box. Vertically: centered on the button's icon itself
		// (not its box, which can have padding / line-height that shifts the center).
		function positionLang() {
			const topBar = getComputedStyle(miniNav).display !== "none";
			const box = (topBar ? tabButton : homeIcon).getBoundingClientRect();
			const icon = (topBar ? tabImage : homeImage).getBoundingClientRect();
			const centerY = icon.height ? icon.top + icon.height / 2 : box.top + box.height / 2;
			langWrap.style.left = box.right + "px";
			langWrap.style.top = (centerY - langWrap.offsetHeight / 2) + "px";
		}
		positionLang();
		window.addEventListener("resize", positionLang);
		window.addEventListener("scroll", positionLang, { passive: true });
		homeImage.addEventListener("load", positionLang);
		if (window.ResizeObserver) {
			const langObserver = new ResizeObserver(positionLang);
			langObserver.observe(homeIcon);
			langObserver.observe(homeImage);
			langObserver.observe(tabButton);
			langObserver.observe(tabImage);
		}


		function closeNavOnOutsideInteraction(e) {
			if (nav.classList.contains("hidden")) return;
			if (nav.contains(e.target) || tabButton.contains(e.target) || (homeIcon && homeIcon.contains(e.target)) || miniNav.contains(e.target)) return;
			tabButtonClick();
		}

		body.addEventListener('click', closeNavOnOutsideInteraction);
		body.addEventListener('touchmove', closeNavOnOutsideInteraction, { passive: true });


		// Create the nav (starts closed on phones, always visible on desktop)
		const nav = document.createElement('div');
		nav.id = "nav";
		nav.classList.add("hidden");
		body.appendChild(nav);

		const navScroll = document.createElement('nav');
		navScroll.id = 'nav-scroll';
		navScroll.setAttribute('data-lenis-prevent', '');
		nav.appendChild(navScroll);
		const navInner = document.createElement('div');
		navInner.id = 'nav-inner';
		navScroll.appendChild(navInner);

		const lenisNav = new Lenis({
			wrapper: navScroll,
			content: navInner,
			lerp: 0.1,
			wheelMultiplier: 0.5,
			touchMultiplier: 1.0,
			syncTouch: false,
		});

		function raf(time) {
			lenisNav.raf(time);
			requestAnimationFrame(raf);
		}
		requestAnimationFrame(raf);


		// "Version X, Date" line under the title
		const head = document.querySelector(".license-head");
		const versionLine = document.createElement("div");
		versionLine.className = "license-version";
		const versionDate = versions[version] ? versions[version].date : null;
		versionLine.textContent = "Version " + version + (versionDate ? ", " + formatLicenseDate(versionDate) : "");
		head.appendChild(versionLine);


		// Archived versions get a notice above the license text pointing to the current one
		if (versions[version] && version !== latestVersion()) {
			const banner = document.createElement("div");
			banner.className = "license-archive-banner";

			const strong = document.createElement("b");
			strong.textContent = "You\u2019re viewing an archived version of the LXON Developer License. ";
			banner.append(strong);
			banner.append("It remains available for legal transparency reasons " +
				"and for shipped products still released under it. " +
				"All current and future usage is governed by the updated license, with no exceptions.");
			const link = document.createElement("a");
			link.href = versionHref(latestVersion(), langCode);
			link.textContent = "View the current license (Version " + latestVersion() + ")";
			link.style.display = "block";
			link.style.marginTop = "0.75rem";
			banner.append(link);

			const licenseBody = document.querySelector(".license-body");
			licenseBody.insertBefore(banner, licenseBody.firstChild);
		}


		// Fill the nav: one entry per version (like the docs' top level), the sections under the open one
		function appendSections() {
			sections.forEach(([name, id]) => {
				const sub = document.createElement('a');
				sub.textContent = name;
				sub.className = 'nav-sub depth1';
				sub.href = "#" + id;
				sub.id = "sub-nav-" + id;
				sub.onclick = event => {
					lic.stopHashScrollRepeat();
					Object.values(lic.subNavs).forEach(s => s.classList.remove("inter"));
					event.currentTarget.classList.add("inter");
					lic.isScrollingToHash = true;
				};
				navInner.appendChild(sub);
				lic.subNavs[id] = sub;

				const div = document.getElementById(id);
				const heading = div.querySelector("h2");
				heading.id = "h-" + id;
				lic.observer.observe(heading);
				lic.observer.observe(div);
			});
		}

		const versionKeys = Object.keys(versions);
		// If init() got a version that isn't in `versions`, still show it as the open entry
		if (!versions[version]) versionKeys.unshift(version);

		versionKeys.forEach(key => {
			const item = document.createElement('a');
			item.className = 'nav1';
			item.textContent = "Version " + key;
			if (versions[key]) item.title = formatLicenseDate(versions[key].date);
			item.href = versionHref(key, langCode);
			if (key === version) {
				// "selected" = white text, "open" = the highlighted box (same classes the docs use)
				item.classList.add("selected", "open");
				// Clicking the open version scrolls back to the top of the page
				item.onclick = event => {
					event.preventDefault();

					// 1. Stop any running hash scroll FIRST (it resets the lock and re-renders)
					lic.stopHashScrollRepeat();

					// 2. Pause the observer-driven highlighting BEFORE touching the highlight,
					//    otherwise the next scroll tick would override it
					//    (skipped if already at the top, so the lock can't get stuck)
					if (window.scrollY > 2) lic.isScrollingToHash = true;

					// 3. Select the first section right away
					const firstId = sections[0] && sections[0][1];
					Object.values(lic.subNavs).forEach(s => s.classList.remove("inter"));
					if (firstId && lic.subNavs[firstId]) lic.subNavs[firstId].classList.add("inter");

					// 4. Scroll up, then hand control back to the observer on arrival
					lic.lenis.scrollTo(0, {
						onComplete: () => {
							lic.isScrollingToHash = false;
							lic.renderSubNavs();
						}
					});
				};
				navInner.appendChild(item);
				appendSections();
			}
			else navInner.appendChild(item);
		});

		// Fade the right edge of nav entries whose text is cut off by the "…"
		function updateNavTruncation() {
			navInner.querySelectorAll('.nav1, .nav-sub').forEach(el => {
				el.classList.toggle('truncated', el.scrollWidth > el.clientWidth + 1);
			});
		}
		updateNavTruncation();
		window.addEventListener('resize', updateNavTruncation);
		if (document.fonts && document.fonts.ready) document.fonts.ready.then(updateNavTruncation);
		if (window.ResizeObserver) new ResizeObserver(updateNavTruncation).observe(nav);


		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				content.classList.add('loaded');
				lic.renderSubNavs();
			});
		});

		window.addEventListener('pageshow', () => {
			lic.lenis.scrollTo(0, { immediate: true });

			requestAnimationFrame(() => {
				lic.renderSubNavs();

				if (initialHash) {
					Object.values(lic.subNavs).forEach(s => s.classList.remove("inter"));
					if (lic.subNavs[initialHash]) lic.subNavs[initialHash].classList.add("inter");
					lic.isScrollingToHash = true;
					repeatScrollToHash(initialHash);
				}
			});
		});
	}
};
