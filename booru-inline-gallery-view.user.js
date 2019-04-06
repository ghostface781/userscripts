// ==UserScript==
// @name		Booru: Inline Gallery View
// @namespace	6930e44863619d3f19806f68f74dbf62
// @match		*://*.rule34.xxx/*
// @version		2019-04-05
// @run-at		document-end
// @grant		GM_xmlhttpRequest
// ==/UserScript==

'use strict';

/* -------------------------------------------------------------------------- */

const entrypoint = function() {
	if (!isGalleryUrl(tryParseHref(location.href))) {
		return;};

	window.addEventListener(
		`hashchange`,
		ev => applyToDocument(ev.target.document, ev.newURL),
		false);
	applyToDocument(document, location.href);
};

/* -------------------------------------------------------------------------- */

/*
	state : {
		domain : string,
		searchQuery : string,
		currentPostId : int,
	}
*/

const namespace = `inline-gallery-view`;

const qualName = function(n, ns = namespace) {
	return ns+`-`+n;
};

const applyToDocument = function(doc, href) {
	enforce(doc instanceof HTMLDocument);

	let url = tryParseHref(href);
	if (!isGalleryUrl(url)) {return;};

	let state = stateFromUrl(url);
	if (state === null) {return;};

	ensureApplyStyleRules(doc, getGlobalStyleRules);

	let viewParent = getInlineViewParent(state, doc);
	let view = getInlineView(state, viewParent);

	if (!isPostId(state.currentPostId)) {
		if (view) {
			view.remove();};
	} else {
		if (!view) {
			view = ensureInlineView(state, doc, viewParent);};

		if (view) {
			bindInlineView(state, doc, view);};
	};

	let thumbsParent = getThumbnailsParent(state, doc);
	if (thumbsParent) {
		bindThumbnailsList(state, doc, thumbsParent);};
};

const bindInlineView = async function(state, doc, view) {
	while (view.hasChildNodes()) {
		view.removeChild(view.firstChild);};

	view.insertAdjacentHTML(`beforeend`,
		`<div class='${qualName('iv-ctrls')}'>
			<div class='${qualName('status')}'></div>
			<a title='Previous' class='${qualName('prev')}' href='#'></a>
			<a title='Next' class='${qualName('next')}' href='#'></a>
			<a title='Close' class='${qualName('close')}' href='#'></a>
		</div>
		<img id='image' class='${qualName('current-image')}' src=''></img>`);

	let imgElem = enforce(view.getElementsByClassName(
		qualName(`current-image`))[0]);

	let info = await tryGetPostInfo(state, state.currentPostId);
	if (info) {
		imgElem.style.minWidth = `${info.width|0}px`;
		imgElem.style.minHeight = `${info.height|0}px`;
		imgElem.src = imageUrl(state, info.imagePath);};
};

const bindThumbnailsList = function(state, doc, thumbsParent) {
	for (let thumb of thumbsParent.children) {
		bindThumbnail(state, doc, thumb);
	};
};

const bindThumbnail = function(state, doc, thumb) {
	let extUrl = thumbnailUrl(state, thumb);
	let postId = postIdFromUrl(state, extUrl);
	if (!isPostId(postId)) {
		return null;};

	thumb.classList.toggle(qualName(`selected`),
		postId === state.currentPostId);

	ensureThumbnailOverlay(state, doc, thumb, postId, extUrl);
};

const ensureThumbnailOverlay = function(state, doc, thumb, postId, extUrl) {
	enforce(thumb instanceof HTMLElement);

	{
		let xs = thumb.getElementsByClassName(qualName(`thumb-overlay`));
		if (xs.length > 1) {
			return null;};
	
		if (xs.length === 1) {
			return xs[0];};
	};

	let ovr = doc.createElement(`div`);
	ovr.classList.add(qualName(`thumb-overlay`));

	let inUrl = stateAsFragment(
		{...state, currentPostId : postId},
		doc.location.href);

	ovr.insertAdjacentHTML(`beforeend`,
		`<a class='${qualName('thumb-ex-link')}'
			href='${escapeAttr(extUrl.href)}'></a>
		<a class='${qualName('thumb-in-link')}'
			href='${escapeAttr(inUrl)}'></a>`);

	thumb.prepend(ovr);

	return ovr;
};

const ensureInlineView = function(state, doc, parentElem) {
	let containerElem = getInlineView(state, parentElem);

	if (parentElem && containerElem === null) {
		containerElem = doc.createElement(`div`);
		containerElem.classList.add(qualName(`iv-container`));
		parentElem.append(containerElem);
	};

	return containerElem;
};

const getInlineView = function(state, parentElem) {
	let containerElem = null;
	if (parentElem) {
		let xs = parentElem.getElementsByClassName(qualName(`iv-container`));
		if (xs.length > 1) {
			return null;};
		if (xs.length === 1) {
			containerElem = xs[0];};
	};

	if (!(containerElem instanceof HTMLDivElement)) {
		return null;};

	return containerElem;
};

const getInlineViewParent = function(state, doc) {
	let parentElem = null;
	{
		let xs = doc.getElementsByClassName(`content`);
		if (xs.length !== 1) {
			return null;};
		parentElem = xs[0];
	};

	return parentElem;
};

const getThumbnailsParent = function(state, doc) {
	let outerElem = getInlineViewParent(state, doc);
	if (!outerElem) {
		return null;};

	let firstThumb = outerElem.getElementsByClassName(`thumb`)[0];
	if (!firstThumb) {
		return null;};

	return firstThumb.parentElement;
};

const thumbnailUrl = function(state, elem) {
	enforce(elem instanceof HTMLElement);

	let url = null;
	for (let c of elem.children) {
		if (!(c instanceof HTMLAnchorElement)) {
			continue;}

		let cu = tryParseHref(c.href);
		if (cu === null || !isPostUrl(state, cu)) {
			continue;};

		if (url !== null) {
			/* thumbnail has multiple <a> children */
			return null;};

		url = cu;
	};

	return url;
};

const isPostId = function(id) {
	return (id|0) === id && id >= 0;
};

const isGalleryUrl = function(url) {
	if (!(url instanceof URL)) {
		return false;};

	/* currently only rule34 search-result pages are supported: */

	return (
		[`/`, `/index.php`].includes(url.pathname)
			&& url.searchParams.get(`page`) === `post`
			&& url.searchParams.get(`s`) === `list`);
};

const isPostUrl = function(state, url) {
	if (!(url instanceof URL)) {
		return false;};

	/* currently only rule34 post pages are supported: */

	return (
		[`/`, `/index.php`].includes(url.pathname)
			&& url.searchParams.get(`page`) === `post`
			&& url.searchParams.get(`s`) === `view`
			&& isPostId(postIdFromUrl(state, url)));
};

const postIdFromUrl = function(state, url) {
	if (!(url instanceof URL)) {
		return -1;};

	let id = parseInt(url.searchParams.get(`id`));
	if (!isPostId(id)) {
		return -1;};

	return id;
};

const stateFromUrl = function(url) {
	if (!(url instanceof URL)) {
		return null;};

	return {
		currentPostId : postIdFromUrl(null, url),
		...stateFromFragment(url.hash),
		domain : url.hostname,
		searchQuery : url.searchParams.get(`tags`),};
};

const fragmentPrefix = `#`+namespace+`:`;

const stateAsFragment = function(state, baseHref) {
	return fragmentPrefix+encodeURIComponent(JSON.stringify(state));
};

const stateFromFragment = function(frag) {
	if (typeof frag !== `string` || !frag.startsWith(fragmentPrefix)) {
		return null;};

	let src = frag.slice(fragmentPrefix.length);
	let state = tryParseJson(decodeURIComponent(src));
	if (typeof state !== `object`) {
		return null;};

	return state;
};

/* --- post info --- */

const postInfoTbl = new Map(); /* postId → postInfo */

const tryGetPostInfo = async function(state, postId) {
	enforce(isPostId(postId));

	let info = postInfoTbl.get(postId);
	if (info) {
		enforce(typeof info === `object`);
		return info;};

	let resp = await tryHttpGet(
		requestPostInfoByIdUrl(state, postId));

	if (typeof resp !== `object`) {
		return null;};

	let objs = tryParseJson(resp.responseText);
	if (!Array.isArray(objs) || objs.length !== 1) {
		return null;};

	let o = objs[0];
	if (o.id !== postId) {
		return null;};

	info = {
		postId,
		width : o.width|0,
		height : o.height|0,
		imagePath : {
			dir : o.directory,
			filename : o.image,},};

	postInfoTbl.set(postId, info);

	return info;
};

const tryNavigatePostInfo = async function(
	state, postId, direction, searchQuery)
{
	enforce(isPostId(postId));
	enforce(direction === `prev` || direction === `next`);

	// todo
	throw `todo`;
};

/* --- api urls --- */

const requestPostInfoByIdUrl = function(state, postId) {
	enforce(isPostId(postId));

	let url = new URL(
		`https://rule34.xxx/?page=dapi&s=post&q=index&json=1&limit=1`);
	url.searchParams.set(`tags`, `id:${postId}`);
	return url;
};

const imageUrl = function(state, imgPath) {
	return new URL(
		`https://img.rule34.xxx/images/${imgPath.dir}/${imgPath.filename}`);
};

const sampleImageUrl = function(state, imagePath) {
	return new URL(
		`https://img.rule34.xxx/samples/`
		+`${imgPath.dir}/sample_${imgPath.filename}`);
};

/* --- ? --- */

const tryParseHref = function(href) {
	try {
		return new URL(href);
	} catch (x) {
		return null;};
};

const tryParseJson = function(s) {
	try {
		return JSON.parse(s);
	} catch (x) {
		return undefined;};
};

const enforce = (cond, msg = `enforcement failed`) => {
	if (!cond) {
		let x = new Error();
		throw new Error(`${msg} | ${x.stack}`);
	};
	return cond;
};

const requestTimeoutMs = 10000;

const tryHttpGet = async function(...args) {
	try {
		return await httpGet(...args);
	} catch (x) {
		console.error(x);
		return null;};
};

const httpGet = function(url) {
	enforce(url instanceof URL);

	return new Promise((resolve, reject) => {
		let onFailure = function(resp) {
			return reject(new Error(
				`GET request to ${url.href} failed with status `
				+`"${resp.statusText}"`));
		};

		let onSuccess = function(resp) {
			if (resp.status === 200) {
				return resolve(resp);
			} else {
				return onFailure(resp);};
		};

		GM_xmlhttpRequest({
			method : `GET`,
			url : url.href,
			timeout : requestTimeoutMs,
			onload : onSuccess,
			onabort : onFailure,
			onerror : onFailure,
			ontimeout : onFailure,
		});
	});
};

const escapeAttr = function(chars) {
	let s = ``;
	for (let c of chars) {
		switch (c) {
			case `"` : s += `&quot;`; break;
			case `'` : s += `&apos;`; break;
			case `<` : s += `&lt;`; break;
			case `>` : s += `&gt;`; break;
			case `&` : s += `&amp;`; break;
			default : s += c; break;
		};
	};
	return s;
};

/* --- styles --- */

const ensureApplyStyleRules = function(doc, getRules) {
	enforce(doc instanceof HTMLDocument);
	enforce(doc.head instanceof HTMLHeadElement);

	if (doc.getElementById(qualName(`global-stylesheet`))
		instanceof HTMLStyleElement)
	{
		return;};

	let style = doc.createElement(`style`);
	style.id = qualName(`global-stylesheet`);
	doc.head.appendChild(style);

	for (let rule of getRules()) {
		style.sheet.insertRule(rule, style.sheet.cssRules.length);};
};

const getGlobalStyleRules = () => [
	`.${qualName('iv-container')} {
		display : flex;
		flex-direction : column;
		align-items : center;
		justify-content : flex-start;
		min-height : 10rem;
	}`,

	`.${qualName('iv-ctrls')} {
		display : flex;
		flex-direction : row;
		align-items : stretch;
		justify-content : center;
		min-width : 50rem;
		min-height : 3rem;
		background-color : hsl(0, 0%, 40%);
	}`,

	`.${qualName('iv-ctrls')} > * {
		flex-grow : 1;
	}`,

	`.${qualName('iv-ctrls')} > a {
		background-position : center;
		background-repeat : no-repeat;
		background-size : 2rem;
		opacity : 0.5;
	}`,

	`.${qualName('iv-ctrls')} > a:hover {
		background-color : hsl(0, 0%, 50%);
		opacity : 1;
	}`,

	`.${qualName('iv-ctrls')} > a.${qualName('prev')} {
		background-image : url(${svgCircleArrowLeftUrl});
	}`,

	`.${qualName('iv-ctrls')} > a.${qualName('next')} {
		background-image : url(${svgCircleArrowRightUrl});
	}`,

	`.${qualName('iv-ctrls')} > a.${qualName('close')} {
		background-image : url(${svgCircleArrowUpUrl});
	}`,

	`.thumb {
		position : relative;
		/* centre the thumbnail images: */
		display : flex !important;
		align-items : center;
		justify-content : center;
	}`,

	`.thumb > .${qualName('thumb-overlay')} {
		display : flex;
		flex-direction : column;
		position : absolute;
		top : 0;
		left : 0;
		bottom : 0;
		right : 0;
	}`,

	`.thumb > .${qualName('thumb-overlay')} > * {
		display : block;
		flex-grow : 1;
	}`,

	`.thumb > .${qualName('thumb-overlay')} > a {
		background-position : center;
		background-repeat : no-repeat;
		background-size : 30%;
		opacity : 0.7;
	}`,

	`.thumb > .${qualName('thumb-overlay')}
		> a.${qualName('thumb-ex-link')}:hover
	{
		background-image : url(${svgCircleLinkUrl});
		background-color : hsl(233, 100%, 75%);
	}`,

	`.thumb > .${qualName('thumb-overlay')}
		> a.${qualName('thumb-in-link')}:hover,
	.thumb.${qualName('selected')} > .${qualName('thumb-overlay')}
		> a.${qualName('thumb-in-link')}
	{
		background-image : url(${svgCircleArrowDownUrl});
		background-color : hsl(33, 100%, 75%);
	}`,
];

/* --- assets --- */

const svgBlobUrl = function(src) {
	//return `data:image/svg+xml,${encodeURIComponent(src)}`;
	return URL.createObjectURL(
		new Blob([src], {type : `image/svg+xml`}));
};

const svgCircleArrow = function(rot = 0) {
	return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 72 72'>
		<path fill='#fff'
			transform='rotate(${rot|0} 36 36)'
			d='M0 36a36 36 0 1 0 72 0 36 36 0 0 0-72 0zm60 6l-8
				8-16-15-16 15-8-8 24-24z'/>
	</svg>`;
};
const svgCircleArrowUpUrl = svgBlobUrl(svgCircleArrow(0));
const svgCircleArrowRightUrl = svgBlobUrl(svgCircleArrow(90));
const svgCircleArrowDownUrl = svgBlobUrl(svgCircleArrow(180));
const svgCircleArrowLeftUrl = svgBlobUrl(svgCircleArrow(270));

const svgCircleLink =
	`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 72 72'>
		<path fill='#fff'
			d='M36 0C16.118 0 0 16.118 0 36s16.118 36 36 36 36-16.118
				36-36S55.882 0 36 0zm.576 26.63h17.059c4.933 0 8.99 4.058 8.99
				8.991s-4.057 8.988-8.99 8.988H42.748a11.152 11.152 0 0 0
				4.084-5.41h6.803c2.03 0 3.58-1.548
				3.58-3.578s-1.55-3.58-3.58-3.58H36.576c-2.03 0-3.58
				1.55-3.58 3.58 0 .41.066.798.184 1.16h-5.516a8.883
				8.883 0 0 1-.078-1.16c0-4.933 4.057-8.99
				8.99-8.99zm-18.21.76h10.886a11.152 11.152 0 0 0-4.084
				5.41h-6.803c-2.03 0-3.58 1.55-3.58 3.579 0 2.03 1.55 3.58 3.58
				3.58h17.059c2.03 0 3.58-1.55 3.58-3.58
				0-.41-.066-.798-.184-1.16h5.516c.05.38.078.766.078 1.16 0
				4.933-4.057 8.99-8.99 8.99H18.365c-4.933
				0-8.99-4.057-8.99-8.99s4.057-8.988 8.99-8.988z'/>
	</svg>`;
const svgCircleLinkUrl = svgBlobUrl(svgCircleLink);

/* -------------------------------------------------------------------------- */

entrypoint();

/* -------------------------------------------------------------------------- */