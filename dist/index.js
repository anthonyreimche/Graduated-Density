//#region src/cursor.ts
var e = "<path d=\"M9 18A9 9 0 0 1 18 9\"/><path d=\"M6 15L9 18L12 15\"/><path d=\"M15 6L18 9L15 12\"/>", t = "graduated-density.rotate", n = {
	id: t,
	image: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="#fff" stroke-width="3">${e}</g><g stroke="#111" stroke-width="1.4">${e}</g></g></svg>`,
	hotspotX: 12,
	hotspotY: 12,
	fallback: "grab"
}, r = {
	on: !1,
	density: 1,
	hardness: 0,
	rotation: 0,
	offset: 50,
	hue: 0,
	saturation: 0
}, i = {
	density: {
		min: -8,
		max: 8,
		step: .01
	},
	hardness: {
		min: 0,
		max: 100,
		step: 1
	},
	rotation: {
		min: -180,
		max: 180,
		step: .1
	},
	offset: {
		min: -25,
		max: 125,
		step: .1
	},
	hue: {
		min: 0,
		max: 360,
		step: .1
	},
	saturation: {
		min: 0,
		max: 100,
		step: .1
	}
}, a = (e, t) => Math.min(Math.max(t, i[e].min), i[e].max), o = (e) => Math.round(e * 100) / 100;
function s(e) {
	return {
		density: e.density,
		hardness: e.hardness,
		rotation: -e.rotation,
		offset: e.offset,
		hue: e.hue / 360,
		saturation: e.saturation / 100
	};
}
function c(e) {
	return {
		density: e.density,
		hardness: e.hardness,
		rotation: e.rotation === 0 ? 0 : -e.rotation,
		offset: e.offset,
		hue: e.hue * 360,
		saturation: e.saturation * 100
	};
}
function l(e, t, n) {
	return n < 1 ? e + (t - e) * n : n < 3 ? t : n < 4 ? e + (t - e) * (4 - n) : e;
}
function u(e, t, n) {
	if (t === 0) return [
		n,
		n,
		n
	];
	let r = n < .5 ? n * (1 + t) : n + t - n * t, i = 2 * n - r, a = e * 6;
	return [
		l(i, r, a < 4 ? a + 2 : a - 4),
		l(i, r, a),
		l(i, r, a > 2 ? a - 2 : a + 4)
	];
}
function d(e, t) {
	return u(e / 360, t / 100, .5);
}
function f(e, t) {
	let [n, r, i] = e, a = Math.max(n, r, i), o = a - Math.min(n, r, i), s = Math.min(Math.max(o * 100, 0), 100);
	if (o === 0) return {
		hue: t,
		saturation: 0
	};
	let c = a === n ? ((r - i) / o + 6) % 6 : a === r ? (i - n) / o + 2 : (n - r) / o + 4;
	return {
		hue: Math.min(Math.max(c * 60, 0), 360),
		saturation: s
	};
}
var p = [
	.627403895934699,
	.329283038377884,
	.043313065687417,
	.069097289358232,
	.919540395075459,
	.011362315566309,
	.01639143887515,
	.088013307877226,
	.895595253247624
];
function m(e) {
	let [t, n, r, i, a, o, s, c, l] = e, u = a * l - o * c, d = -(i * l - o * s), f = i * c - a * s, p = t * u + n * d + r * f;
	return [
		u / p,
		-(n * l - r * c) / p,
		(n * o - r * a) / p,
		d / p,
		(t * l - r * s) / p,
		-(t * o - r * i) / p,
		f / p,
		-(t * c - n * s) / p,
		(t * a - n * i) / p
	];
}
var h = m(p);
function g(e, t, n) {
	let r = c({
		density: 1,
		hardness: 0,
		rotation: 0,
		offset: 50,
		hue: 0,
		saturation: 0,
		...n
	});
	return {
		id: e,
		label: t,
		params: {
			...r,
			hue: o(r.hue),
			saturation: o(r.saturation)
		}
	};
}
var _ = [
	g("nd2-soft", "Neutral grey ND2 (soft)", { density: 1 }),
	g("nd4-soft", "Neutral grey ND4 (soft)", { density: 2 }),
	g("nd8-soft", "Neutral grey ND8 (soft)", { density: 3 }),
	g("nd2-hard", "Neutral grey ND2 (hard)", {
		density: 1,
		hardness: 75
	}),
	g("nd4-hard", "Neutral grey ND4 (hard)", {
		density: 2,
		hardness: 75
	}),
	g("nd8-hard", "Neutral grey ND8 (hard)", {
		density: 3,
		hardness: 75
	}),
	g("orange-nd2", "Orange ND2 (soft)", {
		density: 1,
		hue: .102439,
		saturation: .8
	}),
	g("yellow-nd2", "Yellow ND2 (soft)", {
		density: 1,
		hue: .15122,
		saturation: .5
	}),
	g("purple-nd2", "Purple ND2 (soft)", {
		density: 1,
		hue: .82439,
		saturation: .5
	}),
	g("green-nd2", "Green ND2 (soft)", {
		density: 1,
		hue: .302439,
		saturation: .5
	}),
	g("red-nd2", "Red ND2 (soft)", {
		density: 1,
		hue: 0,
		saturation: .5
	}),
	g("blue-nd2", "Blue ND2 (soft)", {
		density: 1,
		hue: .663415,
		saturation: .5
	}),
	g("brown-nd4", "Brown ND4 (soft)", {
		density: 2,
		hue: .082927,
		saturation: .25
	})
], v = "graduated-density", y = `${v}.filter`, b = `${v}.local`, x = `${v}.panel`, S = `${v}.line`, C = [
	"on",
	"density",
	"hardness",
	"rotation",
	"offset",
	"hue",
	"saturation"
], w = [
	"density",
	"hardness",
	"rotation",
	"offset",
	"hue",
	"saturation"
], T = {
	on: "Enabled",
	density: "Density",
	hardness: "Hardness",
	rotation: "Rotation",
	offset: "Offset",
	hue: "Hue",
	saturation: "Saturation"
}, E = (e, t) => `${e}.${t}`, D = (e) => C.map((t) => E(e, t)), O = (e) => typeof e == "number" && Number.isFinite(e);
function k(e, t) {
	let n = { ...r }, a = e[E(t, "on")];
	typeof a == "boolean" ? n.on = a : O(a) && (n.on = a >= .5);
	for (let r of w) {
		let a = e[E(t, r)];
		O(a) && (n[r] = Math.min(Math.max(a, i[r].min), i[r].max));
	}
	return n;
}
function A(e, t, n = C) {
	let r = {};
	for (let i of n) r[E(t, i)] = e[i];
	return r;
}
//#endregion
//#region src/rt.ts
var j, M;
function N(e) {
	M = e, j = e.react;
}
//#endregion
//#region src/store.ts
var P = null;
function F() {
	P = M.stores.create()((e) => ({
		panels: 0,
		editing: !1,
		scope: null,
		edit: (t) => e({ editing: t }),
		panelShown: (t) => e((e) => {
			let n = Math.max(0, e.panels + (t ? 1 : -1));
			return n === 0 ? {
				panels: n,
				editing: !1
			} : { panels: n };
		}),
		editScope: (t) => e({ scope: t }),
		leaveMask: (t) => e((e) => e.scope?.maskId === t ? { scope: null } : {})
	}));
}
function I() {
	if (!P) throw Error("Graduated Density's store is used before activate()");
	return P;
}
//#endregion
//#region src/edit.ts
var L = "Graduated Density", R = (e) => `${L}: ${e}`, z = {
	stage: y,
	read: () => k(M.stores.useDevelopStore.getState().paramBag, y),
	write: (e, t) => M.stores.useDevelopStore.getState().setDynParams(A(e, y, t)),
	commit: (e) => void M.stores.useDevelopStore.getState().commitEdit(R(e))
};
function B(e) {
	let t = e.maskId === null ? y : b;
	return {
		stage: t,
		read: () => k(e.getParams(), t),
		write: (n, r) => e.setParams(A(n, t, r)),
		commit: (t) => e.commit(R(t))
	};
}
function ee() {
	let e = I().getState().scope;
	return e ? B(e) : z;
}
//#endregion
//#region src/line.ts
var V = (e) => e * Math.PI / 180;
function H(e, t) {
	let n = V(-e), r = Math.sin(n);
	if (Math.abs(r) < 1e-9) return e === 0 ? [{
		x: .1,
		y: t / 100
	}, {
		x: .9,
		y: t / 100
	}] : [{
		x: .9,
		y: 1 - t / 100
	}, {
		x: .1,
		y: 1 - t / 100
	}];
	if (Math.abs(r) === 1) return e === 90 ? [{
		x: t / 100,
		y: .9
	}, {
		x: t / 100,
		y: .1
	}] : [{
		x: 1 - t / 100,
		y: .1
	}, {
		x: 1 - t / 100,
		y: .9
	}];
	let i = Math.cos(n), a = (r - i + 1 - t / 50) * .5 / r, o = (r + i + 1 - t / 50) * .5 / r, s = 0, c = 1, l = 1 / (o - a), u = -a * l;
	o > 1 && (c = l + u, o = 1), o < 0 && (c = u, o = 0), a > 1 && (s = l + u, a = 1), a < 0 && (s = u, a = 0), o -= (o - a) * .1, a += (o - a) * .1, c -= (c - s) * .1, s += (c - s) * .1;
	let d = {
		x: a,
		y: s
	}, f = {
		x: o,
		y: c
	};
	return e < 90 && e > -90 ? a < o ? [d, f] : [f, d] : o < a ? [d, f] : [f, d];
}
var te = 1e-4;
function ne(e, t) {
	let n = t.x - e.x;
	return n > te || n < -1e-4 ? Math.atan2(t.y - e.y, n) : t.y - e.y <= 0 ? -Math.PI / 2 : Math.PI / 2;
}
function U(e, t) {
	let n = V(-e), r = Math.sin(n), i = Math.cos(n);
	return (-2 * r * t.x + r - i + 1 + 2 * i * t.y) * 50;
}
function W(e, t) {
	let n = -ne(e, t) / Math.PI * 180;
	return {
		rotation: n,
		offset: U(n, e)
	};
}
//#endregion
//#region src/screen.ts
function re(e, t, n) {
	let r = t.x - e.x, i = t.y - e.y;
	if (r === 0 && i === 0) return null;
	let a = -Infinity, o = Infinity, s = (e, t) => {
		if (e === 0) return t >= 0;
		let n = t / e;
		return e < 0 ? a = Math.max(a, n) : o = Math.min(o, n), !0;
	};
	if (!(s(-r, e.x - n.x) && s(r, n.x + n.w - e.x) && s(-i, e.y - n.y) && s(i, n.y + n.h - e.y)) || !(o > a)) return null;
	let c = a + (o - a) * .1, l = o - (o - a) * .1;
	return [{
		x: e.x + r * c,
		y: e.y + i * c
	}, {
		x: e.x + r * l,
		y: e.y + i * l
	}];
}
var G = (e, t) => e.x >= t.x && e.x <= t.x + t.w && e.y >= t.y && e.y <= t.y + t.h;
function ie(e, t, n, r, i) {
	let a = Math.hypot(n.x - t.x, n.y - t.y) || 1, o = (n.x - t.x) / a * i, s = (n.y - t.y) / a * i, c = {
		x: e.x + r * o,
		y: e.y + r * s
	};
	return [
		e,
		c,
		{
			x: (e.x + c.x) / 2 - s,
			y: (e.y + c.y) / 2 + o
		}
	];
}
//#endregion
//#region src/Overlay.tsx
var ae = 9, oe = 10;
function K(e, t, n) {
	if (e.part === "line") {
		let r = {
			x: t.x - e.start.x,
			y: t.y - e.start.y
		}, i = {
			x: e.a.x + r.x,
			y: e.a.y + r.y
		}, s = {
			x: e.b.x + r.x,
			y: e.b.y + r.y
		};
		return {
			patch: {
				rotation: n.rotation,
				offset: o(a("offset", U(-n.rotation, i)))
			},
			a: i,
			b: s
		};
	}
	let r = e.part === "a" ? t : e.a, i = e.part === "b" ? t : e.b, s = W(r, i);
	return {
		patch: {
			rotation: o(a("rotation", s.rotation === 0 ? 0 : -s.rotation)),
			offset: o(a("offset", s.offset))
		},
		a: r,
		b: i
	};
}
function se(e, t, n, r) {
	let i = r(e.x, e.y), a = r(t.x, t.y);
	return G(i, n) && G(a, n) ? [i, a] : re(i, a, n);
}
var ce = (e, t, n) => {
	if (e.stage !== t) return !1;
	let r = W(e.a, e.b);
	return Math.abs((r.rotation + n.rotation + 540) % 360 - 180) <= .005 + 1e-9 && Math.abs(r.offset - n.offset) <= .005 + 1e-9;
};
function le() {
	let e = M.develop.useDevelopOverlay();
	M.stores.useDevelopStore((e) => e.paramBag), M.stores.useDevelopStore((e) => e.params.masks), I()((e) => e.scope);
	let n = M.stores.useDevelopStore((e) => e.photoId), r = I()((e) => e.panels), i = I()((e) => e.editing), a = j.useRef(null), o = j.useRef(null), c = j.useRef(null), [l, u] = j.useState(null), [d, f] = j.useState(null), p = ee(), m = p.read(), h = i && r > 0 && m.on, { rect: g, toScreen: _, toImage: v } = e, y = c.current && ce(c.current, p.stage, m) ? c.current : null, [b, x] = l ? [l.a, l.b] : y ? [y.a, y.b] : H(s(m).rotation, m.offset), S = h && n && g && _ && v ? se(b, x, g, _) : null, C = () => {
		let e = o.current;
		e && (o.current = null, e.last && (c.current = {
			stage: e.target.stage,
			a: e.last.a,
			b: e.last.b
		}), u(null), e.last && e.target.commit(e.part === "line" ? "move line" : "turn line"));
	};
	j.useEffect(() => {
		o.current = null, c.current = null, u(null);
	}, [n]);
	let w = S !== null;
	if (j.useEffect(() => {
		w || C();
	}, [w]), j.useEffect(() => () => C(), []), j.useEffect(() => h ? M.ui.onEscape(() => I().getState().edit(!1)) : void 0, [h]), !S || !v) return null;
	let [T, E] = S, D = (e) => {
		if (!a.current) return null;
		let t = M.develop.framePoint(a.current, e.clientX, e.clientY);
		return v(t.x, t.y);
	}, O = (e) => (t) => {
		if (t.button !== 0) return;
		let n = D(t);
		n && (t.preventDefault(), t.stopPropagation(), t.currentTarget.setPointerCapture(t.pointerId), o.current = {
			part: e,
			pointerId: t.pointerId,
			start: n,
			a: v(T.x, T.y),
			b: v(E.x, E.y),
			target: p,
			last: null
		});
	}, k = (e) => {
		let t = o.current;
		if (!t || t.pointerId !== e.pointerId || e.buttons === 0) return;
		let n = D(e);
		if (!n || !t.last && n.x === t.start.x && n.y === t.start.y) return;
		let r = t.target.read(), i = K(t, n, r);
		t.last = {
			a: i.a,
			b: i.b
		}, u(t.last), t.target.write({
			...r,
			...i.patch,
			on: !0
		}, [
			"rotation",
			"offset",
			"on"
		]);
	}, A = (e) => {
		let t = o.current;
		t && t.pointerId === e.pointerId && (e.currentTarget.hasPointerCapture(e.pointerId) && e.currentTarget.releasePointerCapture(e.pointerId), C());
	}, N = o.current?.part ?? null, P = (e) => N ? N === e : d === e, F = P("line"), L = (e) => ({
		onPointerDown: O(e),
		onPointerMove: k,
		onPointerUp: A,
		onPointerCancel: A,
		onLostPointerCapture: A,
		onPointerEnter: () => f(e),
		onPointerLeave: () => f((t) => t === e ? null : t)
	}), R = (e) => {
		let t = ie(e === "a" ? T : E, T, E, e === "a" ? 1 : -1, ae), n = P(e);
		return /* @__PURE__ */ j.createElement("polygon", {
			"data-gd-mark": e,
			points: t.map((e) => `${e.x},${e.y}`).join(" "),
			fill: `rgba(255,255,255,${n ? 1 : .5})`,
			stroke: `rgba(0,0,0,${n ? 1 : .5})`,
			strokeWidth: 1,
			pointerEvents: "none"
		});
	}, z = M.cursors.resolve(t);
	return /* @__PURE__ */ j.createElement("div", {
		ref: a,
		style: {
			position: "absolute",
			inset: 0,
			overflow: "hidden",
			pointerEvents: "none"
		}
	}, /* @__PURE__ */ j.createElement("svg", {
		width: "100%",
		height: "100%",
		style: {
			position: "absolute",
			inset: 0,
			overflow: "visible"
		}
	}, /* @__PURE__ */ j.createElement("line", {
		x1: T.x,
		y1: T.y,
		x2: E.x,
		y2: E.y,
		stroke: "rgba(0,0,0,0.8)",
		strokeWidth: F ? 5 : 3,
		strokeLinecap: "round",
		pointerEvents: "none"
	}), /* @__PURE__ */ j.createElement("line", {
		x1: T.x,
		y1: T.y,
		x2: E.x,
		y2: E.y,
		stroke: "rgba(255,255,255,0.8)",
		strokeWidth: F ? 2 : 1,
		strokeLinecap: "round",
		pointerEvents: "none"
	}), R("a"), R("b"), /* @__PURE__ */ j.createElement("line", {
		"data-gd-part": "line",
		x1: T.x,
		y1: T.y,
		x2: E.x,
		y2: E.y,
		stroke: "transparent",
		strokeWidth: 20,
		pointerEvents: "stroke",
		style: {
			cursor: M.cursors.resolve("crop-move"),
			touchAction: "none"
		},
		...L("line")
	}, /* @__PURE__ */ j.createElement("title", null, "Drag to move the filter's line")), ["a", "b"].map((e) => {
		let t = e === "a" ? T : E;
		return /* @__PURE__ */ j.createElement("circle", {
			key: e,
			"data-gd-part": e,
			cx: t.x,
			cy: t.y,
			r: oe,
			fill: "transparent",
			pointerEvents: "all",
			style: {
				cursor: z,
				touchAction: "none"
			},
			...L(e)
		}, /* @__PURE__ */ j.createElement("title", null, "Drag to turn the filter's line about its other end"));
	})));
}
//#endregion
//#region src/Panel.tsx
var q = {
	on: "Switch the filter on or off",
	density: "How many stops (EV) the filter darkens its side of the line by; below zero it brightens the other side instead",
	hardness: "How quickly the filter fades in across the line, in percent: 0 spreads it over the whole frame, 100 over about a tenth of it",
	rotation: "Turns the filter's line, in degrees. Drag an end of the line on the photo to turn it there",
	offset: "Where the line crosses the frame, in percent: 50 runs through the centre. Drag the line on the photo to move it",
	hue: "The colour of the filter's tint, in degrees",
	saturation: "How strong the tint is, in percent: 0 is a neutral grey filter"
}, ue = `linear-gradient(to right, ${[
	0,
	60,
	120,
	180,
	240,
	300,
	360
].map((e) => `hsl(${e}, 100%, 50%)`).join(", ")})`, de = (e) => `linear-gradient(to right, rgb(51, 51, 51), hsl(${e}, 100%, 50%))`, fe = "The colour of the filter's tint. Click for the picker, or the eyedropper to take the colour from the photo; Hue and Saturation below fine-tune it", pe = { paramBag: {
	[E(y, "on")]: !1,
	[E(b, "on")]: !1
} }, me = /* @__PURE__ */ new Set(["rotation", "offset"]);
function J() {
	let { Slider: e } = M.components, { Button: t, ColourField: n, Select: a, Stack: o, Toggle: s } = M.ui, c = M.develop.useParamScope(), l = B(c), u = l.read(), p = c.maskId, m = I()((e) => (e.scope?.maskId ?? null) === p), h = I()((e) => e.editing) && m;
	j.useEffect(() => (I().getState().panelShown(!0), () => I().getState().panelShown(!1)), []), j.useEffect(() => {
		if (p !== null) return I().getState().editScope(c), () => I().getState().leaveMask(p);
	}, [p]);
	let g = (e) => {
		m || I().getState().editScope(p === null ? null : c), e && I().getState().edit(!0);
	}, v = (e, t) => {
		let n = l.read();
		l.write({
			...n,
			[e]: Math.min(Math.max(t, i[e].min), i[e].max),
			on: !0
		}, [e, "on"]), g(!n.on || me.has(e));
	}, y = (e) => {
		let t = l.read(), n = Math.min(Math.max(e.hue, i.hue.min), i.hue.max), r = Math.min(Math.max(e.saturation ?? t.saturation, i.saturation.min), i.saturation.max);
		l.write({
			...t,
			hue: n,
			saturation: r,
			on: !0
		}, [
			"hue",
			"saturation",
			"on"
		]), g(!t.on);
	}, b = (t, n) => {
		let a = i[t];
		return /* @__PURE__ */ j.createElement("div", {
			key: t,
			title: q[t]
		}, /* @__PURE__ */ j.createElement(e, {
			label: T[t],
			value: u[t],
			min: a.min,
			max: a.max,
			step: a.step,
			defaultValue: r[t],
			trackBackground: n,
			onChange: (e) => v(t, e),
			onCommit: () => l.commit(T[t].toLowerCase())
		}));
	};
	return /* @__PURE__ */ j.createElement(o, {
		gap: 6,
		style: { padding: 8 }
	}, /* @__PURE__ */ j.createElement("div", { title: q.on }, /* @__PURE__ */ j.createElement(s, {
		checked: u.on,
		label: T.on,
		onChange: (e) => {
			l.write({
				...l.read(),
				on: e
			}, ["on"]), l.commit(e ? "on" : "off"), e && g(!0);
		}
	})), b("density"), b("hardness"), b("rotation"), b("offset"), /* @__PURE__ */ j.createElement(n, {
		label: "Tint",
		title: fe,
		hue: u.hue,
		saturation: u.saturation,
		toRgb: (e, t) => d(e, t),
		fromRgb: (e) => ({
			...f(e, l.read().hue),
			lightness: 50
		}),
		pick: pe,
		onChange: y,
		onCommit: () => l.commit("tint")
	}), b("hue", ue), b("saturation", de(u.hue)), /* @__PURE__ */ j.createElement(a, {
		value: "",
		placeholder: "Presets",
		ariaLabel: "Graduated Density presets",
		title: "Neutral and tinted filters of one, two and three stops, soft or hard. The line stays where it is",
		options: _.map((e) => ({
			value: e.id,
			label: e.label
		})),
		onChange: (e) => {
			let t = _.find((t) => t.id === e);
			if (!t) return;
			let n = l.read();
			l.write({
				...n,
				...t.params,
				rotation: n.rotation,
				offset: n.offset,
				on: !0
			}, [
				"on",
				"density",
				"hardness",
				"hue",
				"saturation"
			]), l.commit(t.label), g(!n.on);
		}
	}), /* @__PURE__ */ j.createElement(t, {
		size: "sm",
		full: !0,
		active: h,
		disabled: !u.on,
		title: h ? "Take the line off the photo (Esc)" : "Show the filter's line on the photo, to move and turn it",
		onClick: () => {
			if (h) return I().getState().edit(!1);
			g(!0);
		}
	}, h ? "Done" : "Edit Line"));
}
function he(e) {
	e.write({ ...r }, Object.keys(T)), e.commit("reset"), I().getState().edit(!1);
}
//#endregion
//#region src/glsl.ts
function Y(e) {
	return `mat3(${[
		0,
		1,
		2
	].flatMap((t) => [
		0,
		1,
		2
	].map((n) => e[n * 3 + t])).map((e) => e.toPrecision(17)).join(", ")})`;
}
var ge = `
float gdChannel(float m1, float m2, float h6) {
  if (h6 < 1.0) return m1 + (m2 - m1) * h6;
  if (h6 < 3.0) return m2;
  return h6 < 4.0 ? m1 + (m2 - m1) * (4.0 - h6) : m1;
}
vec3 gdTint(float h, float s) {
  if (s == 0.0) return vec3(0.5);
  float m2 = 0.5 + s - 0.5 * s;
  float m1 = 1.0 - m2;
  float h6 = h * 6.0;
  return vec3(
    gdChannel(m1, m2, h6 < 4.0 ? h6 + 2.0 : h6 - 4.0),
    gdChannel(m1, m2, h6),
    gdChannel(m1, m2, h6 > 2.0 ? h6 - 2.0 : h6 + 4.0));
}
vec3 gdFilter(vec3 rgb, vec2 uv, float aspect, float gdEv, float gdHard, float gdTurn, float gdShift, float gdHueDeg, float gdSatPct) {
  float a = radians(gdTurn);
  float fh = 1.0 / sqrt(1.0 + aspect * aspect) / (1.0 - (0.5 + gdHard / 100.0 * 0.9 / 2.0)) * 0.5;
  float len = (sin(a) * (2.0 * uv.x - 1.0) - cos(a) * (2.0 * uv.y - 1.0) - 1.0 + gdShift / 100.0 * 2.0) * fh;
  vec3 tint = gdTint(gdHueDeg / 360.0, gdSatPct / 100.0);
  if (gdEv < 0.0) tint = 1.0 - tint;
  float w = smoothstep(0.0, 1.0, 0.5 + len / 1.5);
  vec3 gain = gdEv > 0.0
    ? 1.0 / (tint + (1.0 - tint) * exp2(gdEv * w))
    : tint + (1.0 - tint) * exp2(-gdEv * (1.0 - w));
  if (gdSatPct == 0.0) return rgb * gain;
  const mat3 to2020 = ${Y(p)};
  const mat3 to709 = ${Y(h)};
  return to709 * (gain * (to2020 * rgb));
}
`, _e = "if (on) {\n  lin = gdFilter(lin, srcUv, uImageAspect, density, hardness, rotation, offset, hue, saturation);\n}";
//#endregion
//#region src/stage.ts
function ve() {
	return [{
		key: "on",
		glslType: "bool",
		default: r.on,
		label: T.on
	}, ...w.map((e) => ({
		key: e,
		glslType: "float",
		default: r[e],
		range: { ...i[e] },
		label: T[e]
	}))];
}
var X = (e) => ({
	id: e,
	glsl: _e,
	helpers: ge,
	uniforms: ve(),
	dormantWhen: { on: !1 },
	presetScope: "global"
});
function Z() {
	return {
		...X(y),
		name: "Graduated Density",
		phase: "scene-linear",
		anchor: "tone",
		priority: 5
	};
}
function ye() {
	return {
		...X(b),
		name: "Graduated Density in masks",
		phase: "scene-linear",
		priority: 5,
		mask: { maskable: !0 }
	};
}
function Q() {
	return [Z(), ye()];
}
//#endregion
//#region src/index.tsx
var $ = null;
function be(e) {
	N(e), F(), $ = e, e.registerCursor(n);
	for (let t of Q()) e.registerProcessingStage(t);
	e.registerPanel({
		id: x,
		title: "Graduated Density",
		component: J,
		defaultDock: {
			module: "develop",
			direction: "right",
			width: 268
		},
		modules: ["develop"],
		onReset: () => he(z),
		ownsBag: [`${y}.`],
		mask: {
			component: J,
			owns: D(b)
		}
	}), e.registerSlot({
		id: S,
		slot: "develop-canvas-overlay",
		component: le
	});
}
function xe() {
	let e = $;
	if (e) {
		$ = null;
		try {
			for (let t of Q()) e.unregisterProcessingStage(t.id);
		} catch (e) {
			console.warn("[graduated-density] deactivate failed:", e);
		}
	}
}
//#endregion
export { v as EXT_ID, x as PANEL_ID, be as activate, xe as deactivate };

//# sourceMappingURL=index.js.map