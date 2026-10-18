// Sections shown in the side nav: [name and number, id of the section div]
const sections = [
	["Definitions", "definitions"],
	["1. Grant of license", "grant"],
	["2. No modification", "no-modification"],
	["3. EULA", "eula"],
	["4. Branding and Trademarking", "branding"],
	["5. Permitted parsing", "parsing"],
	["6. Permitted serialization", "serialization"],
	["7. Generated File extension", "file-extension"],
	["8. Enforcement and remedies", "enforcement"],
	["9. Disclaimer of warranty", "disclaimer"],
	["10. Limitation of liability", "liability"],
	["11. Changes", "changes"],
	["12. General", "general"]
];

// Every version of the license: version -> { date: "YYYY-MM-DD" }
// Keep the newest version FIRST: this is the order shown in the side nav,
// and the first entry is used if init() is called without a version.
// Keep keys as non-integer strings ("1.0.0", not "1") so the order is preserved.
const versions = {
	"1.0": { date: "2026-10-18" },
	//"0.9": { date: "2026-4-3"}
};

// The newest version is the first entry of `versions`.
function latestVersion() {
	return Object.keys(versions)[0];
}

// Where a version's page lives. Edit this if your URL scheme differs.
// The newest version is served directly at /license, archived ones at /license/<version>.
// Same idea as docu.createHref: ".html" is appended on localhost.
function versionHref(version) {
	const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
	const path = version === latestVersion() ? "/license" : "/license/" + version;
	return isLocal ? path + ".html" : path;
}

// "2026-10-18" -> "October 18, 2026" (built from parts so time zones can't shift the day)
function formatLicenseDate(iso) {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(y, m - 1, d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
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
	init: function (version) {
		if (version === undefined) version = Object.keys(versions)[0];
		if (!versions[version]) console.error("lic.init: unknown license version '" + version + "'. Add it to `versions`.");

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
			banner.append("It remains available for projects released under it. " +
				"New projects, and any project that adopts a newer version of LXON or the Official Tools, " +
				"are governed by the current license.");
			const link = document.createElement("a");
			link.href = versionHref(latestVersion());
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
			item.href = versionHref(key);
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
					const firstId = sections[0][1];
					Object.values(lic.subNavs).forEach(s => s.classList.remove("inter"));
					if (lic.subNavs[firstId]) lic.subNavs[firstId].classList.add("inter");

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
