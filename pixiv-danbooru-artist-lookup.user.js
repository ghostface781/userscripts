// ==UserScript==
// @name        Pixiv: Danbooru Artist X-Ref
// @namespace   6930e44863619d3f19806f68f74dbf62
// @version     2018-02-19
// @description Adds a 'Danbooru' tab to the navigation bar on Pixiv, which attempts to display the artist's Danbooru tag by seaching them on the Danbooru wiki.
// @match       *://*.pixiv.net/member_illust.php?*
// @match       *://*.pixiv.net/member.php?*
// @run-at      document-end
// @grant       GM_xmlhttpRequest
// ==/UserScript==

'use strict';

/* -------------------------------------------------------------------------- */

const c = (x) => `booru-${x}-bba5bb178fab7bb54d25903eaa910e8c`;
const qs = (x) => document.querySelector(x);
const tab_qs = (x) => qs(`#${c('tab')} ${x}`);

const artist_search_link = (artistId) =>
	`https://danbooru.donmai.us/artists?commit=Search&search%5Burl_matches%5D=${
		encodeURIComponent(`*pixiv.net/member.php?*id=${artistId}`)}`;
const artist_page_link = (booruArtistId) =>
	`https://danbooru.donmai.us/artists/${booruArtistId}`;

const tagSearchLinkFnTbl = {
	danbooru : (tag) =>
		`https://danbooru.donmai.us/posts?tags=${
			encodeURIComponent(tag)}`,
	gelbooru : (tag) =>
		`https://gelbooru.com/index.php?page=post&s=list&tags=${
			encodeURIComponent(tag)}`,
	r34xxx : (tag) =>
		`https://rule34.xxx/index.php?page=post&s=list&tags=${
			encodeURIComponent(tag)}`,
};

const entrypoint = () => {
	let tabs = qs(`.column-header nav .tabs`);
	if (!tabs) {return;};

	let artistId = (new URL(tabs.querySelector(`a[href^='/member_illust.php?']`).href))
		.searchParams.get(`id`);
	if (!artistId) {return;};

	insert_style_rules(style_rules());

	tabs.lastElementChild.insertAdjacentHTML(
		`afterend`,
		`<li id="${c('tab')}"><a><!--
			--><span class="${c('main-text')}">Danbooru</span><!--
			--><figure class="${c('status')}"></figure><!--
			--><span class="${c('tag-ctrls')}" style="display:none"></span><!--
		--></a></li>`);

	tab_qs(`a`).href = artist_search_link(artistId);

	tab_qs(`.${c('status')}`).style.backgroundImage =
		`url('${imgTbl.spinner}')`;

	const on_fail = () => {
		tab_qs(`.${c('tag-ctrls')}`).style.display = `none`;
		tab_qs(`.${c('status')}`).style.display = `none`;

		qs(`#${c('tab')} > a`).style.textDecorationLine = `line-through`;
		qs(`#${c('tab')} > a`).style.filter = `saturate(0%) opacity(50%)`;
	};

	const on_success = (booruArtistId, artistTag) => {
		tab_qs(`a`).href = artist_page_link(booruArtistId);

		tab_qs(`.${c('status')}`).style.display = `none`;
		tab_qs(`.${c('tag-ctrls')}`).style.display = ``;

		tab_qs(`.${c('tag-ctrls')}`).insertAdjacentHTML(
			`beforeend`,
			/* meaningless href */
			`<a class="${c('tag')}"
				title="Copy to clipboard"
				href="copy-to-clipboard:${escape_xml(artistTag)}"
				>${escape_xml(artistTag)}</a>`);

		tab_qs(`.${c('tag')}`).addEventListener(`click`, ev => {
			ev.preventDefault();

			/* select the element */
			let range = document.createRange();
			let sel = window.getSelection();
			sel.removeAllRanges();
			range.selectNodeContents(ev.currentTarget);
			sel.addRange(range);

			document.execCommand(`copy`);
		});

		for (let site of Object.keys(tagSearchLinkFnTbl)) {
			let link = tagSearchLinkFnTbl[site](artistTag);
			tab_qs(`.${c('tag-ctrls')}`).insertAdjacentHTML(
				`beforeend`,
				`<a class="${c('tag-search-link')}"
					href="${escape_xml(link)}"
					><figure
						style="background-image : url('${imgTbl[site]}')"
						></figure></a>`);
		};
	};

	GM_xmlhttpRequest({
		method : `GET`,
		url : artist_search_link(artistId),
		onerror : on_fail,
		onabort : on_fail,
		ontimeout : on_fail,
		onload : resp => {
			try {
				enforce(resp.status === 200);
	
				let doc = (new DOMParser)
					.parseFromString(resp.responseText, `text/html`);
	
				let trs = [...doc.querySelectorAll(
					`#a-index > table > tbody > tr`)];
				enforce(trs.length === 1);

				let booruArtistId = /artist-(\d+)/.exec(trs[0].id)[1];
				let artistTag = trs[0]
					.querySelector(`a:first-of-type`)
					.textContent;

				on_success(booruArtistId, artistTag);

			} catch (_) {
				on_fail();};
		},
	});
};

/* -------------------------------------------------------------------------- */

const insert_style_rules = (rules) => {
	let style = document.createElement(`style`);
	document.head.appendChild(style);
	for (let rule of rules) {
		style.sheet.insertRule(rule, style.sheet.cssRules.length);};
};

const escape_xml = (xs) => xs
	.split(``)
	.map(x => ({
		'"' : `&quot;`,
		"'" : `&apos;`,
		'<' : `&lt;`,
		'>' : `&gt;`,
		'&' : `&amp;`,})[x] || x)
	.join(``);

const xpath = function*(xpr, ctx = document) {
	let xs = document.evaluate(
		xpr, ctx, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
	for (let i = 0; i < xs.snapshotLength; ++i) {
		yield xs.snapshotItem(i);};
};

const enforce = (cond, msg = `enforcement failed`) => {
	if (!cond) {
		let x = new Error();
		throw new Error(`${msg} | ${x.stack}`);};
	return cond;
};

/* -------------------------------------------------------------------------- */

const style_rules = () => [
	`#${c('tab')} * {
		text-decoration : none;
	}`,

	`#${c('tab')} > a {
		display : inline-flex;
		flex-direction : row;
		align-items : center;
	}`,

	`#${c('tab')} > a > span {
		margin-right : 0.4em;
	}`,

	`#${c('tab')} .${c('main-text')}:hover {
		text-decoration-line : underline;
	}`,

	`#${c('tab')} .${c('status')} {
		width : 16px;
		height : 16px;
	}`,

	`#${c('tab')} .${c('tag-ctrls')} {
		font-size : 80%;
		color : initial;
	}`,

	`#${c('tab')} .${c('tag-ctrls')} * {
		color : initial;
	}`,

	`#${c('tab')} .${c('tag-ctrls')}:before {
		content : '( ';
	}`,
	`#${c('tab')} .${c('tag-ctrls')}:after {
		content : ' )';
	}`,

	`#${c('tab')} .${c('tag-ctrls')} > a {
		padding : initial;
	}`,

	`#${c('tab')} .${c('tag-ctrls')} > * {
		margin : 0 0.1em;
	}`,

	`#${c('tab')} .${c('tag-search-link')} {
		vertical-align : middle;
	}`,

	`#${c('tab')} .${c('tag-search-link')} > figure {
		width : 16px;
		height : 16px;
	}`,
];

const imgTbl = {
	danbooru : `data:image/x-icon;base64,
		AAABAAEAEBAAAAEACABoBQAAFgAAACgAAAAQAAAAIAAAAAEACAAAAAAAAAAAAAAAAAAAAAAA
		AAAAAAAAAAAAAAAAXoCkAF+ApABegaQAX4GkAF+BpQBfgqYAYIKmAGGEpwBihagAY4apAGOH
		qgBliKwAZYmsAGaJrQBmiq0AZ4quAGiLrwBojLEAao6yAGuPswBsj7UAbJC1AG2QtQBskbUA
		bZK3AG+TuABwk7kAb5S4AHCUuQBwlLoAcZS6AHCVugBxlboAAAAAAAAAAAAAAAAAAAAAAAAA
		AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
		AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
		AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
		AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
		AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
		AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
		AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
		AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
		AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
		AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
		AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
		AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
		AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
		AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
		AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
		AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
		AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQDAwMDAgIEBAAAAAAA
		AAAEAwMEAQQDAwQABAAAAAAABAQEAwMCBAQEAAQDAAAAAAMDAwQDAwQDAwAEAQAAAAALCwoJ
		CAYEAgQABwUAAAAAFBUUExIREA4MAA8NAAAAACAgHiAgHRoZFwAYFgAAAAAgICAgIR8fHiAA
		ISEAAAAAIB4gISEgISAeAB4eAAAAAAAAAAAAAAAAAAAeIAAAAAAAICAcICAgICAgACAAAAAA
		AAAgIB4gIR8bICAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//AACADwAA
		gAcAAIADAACAAQAAgAEAAIABAACAAQAAgAEAAIABAACAAQAAgAEAAMABAADgAQAA8AEAAP//
		AAA=
	`.replace(/\s/g, ''),

	gelbooru : `data:image/png;base64,
		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
	`.replace(/\s/g, ''),

	r34xxx : `data:image/x-icon;base64,
		AAABAAEAEBAAAAAAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAQAQAAAAAAAAAAAAA
		AAAAAAAAAAD///8BADMA/wAAAP8AMwD/AAAA/wAzAP8AMwD/AAAA/wAzAP8AAAD/ADMA/wAz
		AP8AAAD/ADMA/wAAAP////8BM2Yz/wAzAP+Z/5n/AAAA/5n/mf8AAAD/ADMA/5n/mf8AAAD/
		mf+Z/wAAAP8AMwD/mf+Z/wAAAP+Z/5n/AAAA/zNmM/8AMwD/AAAA/5n/mf8AAAD/ADMA/wAz
		AP8AAAD/mf+Z/wAAAP8AMwD/ADMA/wAAAP+Z/5n/AAAA/wAzAP8zZjP/ADMA/5n/mf8AAAD/
		mf+Z/wAAAP8AMwD/mf+Z/wAAAP+Z/5n/AAAA/wAzAP+Z/5n/AAAA/5n/mf8AAAD/M2Yz/zNm
		M/8AAAD/AAAA/wAAAP8AAAD/M2Yz/wAzAP8AMwD/ADMA/wAzAP8zZjP/AAAA/zNmM/8AMwD/
		ADMA/zNmM/8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8zZjP/M2Yz/zNmM/8zZjP/M2Yz/wAA
		AP8AAAD/M2Yz/zNmM/8zZjP/AAAA/////////////////wAAAP8AAAD/AAAA/zNmM/8zZjP/
		M2Yz/zNmM///////AAAA/wAAAP8zZjP/M2Yz//////8AAAD/M2Yz/zNmM///////AAAA/wAA
		AP8zZjP/M2Yz/zNmM/8AAAD//////wAAAP8AAAD/AAAA/zNmM/8zZjP/AAAA/wAAAP8AAAD/
		/////wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA//////8AAAD/AAAA/wAAAP8zZjP/M2Yz/wAA
		AP8AAAD/AAAA//////8AAAD/AAAA//////////////////////////////////////8AAAD/
		M2Yz/zNmM/////////////////8AAAD/AAAA/zNmM///////AAAA/wAAAP8zZjP//////wAA
		AP8AAAD/AAAA/zNmM/8AAAD/AAAA/zNmM/8zZjP//////wAAAP8AAAD/M2Yz//////8AAAD/
		AAAA//////8AAAD/AAAA/zNmM/8zZjP/AAAA/wAAAP8AAAD/AAAA//////8AAAD/AAAA/zNm
		M/8zZjP//////wAAAP//////AAAA/wAAAP8zZjP/M2Yz//////8AAAD/AAAA/wAAAP//////
		AAAA/wAAAP8zZjP/M2Yz/zNmM////////////wAAAP8AAAD/M2Yz/zNmM/8zZjP/////////
		////////AAAA/wAAAP8zZjP/M2Yz/zNmM/8zZjP/M2Yz//////8AAAD/AAAA/zNmM/////8B
		M2Yz/zNmM/8zZjP/M2Yz/zNmM/8zZjP/M2Yz/zNmM/8zZjP/M2Yz/zNmM/8zZjP/M2Yz/zNm
		M/////8BAAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//
		AAD//wAA//8AAP//AAD//w==
	`.replace(/\s/g, ''),

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

	cross : `data:image/png;base64,
		iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9i
		ZSBJbWFnZVJlYWR5ccllPAAAAntJREFUeNqkk99v0lAUxw9t6SjIwhgsiBlGYCJotixhM5lZ
		wl72svgyffWf4C/YX8CTfwCJyZ4MW+LD3syMv5bIi1kcwUHmNJmAgEKhLaUtnlMKgcU3b/Jt
		b3vP53vPvfdc22AwgP9pHD1e2GzA4ptkAwiidrG7gQpZcd9RH3CqHOpKxw/SM5ycu2b42C4I
		6fDycjS4tOQVZmcdlKHcbq9enZ9vXpyePlFlOYNxr6YyGMGCx7P3cGcnPuA4oadp0Gu1RmPO
		QDzu9IfD8/mjo73u8L9pwtAD0wqyDkd6dXs73pIkIZDNQqfTmZL5T1GEB6lUnJmZSRMzNsD1
		7IYSiehvURTu5nLmlPcOD0EURVPUpxY7OAARTRYikag+3KfhEjSAR26/31tvNuFlNApPSyVQ
		FAVC+/sgSRKU8JthGHidTILdbgff3JyXGESfM5bBosEwDg3X7Xa5IOvzQaFQgGq1ahrZ8JTe
		IMzTKfX7oEiSg5jJDEDDARXTlTALl2EAy7LmbDzPm7oxsdssxmpW38ygD/BDrNWUQb0Ogq5D
		7Ph4CuY4DlLFIjjpOAhQVYWYsQG6va9VKg03Bi5OwJ/X1uDTyoppQNool02Dtiw3iZk0yH1r
		NMq4U/Ll1pYJnyF8C8dIJ7GYme67SAQMw5ArvV6JmLGBgeXZ1fXMx3q94AWQv66vw238L1ii
		/gnCHoTznU5BMowMMcTaqFRplykoidV4h2HScZ6Pxnje62FZBwX90XWlqKrNgqqWLhDOYxVe
		UgESaxnQacyjfFhegQTA5gLAfbxcN61C+1kD+HIG8BanxS78QtWR1UYGjLXBzmv341+NLmIX
		JSFr/BVgAM8jHGX/y9T1AAAAAElFTkSuQmCC
	`.replace(/\s/g, ''),

	question : `data:image/png;base64,
		iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9i
		ZSBJbWFnZVJlYWR5ccllPAAAAptJREFUeNqkU0trE1EY/WaSeSSmSSN59GUTK4VCLbEU22oq
		lNZFK67suhhULEhxI4H+gYIaXYgIBkSK4kIEd1LcBWmsDwJKEIRUm5Y2MU2knbybmUy8340z
		WHHnhTOP7zvnzP0Od5hGowH/s4x4Gb8UBYulBWy2VhBFk5dl2TlSnibo/c1LECyrqhquVitJ
		SdqDYrEAkcf+poG2CCHAwn5ofNDiODVwCDqczXYqq/hW4yVfJFa5QjhBUlo6sANNbOKq4YWL
		Ht7bzkNztDrtdbsZ8LS1wOhxwbH4aCMsqSpoJtRAlmWvqpRDC4FjfJeTxXc4e/XDgVnv3uiD
		E302WAh08tdvxkOEEyHlJIvNQqE4Nzlsc3S5DFSsKArMnm+nODNohXw+D+8+79AeciZO2hyo
		QS01qFSq05OjLkqo1+sUMxN2mBrhwWndxz5kMjuQSCRgbe0bjPSLVKOPoKpsr7fDTO41+nVJ
		ykO5XIGPX4rw8EUahgdccPnCEZJ8ETAat91ANbqB0WgGaOBO9om4gIGCwcDB7Sd7wDAmWJzv
		gVKpRHg8zaNBNk41moEoWhOJzbLvsLlGhDxBM7jVZ6fpPZfbBY4T9UC3sk2NnoHJZF9+E5Px
		EAHPCzrOzW9T/FkTBBFW402NbiAILeFIjMllJTQw0a8hRNFGob0j0j8FeBvncqjRDci8yZoi
		Bu88VWqZXYESjUYRXt13U+Az1lJEfO851JCLGtQyeOJ6hoIkLAPYO8YCXT1jofEh3uH3cdDp
		Ymm4W9k6RD/JEInJue31leD32K2l3dQKPa3UgGEYLVC30zPV3z1wbaa1bcTPsNxRmroqr+/9
		eB/djD94md14/ZWU0gS1vw1wHAuBWRvtHwt/kAoeXvxRUPtLgAEApMsjVBLagBkAAAAASUVO
		RK5CYII=
	`.replace(/\s/g, ''),

	copy : `data:image/png;base64,
		iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9i
		ZSBJbWFnZVJlYWR5ccllPAAAAgBJREFUeNqMk79rFEEcxd/M7V2QAzVFEOMFGwNiIGCjEdIE
		hYODmEawsFf8G4QQSCPYyqUWCdhY2qSQECSpInvFJYT8Ki6dZO8Sb2P29pfvu+4sm+UKv/AY
		Zna/b95ndla9WFyEUmoewG0Mr+9hGB5EYYhypZIseO0fCHa3sP/LhxVFkazd+by0tOIFAQac
		+3w5imPYto1Pa2tv+VxR+8bRuv8EevIRxn5uQoszpWI2RjSIBgMMLi/hui76/T6+Li+v8Pkz
		9k0Wo409pFHAJooUCiWqYlk46nTQ2ttD+/gY75pNPKjVmmfd7gf2vKbu5U0sMWBpzWatNcAk
		v7n789lZ1GdmMqQ3cbxApIUikg58H5S0JgkSE/L/L1JmoNJmMZEDzCNdK5cxwtFxHHxcXcXT
		qalm27Zf7rRaRKBBhkAhxcgjiYlUo16HfKlqtYpv29u95Az81EClCFLyaQ0SCib/dtNJ6qsG
		fDmJnRqoXIKiyVUDz8sSSGy5VnI3ikh5k1KplBnog/V19BxnRCZmV15dGCSdO1wziphcS3rr
		T7d71zk5Ob8+Pf3eMN4aH3/8qtGYM0hp7iyJbO0bBOrMPTz8kl6OpGoTEzEncwapaCLrRNfu
		6Wli0Etl6mbfdb0MiYrlXsjZyAUTE0qwOxsbo9aQ3/dGEWlYRRcX5xxG/wowAC8cIjzfyA4l
		AAAAAElFTkSuQmCC
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