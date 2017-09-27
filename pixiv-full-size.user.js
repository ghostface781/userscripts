// ==UserScript==
// @name        Pixiv: Full-size
// @namespace   6930e44863619d3f19806f68f74dbf62
// @version     2017-07-15
// @match       *://*.pixiv.net/member_illust.php?*
// @downloadURL https://github.com/bipface/userscripts/raw/master/pixiv-full-size.user.js
// @run-at      document-end
// @grant       none
// ==/UserScript==

'use strict';
(() => {

/* -------------------------------------------------------------------------- */

const qs = (...Xs) => document.querySelector(...Xs);

let ImgEl = qs(`.works_display ._layout-thumbnail > img`);
if (!ImgEl) {return;};

let OrigImgEl = qs(`img.original-image`);
if (OrigImgEl && OrigImgEl.hasAttribute(`data-src`)) {

	ImgEl.src = OrigImgEl.getAttribute(`data-src`);
	ImgEl.style.maxWidth = `100vw`;
	ImgEl.style.maxHeight = `100vh`;

	qs(`#wrapper`).style.width = `unset`;
	qs(`#wrapper > .layout-a > .layout-column-2`).style.width = `unset`;
	qs(`#wrapper > .layout-a > .layout-column-2`).style.float = `unset`;
	qs(`.works_display`).style.width = `unset`;

	ImgEl.scrollIntoView();

	return;
};

/* currently does nothing for manga or ugoira */

/* -------------------------------------------------------------------------- */

})();

/* -------------------------------------------------------------------------- */

/*






































*/

/* -------------------------------------------------------------------------- */