// ==UserScript==
// @name        Danbooru: Image Resizer
// @namespace   6930e44863619d3f19806f68f74dbf62
// @version     2017-10-22
// @match       *://*.donmai.us/*
// @grant       none
// @run-at      document-end
// ==/UserScript==

'use strict';

/* -------------------------------------------------------------------------- */

const entrypoint = () => {
	/* only images are supported at the moment */
	if (!Danbooru || !Danbooru.Post || !img()) {return;};

	insert_style_rules(style_rules());

	Danbooru.Post.resize_image_to_window = () => {
		img().classList.toggle(`constrained`);
		Danbooru.Note.Box.scale_all();
	};

	img().classList.add(`constrained`);

	img().addEventListener(`click`, ev => {
		Danbooru.Post.resize_image_to_window();
	});

	document.querySelector(`#page`).scrollIntoView();

	Danbooru.Note.Box.scale_all();
	document.addEventListener(`readystatechange`, ev => {
		Danbooru.Note.Box.scale_all();
	});
};

const img = () => document.querySelector(`img#image`);

const insert_style_rules = (rules) => {
	let style = document.createElement(`style`);
	document.head.appendChild(style);
	for (let rule of rules) {
		style.sheet.insertRule(rule, style.sheet.cssRules.length);};
};

const style_rules = () => [
	`img#image {
		width : auto !important;
		height : auto !important;
		max-width : unset !important;
		max-height : unset !important;
	}`,
	`img#image.constrained {
		max-width : 100vw !important;
		max-height : 100vh !important;
	}`,

	`div#c-posts div#a-show section {
		margin-top : 0 !important;
	}`,

	`#note-container {
		/* always show notes */
		visibility : visible !important;
	}`,

	`img#image ~ .resize-sensor {
		/* element from DanbooruEX; causes conflict */
		display : none !important;
	}`,
];

/* -------------------------------------------------------------------------- */

entrypoint();

/* -------------------------------------------------------------------------- */

/*















































*/

/* -------------------------------------------------------------------------- */