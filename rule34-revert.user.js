// ==UserScript==
// @name        Rule34.xxx: Revert
// @namespace   6930e44863619d3f19806f68f74dbf62
// @version     2018-09-09
// @match       *://*.rule34.xxx/*
// @downloadURL https://github.com/bipface/userscripts/raw/master/rule34-revert.user.js
// @run-at      document-end
// @grant       none
// ==/UserScript==

'use strict';

/* currently only rating and tags can be reverted.
all other fields are preserved */

/* -------------------------------------------------------------------------- */

let ImgId;

const entrypoint = () => {
	if (![`/`, `/index.php`].includes(location.pathname)) {return;};

	let Q = new URLSearchParams(location.search);
	if (!(Q.get(`page`) === `history` && Q.get(`type`) === `tag_history`)) {
		return;};

	ImgId = parseInt(Q.get(`id`));
	if (!Number.isSafeInteger(ImgId)) {return;};

	let TblEl = document.querySelector(`table#history`);
	if (!TblEl) {return;};

	insertStyleRules(styleRules());

	/* replace all revert links with fancy new buttons */

	let Btn = document.createElement(`button`);
	Btn.type = `button`;
	Btn.innerHTML =
		`<span>Revert to this version</span>`+
		`<figure class='revert-status-none'></figure>`;

	for (let El of xpath(`.//a[text()='Revert']`, TblEl)) {
		let X = Btn.cloneNode(true);
		X.addEventListener(`click`, on_click);
		El.replaceWith(X);};
};

const on_click = function(Ev) {
	let Btn = Ev.currentTarget;
	let Row = Btn.parentElement.parentElement;
	enforce(Row.tagName === `TR`);

	let set_status = (cssClass) => {
		let Img = Btn.querySelector(`figure`);
		Img.className = cssClass;
	};

	set_status(`revert-status-spinner`);
	revert_to(Row).then(
		() => {
			set_status(`revert-status-tick`);
			//document.reload(true);
		},
		X => {
			set_status(`revert-status-warn`);
			let Msg = `Revert failed\n\n${X}`;
			console.error(Msg);
			alert(Msg);
		});
};

const revert_to = (Row) => new Promise((res, rej) => {
	let Rating = Row.querySelector(
		`:scope > td:nth-of-type(5)`).textContent;
	enforce([`e`, `q`, `s`].includes(Rating));

	let TagsCell = enforce(
		Row.querySelector(`:scope > td:nth-of-type(6)`));

	let Tags = [...xpath(
		`./span[@class='unchanged-tags' or `+
			`@class='added-tags']/span/a/text()`,
		TagsCell)]
		.map(X => X.nodeValue);

	enforce(Tags.length);
	for (let X of Tags) {
		enforce(/^[^\s]+$/.test(X));};

	fetch_metadata_for(ImgId).then(Tbl => {
		enforce(Tbl.Id === ImgId);

		let X = new URLSearchParams(``);
		X.set(`id`, ImgId);
		X.set(`submit`, `Save changes`);
		X.set(`pconf`, `1`);
		X.set(`lupdated`, Tbl.Lupdated);
		X.set(`rating`, Rating);
		X.set(`title`, Tbl.Title);
		X.set(`parent`, Tbl.ParentId || ``);
		X.set(`next_post`, Tbl.NextId || ``);
		X.set(`previous_post`, Tbl.PrevId || ``);
		X.set(`source`, Tbl.Source);
		X.set(`tags`, Tags.join(` `));

		return http_request({
			Addr : `${location.origin}/public/edit_post.php`,
			Method : `post`,
			Mime : `application/x-www-form-urlencoded`,
			Body : X,});

	}).then(Resp => {
		enforce(Resp.ok || Resp.type === `opaqueredirect`);
		/* check that the revert actually worked - edit_post.php seems to
		unconditionally respond with 302 */
		return fetch_metadata_for(ImgId);
	}).then(Tbl => {
		enforce(
			sets_equal(
				Tbl.TagSet,
				new Set(Tags)),
			`tags verification failed`);
		res();
	}).catch(rej);
});

const fetch_metadata_for = (Id) =>
	new Promise((resolve, reject) =>
		http_request({
			Addr : `${location.origin}/index.php?page=post&s=view&id=${Id}`,
			Method : `get`,})
		.then(Resp => Resp.blob())
		.then(B => blob_to_doc(B))
		.then(Doc =>
			resolve(
				parse_edit_form(enforce(
					Doc.getElementById(`edit_form`))))));

const parse_edit_form = (Form) => ({
	Id : parseInt(Form.querySelector(`input[name="id"]`).value),
	NextId : parseInt(Form.querySelector(`#next_post`).value),
	PrevId : parseInt(Form.querySelector(`#previous_post`).value),
	ParentId : parseInt(Form.querySelector(`input[name="parent"]`).value),
	Title : Form.querySelector(`#title`).value,
	Rating : Form.querySelector(`input[name="rating"]:checked`).value,
	Source : Form.querySelector(`#source`).value,
	TagSet : new Set(Form.querySelector(`#tags`).value.match(/[^\s]+/g)),
	Pconf : Form.querySelector(`#pconf`).value,
	Lupdated : Form.querySelector(`#lupdated`).value,});

const http_request = ({Addr, Method, Mime, Body,}) =>
	new Promise((resolve, reject) =>
		fetch(Addr, {
			method : Method.toUpperCase(),
			headers : new Headers({'Content-Type' : Mime,}),
			body : Body,
			mode : `same-origin`,
			credentials : `same-origin`, /* enable cookies */
			cache : `no-cache`,
			redirect : `manual`,
			referrerPolicy : `no-referrer`,})

		.then(Resp => {
			enforce([`basic`, `opaqueredirect`].includes(Resp.type));
			console.log(
				`${Method} request completed with status ${Resp.status} `+
				`("${Addr}")`);

			resolve(Resp);})

		.catch(Xcep => {
			console.error(Xcep);
			reject(Xcep);}));

const blob_to_doc = (B) =>
	new Promise((resolve, reject) => {
		let X = new XMLHttpRequest();
		X.addEventListener(`loadend`, () => {
			if (X.readyState !== 4 || X.status !== 200) {
				return reject();};
			resolve(X.response);
		});

		X.open(`GET`, URL.createObjectURL(B), true);
		X.responseType = `document`;
		X.send();
	});

const xpath = function*(Xpr, Ctx = document) {
	let Xs = document.evaluate(
		Xpr, Ctx, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
	for (let I = 0; I < Xs.snapshotLength; ++I) {
		yield Xs.snapshotItem(I);};
};

const enforce = (Cond, Msg = `enforcement failed`) => {
	if (!Cond) {
		let X = new Error();
		throw new Error(`${Msg} | ${X.stack}`);
	};
	return Cond;
};

const sets_equal = (S1, S2) => {
	if (S1.size !== S2.size) {return false;};
	for (let X of S1) if (!S2.has(X)) {return false;};
	return true;
};

const insertStyleRules = (rules) => {
	let style = document.createElement(`style`);
	document.head.appendChild(style);
	for (let rule of rules) {
		style.sheet.insertRule(rule, style.sheet.cssRules.length);};
};

const styleRules = () => [
	`figure[class^='revert-status-'] {
		margin : 0 !important;
		padding : 0 1ch !important;
	}`,

	`.revert-status-none {
		display : none !important;
	}`,

	`.revert-status-tick {
		display : initial !important;
		background-image : url(${imgTbl.tick}) !important;
	}`,

	`.revert-status-warn {
		display : initial !important;
		background-image : url(${imgTbl.warn}) !important;
	}`,

	`.revert-status-spinner {
		display : initial !important;
		background-image : url(${imgTbl.spinner}) !important;
	}`,
];

const imgTbl = {
	tick : `data:image/png;base64,
		iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9i
		ZSBJbWFnZVJlYWR5ccllPAAAAnZJREFUeNqkk01PE0EYx/+zu/TNanTbGCjWhrCmlp6MGl94
		kUQ9eOCC8chHMDG9mHjiE/QjePGOJsR4QQ8Q0UOJHqgVA6kiKQXa0th97+4OM1tq25MHJ/lv
		dmae3z/PzDMPoZTif4bEP+RVHBAJE5+QBAjm2d9dpsuncbtM66BYAqUVuGzmUtCFWsegb8yF
		pEAuPZpWUvGkHA1GQzw/zVSv/aztTm9Vfjy22laeLS0PZNCFzwXPLs5mZzISpLBjO1BttbsX
		GZfHIkn5Umy1uLbYMvx130TwtykSQSGQm746mbE0K6yqKkzTHFC1WoXe1MK3lVuZABnKcaZn
		4NL5K8PjiqmaYV3XYRjGgOr1OtZn3mJh5Akcox1OxZIKZ3oGDp2MR+Nyq9VCs9mEZVloqS0c
		HB6gXC7jdfol9vb28GhoFpvFTXiGJ3OmdwcOTQoQQpqmYePhCpQ3N6HbOii76Y17K36IKIqY
		eDfpV8q0zRBn+jOA67p4rjzFzs4Ovtz/ACp2YEmSfGXfTwFRFhtm4ZLjMz2DNv1d047MZ6UX
		/vT4+Bgbd/rgVQZf4LXoyCaWyZn+DD5Wj/Yboixi6vvcX9CHPzH4Yg/mMv/oDc70Gyw1d+vb
		AohBRgmubz7owAUGjw7CnucaVlXf5kzPwKMVV3Py9c/7Jep4BkkRZL8yONU5c1ee7RhqoVHy
		dC/PGb8NeDMRwvogxa73hjAnjIm5QOaMEkhHZPG8FPKfSdMx7S29YZe0ba/s5lHwlvHLhc+e
		GvByxpjiSJBhTJBpdu4sK9lI56FhH4co4htdQ4UespUjphpjna6B0HdS6R8dzHtRY9IZ650I
		MACI9kBqNfbjbgAAAABJRU5ErkJggg==
	`.replace(/\s/g, ''),

	warn : `data:image/png;base64,
		iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9i
		ZSBJbWFnZVJlYWR5ccllPAAAAjBJREFUeNqkk0trE1EUx8/cO49OfGTSRNJMYsA0aVonoYh1
		3YW71uJCKFQhKqibfgFLwYULsR/AhY+VG1d+C124kJiFIGipmoIZNUXtZDKTycz1njGpaRNU
		8MJv7txzzv/c5xEYY/A/TRQEAW5c5KwM+aKcR73/a5zvg84HT371wv07Apwuj0x+PZW/vArA
		4NO7x/f4+OGoIHLKAAiC/fBdHadSbCGZPTeTzC7OUElbQNvBOISMMnIqeqFSYs57mTkfZD1/
		qYS2f0rAZ5pVDmXnY/FSbn3jM6xvfAEtfjKnRDLz6BtK4PPPADi+ms6vGK71lti2DUintUVS
		J84b6OvF7GlI4PNMPVgAZ49oxpyqRnXf+wGWZYX4ngWRiKYfPpqfw5hBjej7eweqCkSo6JOL
		hmd/hI7vQLVaBdM0YXt1FgK2CeJ40fCbmxUWsGc8vh3egtcFQPhyLsQnzpQJcbVmuw5mawtq
		tRo0Gg3wJQeY7ALIrqZEM2WM7esIPkROAgR5OZEpTTV3X4IXNEGiLnw1b4fItBNCBQuiqeQU
		A7qMGtSSLt8C38aVRLo47QVvVJFYoFAnJJG8FdIfI6rSVWMTx6ZRg1rS7UKeSspSMj2Wk+Ab
		jPGZ+vTboA1JZbQcEcUl1Iq2zdZyxURBpruUMTzR38Vl79wM+9bO0/3vlwLVs+OF16/MNdFu
		g/vi+Xadm+vDL/3uHyuR16Er4E3gKvEaOTLa/1LBuEQPF8hxfgowAINnMqTBUH7hAAAAAElF
		TkSuQmCC
	`.replace(/\s/g, ''),

	spinner : /* animated png */ `data:image/png;base64,
		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
	`.replace(/\s/g, ''),
};

/* -------------------------------------------------------------------------- */

entrypoint();

/* -------------------------------------------------------------------------- */

/*








































*/

/* -------------------------------------------------------------------------- */