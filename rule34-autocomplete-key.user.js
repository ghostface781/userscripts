// ==UserScript==
// @name        Rule34.xxx: Autocomplete Key
// @namespace   6930e44863619d3f19806f68f74dbf62
// @version     2017-08-07
// @match       *://*.rule34.xxx/*
// @run-at      document-start
// @grant       none
// ==/UserScript==

'use strict';
(() => {

/* -------------------------------------------------------------------------- */

const f = () => {
	if (typeof Awesomplete !== `function`) {return;};

	/* enable the Tab key for autocompletion */
	for (let A of Awesomplete.all) {
		A.input.addEventListener(`keydown`, Ev => {
			if (Ev.key === `Tab`
				&& A.opened
				&& A.selected
			) {
				Ev.preventDefault();
				A.select();};});
	};

	/* refer to
	http://developer.mozilla.org/docs/Web/API/KeyboardEvent/key/Key_Values
	for .key values */
};

window.addEventListener(`load`, () => setTimeout(f, 0));

/* -------------------------------------------------------------------------- */

})();

/* -------------------------------------------------------------------------- */
