// ==UserScript==
// @name        e621: Image Page Adjustments
// @namespace   6930e44863619d3f19806f68f74dbf62
// @match       *://e621.net/post/show/*
// @version     2018-02-17
// @grant       none
// @run-at      document-start
// ==/UserScript==

'use strict';

/* -------------------------------------------------------------------------- */

const sel = x => document.querySelector(x);
const selMany = x => document.querySelectorAll(x);

const entrypoint = () => {
	document.addEventListener(`readystatechange`, onDocRdyStCh);
	onDocRdyStCh();
};

const onDocRdyStCh = () => {
	if (document.readyState === `loading`) {return;};
	document.removeEventListener(`readystatechange`, onDocRdyStCh);

	insertStyleRules(styleRules());

	let img = sel(`#image`)
		|| sel(`#webm-container`)
		|| sel(`.content embed[type='application/x-shockwave-flash']`);
	let noteBox = sel(`#note-container`) || document.createElement(`div`);

	if (!img) {return;};

	img.addEventListener(`click`, ev => {
		let isFullSize = img.classList.contains(`full-size`);
		if (isFullSize) {
			img.classList.remove(`full-size`);
			noteBox.style.visibility = `hidden`;
		} else {
			img.classList.add(`full-size`);
			noteBox.style.visibility = ``;
		};
	});

	img.classList.add(`main-image`);
	img.removeAttribute(`onclick`); /* remove Note.toggle() */
	noteBox.style.visibility = `hidden`;

	/* scrollIntoView() only if necessary */

	const scroll = el => {
		let rect = el.getBoundingClientRect();
		if (rect.left < 0
			|| rect.right > innerWidth
			|| rect.top < 0
			|| rect.bottom > innerHeight)
		{
			el.scrollIntoView({
				behavior : `instant`,});
		};
	};

	if (img.complete || img.readyState > 0 || img.tagName === `EMBED`) {
		scroll(img);

	} else {
		/* image not loaded; overlay invisible div with the final scaled w/h of
		the image and scroll to it instead */

		let x = document.createElement(`div`);
		x.style.visibility = `hidden`;
		x.style.position = `absolute`;
		x.style.top = `0`;
		x.style.left = `0`;

		let {width : imgW, height : imgH} = img.dataset;

		if (!imgW || !imgH) {
			let el = [...selMany(`#stats li`)].find(el =>
				el.textContent.includes(`Size:`));
			let match = /Size: (\d+)x(\d+)/.exec(el.textContent);
			[imgW, imgH] =
				match ? [match[1], match[2]] : [0, 0];
		};

		if (imgW > innerWidth) {
			let r = innerWidth / imgW;
			imgW *= r;
			imgH *= r;};

		if (imgH > innerHeight) {
			let r = innerHeight / imgH;
			imgW *= r;
			imgH *= r;};

		x.style.width = `${imgW}px`;
		x.style.height = `${imgH}px`;

		img.parentElement.style.position = `relative`;
		img.parentElement.prepend(x);

		const onLoad = ev => {
			img.removeEventListener(ev.type, onLoad);
			x.remove();};
		img.addEventListener(`load`, onLoad);
		img.addEventListener(`loadedmetadata`, onLoad);

		scroll(x);
	};
};

const insertStyleRules = (rules) => {
	let style = document.createElement(`style`);
	document.head.appendChild(style);
	for (let rule of rules) {
		style.sheet.insertRule(rule, style.sheet.cssRules.length);};
};

const enforce = (cond, msg = `enforcement failed`) => {
	if (!cond) {
		let x = new Error();
		throw new Error(`${msg} | ${x.stack}`);};
	return cond;
};

/* -------------------------------------------------------------------------- */

const styleRules = () => [
	`.main-image:not(.full-size), video.main-image {
		max-width : 100vw;
		max-height : 100vh;}`,

	/*`.main-image.full-size {

	}`,*/
];

/* -------------------------------------------------------------------------- */

entrypoint();

/* -------------------------------------------------------------------------- */

/*






































*/

/* -------------------------------------------------------------------------- */