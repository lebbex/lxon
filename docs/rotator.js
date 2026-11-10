/*
    TEXT ROTATOR
    Shows one paragraph of #rotator at a time. Two layers (text1 = visible one,
    text2 = incoming one) are animated linearly through four poses P1..P4.
    When the transition ends the roles swap and the layer that just faded out
    receives the next text.
*/
(() => {
	// -------------------- Config --------------------

	const HOLD_MS = 2800;     // time a text rests fully visible (P1) before the next transition
	const SEGMENT_MS = 1000;   // duration of each step: P1→P2, P2→P3, P3→P4 (all equal = linear)
	const MAX_BLUR_PX = 12;   // what "100% blur" means
    const VISIBLE_AT = 0;     // fraction of the rotator that must be on screen to count as visible (0 = any pixel)

	// Extra height squash that follows the blur amount (b: 0..1).
	//   height factor = 1 - (1 - BLUR_HEIGHT_MIN) * b ^ BLUR_HEIGHT_CURVE
	// BLUR_HEIGHT_MIN   : height at 100% blur (0.75 = 75%)
	// BLUR_HEIGHT_CURVE : 1 = linear, < 1 = squashes quickly at first then flattens out,
	//                     > 1 = barely squashes until the blur is high
	const BLUR_HEIGHT_MIN = 0.6;
	const BLUR_HEIGHT_CURVE = 1.2;

	// Easing applied to the whole transition (u: 0..1 -> 0..1). Cubic ease-out:
	// fast at the start, settling gently into P4. Use Math.pow(..., 2) for a softer curve,
	// or 4/5 for a stronger one.
	const ease = u => 1 - Math.pow(1 - u, 5);
 
	// One value per pose P1, P2, P3, P4.
	//   opacity : 0..1
	//   blur    : 0..1 (multiplied by MAX_BLUR_PX)
	//   other   : how much of the *other* layer's size is mixed in (0 = own size, 1 = other's size)
	//             e.g. text1 @ P2 = (text2 + own * 3) / 4  ->  other = 0.25
	const TRACKS = {
		text1: { opacity: [1, 0.5, 0, 0], blur: [0, 1, 1, 1], other: [0, 0.25, 0.75, 0] },
		text2: { opacity: [0, 0, 0.5, 1], blur: [1, 1, 1, 0], other: [0, 0.75, 0.25, 0] }
	};
 
	// -------------------- Setup --------------------
 
	const root = document.getElementById('rotator');
	if (!root) return;
 
	const texts = Array.from(root.children, el => el.textContent.trim()).filter(Boolean);
	if (texts.length < 2) return;
 
	const layers = [0, 1].map(() => {
		const p = document.createElement('p');
		p.className = 'rot-text';
		return p;
	});
 
	const measurer = document.createElement('p');
	measurer.className = 'rot-measure';
	measurer.setAttribute('aria-hidden', 'true');
 
	root.replaceChildren(...layers, measurer);
	root.classList.add('rotator-active');
 
	// -------------------- Helpers --------------------
 
	// Linear interpolation inside a 4-point track, t in [0, 3]
	function sample(track, t) {
		const i = Math.min(Math.floor(t), track.length - 2);
		return track[i] + (track[i + 1] - track[i]) * (t - i);
	}
 
	let sizes = [];
 
	// Natural size of every text (and a fixed stage height so the page never jumps)
	function measure() {
		sizes = texts.map(txt => {
			measurer.textContent = txt;
			const r = measurer.getBoundingClientRect();
			return { w: r.width || 1, h: r.height || 1 };
		});
		root.style.height = Math.max(...sizes.map(s => s.h)) + 'px';
	}
 
	function pose(el, tracks, t, own, other) {
		const k = sample(tracks.other, t);
		const w = own.w + (other.w - own.w) * k;
		const h = own.h + (other.h - own.h) * k;
		const b = sample(tracks.blur, t);
		const blur = b * MAX_BLUR_PX;
		const heightFactor = 1 - (1 - BLUR_HEIGHT_MIN) * Math.pow(b, BLUR_HEIGHT_CURVE);
 
		el.style.opacity = sample(tracks.opacity, t);
		// filter on the element itself: only the text is blurred, never the background
		el.style.filter = blur > 0.05 ? `blur(${blur}px)` : 'none';
		el.style.transform = `scale(${w / own.w}, ${(h / own.h) * heightFactor})`;
	}
 
	// -------------------- State --------------------
 
	let front = 0;          // index of the layer that currently plays "text1"
	const idx = [0, 1];     // which text each layer holds
	let currentT = 0;
 
	function load(layer, textIdx) {
		idx[layer] = textIdx;
		layers[layer].textContent = texts[textIdx];
	}
 
	function syncAria() {
		layers[front].removeAttribute('aria-hidden');
		layers[1 - front].setAttribute('aria-hidden', 'true');
	}
 
	function render(t) {
		currentT = t;
		const back = 1 - front;
		const sf = sizes[idx[front]];
		const sb = sizes[idx[back]];
		pose(layers[front], TRACKS.text1, t, sf, sb);
		pose(layers[back], TRACKS.text2, t, sb, sf);
	}
 
	load(0, 0);
	load(1, 1);
	syncAria();
	measure();
	render(0);
 
	// -------------------- Animation loop --------------------
 
	const TOTAL_MS = SEGMENT_MS * 3;
	let phase = 'hold';
	let clock = 0;
	let last = performance.now();
 
	// Is the rotator on screen? (IntersectionObserver is the right tool for this, not MutationObserver)
	let visible = false;
 
	new IntersectionObserver(entries => {
		visible = entries[entries.length - 1].isIntersecting;
	}, { threshold: VISIBLE_AT }).observe(root);
 
	function tick(now) {
		// clamp so a backgrounded tab doesn't skip straight through a transition
		clock += Math.min(now - last, 100);
		last = now;
 
		// Off-screen while waiting: pause and reset the countdown to 0, so on return
		// the text gets a full HOLD_MS again instead of switching right away.
		// (A transition that already started is allowed to finish.)
		if (phase === 'hold' && !visible) clock = 0;
 
		if (phase === 'hold' && clock >= HOLD_MS) {
			phase = 'move';
			clock -= HOLD_MS;
		}
 
		if (phase === 'move') {
			if (clock >= TOTAL_MS) {
				// Transition done: swap roles, give the faded-out layer the next text
				const old = front;
				front = 1 - front;
				load(old, (idx[front] + 1) % texts.length);
				syncAria();
				phase = 'hold';
				clock = 0;
				render(0);
			} else {
				// eased progress over the whole transition, mapped back onto P1..P4 (t = 0..3)
				render(ease(clock / TOTAL_MS) * 3);
			}
		}
 
		requestAnimationFrame(tick);
	}
 
	requestAnimationFrame(tick);
 
	// -------------------- Re-measure on resize / font load --------------------
 
	let lastWidth = root.clientWidth;
 
	new ResizeObserver(() => {
		const w = root.clientWidth;
		if (w === lastWidth) return;
		lastWidth = w;
		measure();
		render(currentT);
	}).observe(root);
 
	if (document.fonts && document.fonts.ready) {
		document.fonts.ready.then(() => {
			measure();
			render(currentT);
		});
	}
})();