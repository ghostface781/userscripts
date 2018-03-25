// ==UserScript==
// @name        e621: Image Page Adjustments
// @namespace   6930e44863619d3f19806f68f74dbf62
// @match       *://e621.net/post/show/*
// @version     2018-03-25
// @downloadURL https://github.com/bipface/userscripts/raw/master/e621-page-adjustments.user.js
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

	/* not compatible with 'Show reduced samples' mode */
	if (img.dataset.resize_mode === `2`) {return;};

	/* get original dimensions: */
	let {orig_width : imgW, orig_height : imgH} = img.dataset;
	if (!imgW || !imgH) {
		let el = [...selMany(`#stats li`)].find(el =>
			el.textContent.includes(`Size:`));
		let match = /Size: (\d+)x(\d+)/.exec(el.textContent);
		[imgW, imgH] =
			match ? [match[1], match[2]] : [0, 0];
	};

	const imgOnClick = () => {
		let isFullSize = img.classList.contains(`full-size`);
		if (isFullSize) {
			img.classList.remove(`full-size`);
			noteBox.style.visibility = `hidden`;
		} else {
			img.classList.add(`full-size`);
			noteBox.style.visibility = ``;
		};
	};
	img.addEventListener(`click`, imgOnClick);

	img.classList.add(`main-image`);
	img.removeAttribute(`onclick`); /* remove Note.toggle() */

	img.parentElement.style.textAlign = `center`;

	noteBox.style.visibility = `hidden`;

	/* neutralise e621's own dynamic-resize code: */
	if (typeof Post !== `undefined`) {
		Post.fit_to_window = () => {};
		Post.toggle_size = imgOnClick;
	};

	/* used by notes: */
	if (typeof jQuery !== `undefined`) {
		jQuery(img).data(`width`, imgW);
		jQuery(img).data(`height`, imgH);
	};

	if (typeof Note !== `undefined`) {
		Note.all.invoke(`adjustScale`);
	};

	/* scrollIntoView() only if necessary: */

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

		let [scaledW, scaledH] = [imgW, imgH];

		if (scaledW > innerWidth) {
			let r = innerWidth / scaledW;
			scaledW *= r;
			scaledH *= r;};

		if (scaledH > innerHeight) {
			let r = innerHeight / scaledH;
			scaledW *= r;
			scaledH *= r;};

		x.style.width = `${scaledW}px`;
		x.style.height = `${scaledH}px`;

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
	`.main-image:not(.full-size), video.main-image, embed.main-image {
		max-width : 100vw !important;
		max-height : 100vh !important;
	}`,

	/*`.main-image.full-size {

	}`,*/

	`img.main-image {
		/* neutralise e621's own dynamic-resize code: */
		width : unset !important;
		height : unset !important;
	}`,
];

/* -------------------------------------------------------------------------- */

entrypoint();

/* -------------------------------------------------------------------------- */

/*






































*/

/* -------------------------------------------------------------------------- */