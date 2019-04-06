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
		scaleMode : `fit` / `full`,
	}
*/

const namespace = `inline-gallery-view`;

const qual = function(n, ns = namespace) {
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

	let baseHref = doc.location.href;

	let scaleHref = stateAsFragment(
		{...state,
			scaleMode : state.scaleMode === `fit` ? `full` : `fit`},
		baseHref);

	let prevHref = `#`;

	let exHref = postPageUrl(state, state.currentPostId).href;

	let nextHref = `#`;

	let closeHref = `#`;

	view.insertAdjacentHTML(`beforeend`,
		`<div class='${qual('iv-ctrls')}'>
			<a title='Toogle Size' class='${qual('scale')}'
				href='${escapeAttr(scaleHref)}'>
				<figure class='${qual('btn-icon')}'></figure></a>
			<a title='Previous' class='${qual('prev')}'
				href='${escapeAttr(prevHref)}'>
				<figure class='${qual('btn-icon')}'></figure></a>
			<a title='#${state.currentPostId}' class='${qual('ex')}'
				href='${escapeAttr(exHref)}'>
				<figure class='${qual('btn-icon')}'></figure></a>
			<a title='Next' class='${qual('next')}'
				href='${escapeAttr(nextHref)}'>
				<figure class='${qual('btn-icon')}'></figure></a>
			<a title='Close' class='${qual('close')}'
				href='${escapeAttr(closeHref)}'>
				<figure class='${qual('btn-icon')}'></figure></a>
		</div>
		<div class='${qual('iv-content-stack')}'>
			<img id='image' class='${qual('iv-image')}' src=''></img>
			<img class='${qual('iv-image-placeholder')}' src=''></img>
		</div>`);

	let stackElem = enforce(view.getElementsByClassName(
		qual(`iv-content-stack`))[0]);

	let imgElem = enforce(view.getElementsByClassName(qual(`iv-image`))[0]);

	let phldrElem = enforce(view.getElementsByClassName(
		qual(`iv-image-placeholder`))[0]);

	let info = await tryGetPostInfo(state, state.currentPostId);
	if (info) {
		//stackElem.style.width = (info.width|0)+`px`;
		//stackElem.style.height = (info.height|0)+`px`;
		stackElem.classList.toggle(
			qual('scale-fit'), state.scaleMode === `fit`);

		//phldrElem.src = `data:image/svg+xml,`+encodeURIComponent(
		//	svgEmptyPlaceholder(info.width, info.height));
		//let phldrBlobHref = svgBlobHref(
		//	svgEmptyPlaceholder(info.width, info.height));
		//phldrElem.src = phldrBlobHref;
		//phldrElem.outerHTML = svgEmptyPlaceholder(info.width, info.height);

		imgElem.src = imageUrl(state, info.imagePath);
	};
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

	thumb.classList.toggle(qual(`selected`),
		postId === state.currentPostId);

	ensureThumbnailOverlay(state, doc, thumb, postId, extUrl);
};

const ensureThumbnailOverlay = function(state, doc, thumb, postId, extUrl) {
	enforce(thumb instanceof HTMLElement);

	{
		let xs = thumb.getElementsByClassName(qual(`thumb-overlay`));
		if (xs.length > 1) {
			return null;};
	
		if (xs.length === 1) {
			return xs[0];};
	};

	let ovr = doc.createElement(`div`);
	ovr.classList.add(qual(`thumb-overlay`));

	let inUrl = stateAsFragment(
		{...state, currentPostId : postId},
		doc.location.href);

	let title = thumbnailTitle(state, thumb);

	ovr.insertAdjacentHTML(`beforeend`,
		`<a class='${qual('thumb-ex-link')}'
			title='${escapeAttr(title)}'
			href='${escapeAttr(extUrl.href)}'></a>
		<a class='${qual('thumb-in-link')}'
			title='${escapeAttr(title)}'
			href='${escapeAttr(inUrl)}'></a>`);

	thumb.prepend(ovr);

	return ovr;
};

const ensureInlineView = function(state, doc, parentElem) {
	let containerElem = getInlineView(state, parentElem);

	if (parentElem && containerElem === null) {
		containerElem = doc.createElement(`div`);
		containerElem.classList.add(qual(`iv-container`));
		parentElem.append(containerElem);
	};

	return containerElem;
};

const getInlineView = function(state, parentElem) {
	let containerElem = null;
	if (parentElem) {
		let xs = parentElem.getElementsByClassName(qual(`iv-container`));
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

const thumbnailTitle = function(state, elem) {
	enforce(elem instanceof HTMLElement);

	let xs = elem.getElementsByClassName(`preview`);
	if (xs.length !== 1) {
		return ``;};

	let title = xs[0].title;
	if (typeof title !== `string`) {
		return ``;};

	return title.trim();
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

/* --- urls --- */

const requestPostInfoByIdUrl = function(state, postId) {
	enforce(isPostId(postId));

	let url = new URL(
		`https://rule34.xxx/?page=dapi&s=post&q=index&json=1&limit=1`);
	url.searchParams.set(`tags`, `id:${postId}`);
	return url;
};

const postPageUrl = function(state, postId) {
	enforce(isPostId(postId));

	let url = new URL(`https://rule34.xxx/index.php?page=post&s=view`);
	url.searchParams.set(`id`, `${postId}`);
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

/* --- utilities --- */

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

	if (doc.getElementById(qual(`global-stylesheet`))
		instanceof HTMLStyleElement)
	{
		return;};

	let style = doc.createElement(`style`);
	style.id = qual(`global-stylesheet`);
	doc.head.appendChild(style);

	for (let rule of getRules()) {
		style.sheet.insertRule(rule, style.sheet.cssRules.length);};
};

const getGlobalStyleRules = () => [
	/* --- vars --- */

	`:root {
		--${qual('c-base')} : hsl(0, 0%, 40%);
		--${qual('c-base-active')} : hsl(0, 0%, 50%);
		--${qual('c-iv-action')} : hsl(33, 100%, 75%);
		--${qual('c-ex-link')} : hsl(233, 100%, 75%);
	}`,

	/* --- inline view --- */

	`.${qual('iv-container')} {
		display : flex;
		flex-direction : column;
		align-items : center;
		justify-content : flex-start;
		min-height : 10rem;
	}`,

	`.${qual('iv-content-stack')}.${qual('scale-fit')},
	.${qual('iv-content-stack')}.${qual('scale-fit')} > *
	{
		max-width : 100vw;
		max-height : 100vh;
	}`,

	/* --- controls --- */

	`.${qual('iv-ctrls')} {
		display : flex;
		flex-direction : row;
		align-items : stretch;
		justify-content : center;
		min-width : 50rem;
		min-height : 3rem;
		background-color : var(--${qual('c-base')});
	}`,

	`.${qual('iv-ctrls')} > * {
		/* equal sizes: */
		flex-basis : 0;
		flex-grow : 1;

		/* centre contents: */
		display : flex;
		align-items : center;
		justify-content : center;
	}`,

	`.${qual('iv-ctrls')} > a {
		opacity : 0.5;
	}`,

	`.${qual('iv-ctrls')} > a:hover {
		background-color : var(--${qual('c-base-active')});
		opacity : 1;
	}`,

	`.${qual('iv-ctrls')} > * > .${qual('btn-icon')} {
		margin : 0;
		width : 2rem;
		height : 2rem;
		background-size : cover;
	}`,

	`.${qual('iv-ctrls')} > .${qual('scale')} > .${qual('btn-icon')} {
		background-image : url(${svgCircleRingUrl});
	}`,

	`.${qual('iv-ctrls')} > .${qual('prev')} > .${qual('btn-icon')} {
		background-image : url(${svgCircleArrowLeftUrl});
	}`,

	`.${qual('iv-ctrls')} > .${qual('ex')}:hover {
		background-color : var(--${qual('c-ex-link')});
	}`,

	`.${qual('iv-ctrls')} > .${qual('ex')} > .${qual('btn-icon')} {
		background-image : url(${svgCircleLinkUrl});
	}`,

	`.${qual('iv-ctrls')} > .${qual('next')} > .${qual('btn-icon')} {
		background-image : url(${svgCircleArrowRightUrl});
	}`,

	`.${qual('iv-ctrls')} > .${qual('close')}:hover {
		background-color : var(--${qual('c-iv-action')});
	}`,

	`.${qual('iv-ctrls')} > .${qual('close')} > .${qual('btn-icon')} {
		background-image : url(${svgCircleArrowUpUrl});
	}`,

	/* --- thumbnails --- */

	`.thumb {
		position : relative;
		/* centre the thumbnail images: */
		display : flex !important;
		align-items : center;
		justify-content : center;
	}`,

	`.thumb > .${qual('thumb-overlay')} {
		display : flex;
		flex-direction : column;
		position : absolute;
		top : 0;
		left : 0;
		bottom : 0;
		right : 0;
	}`,

	`.thumb > .${qual('thumb-overlay')} > * {
		display : block;
		flex-grow : 1;
	}`,

	`.thumb > .${qual('thumb-overlay')} > a {
		background-position : center;
		background-repeat : no-repeat;
		background-size : 30%;
		opacity : 0.7;
	}`,

	`.thumb > .${qual('thumb-overlay')}
		> a.${qual('thumb-ex-link')}:hover
	{
		background-image : url(${svgCircleLinkUrl});
		background-color : var(--${qual('c-ex-link')});
	}`,

	`.thumb > .${qual('thumb-overlay')}
		> a.${qual('thumb-in-link')}:hover,
	.thumb.${qual('selected')} > .${qual('thumb-overlay')}
		> a.${qual('thumb-in-link')}
	{
		background-image : url(${svgCircleArrowDownUrl});
		background-color : var(--${qual('c-iv-action')});
	}`,

	/* --- animation --- */

	`.${qual('spinner')} {
		animation-name : ${qual('spinner')};
		animation-iteration-count : infinite;
		animation-duration : 0.36s;
		animation-timing-function : linear;
	}`,

	`@keyframes ${qual('spinner')} {
		from {}
		to {transform : rotate(1.0turn);}
	}`,
];

/* --- assets --- */

const svgBlobHref = function(src) {
	return URL.createObjectURL(
		new Blob([src], {type : `image/svg+xml`}));
};

const svgEmptyPlaceholder = function(w, h) {
	return `<svg xmlns='http://www.w3.org/2000/svg' `
		+`width='${w|0}' height='${h|0}'><path/></svg>`;
};

const svgCircleArrow = function(rot = 0) {
	return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 72 72'>
		<path fill='#fff'
			transform='rotate(${rot|0} 36 36)'
			d='M0 36a36 36 0 1 0 72 0 36 36 0 0 0-72 0zm60 6l-8
				8-16-15-16 15-8-8 24-24z'/>
	</svg>`;
};
const svgCircleArrowUpUrl = svgBlobHref(svgCircleArrow(0));
const svgCircleArrowRightUrl = svgBlobHref(svgCircleArrow(90));
const svgCircleArrowDownUrl = svgBlobHref(svgCircleArrow(180));
const svgCircleArrowLeftUrl = svgBlobHref(svgCircleArrow(270));

const svgCircleLinkUrl = svgBlobHref(
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
	</svg>`);

const svgCircleRingUrl = svgBlobHref(
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72">
		<path fill="#fff" d="M36 0C16.118 0 0 16.118 0 36s16.118 36 36 36
			36-16.118 36-36S55.882 0 36 0zm0 8.5A27.5 27.5 0 0 1 63.5 36 27.5
			27.5 0 0 1 36 63.5 27.5 27.5 0 0 1 8.5 36 27.5 27.5 0 0 1 36 8.5zm0
			5A22.5 22.5 0 0 0 13.5 36 22.5 22.5 0 0 0 36 58.5 22.5 22.5 0 0 0
			58.5 36 22.5 22.5 0 0 0 36 13.5z"/>
	</svg>`);

const svgCircleSpinnerUrl = svgBlobHref(
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72">
		<path fill="#fff" d="M36 0C16.118 0 0 16.118 0 36s16.118 36 36 36
			36-16.118 36-36S55.882 0 36 0zm0 8.5A27.5 27.5 0 0 1 63.5 36 27.5
			27.5 0 0 1 36 63.5 27.5 27.5 0 0 1 8.5 36 27.5 27.5 0 0 1 36 8.5zm0
			5A22.5 22.5 0 0 0 13.5 36 22.5 22.5 0 0 0 36 58.5 22.5 22.5 0 0 0
			58.5 36 22.5 22.5 0 0 0 36 13.5z"/>
		<path fill="#fff" opacity=".75" d="M8.5 36a27.5 27.5 0 0 0 8.066
			19.434L20.1 51.9A22.5 22.5 0 0 1 13.5 36z"/>
		<path fill="#fff" opacity=".625" d="M20.1 51.9l-3.534 3.534A27.5 27.5 0
			0 0 36 63.5v-5a22.5 22.5 0 0 1-15.9-6.6z"/>
		<path fill="#fff" opacity=".125" d="M36 8.5v5a22.5 22.5 0 0 1 15.9
			6.6l3.534-3.534A27.5 27.5 0 0 0 36 8.5z"/>
		<path fill="#fff" d="M36 8.5a27.5 27.5 0 0 0-19.434 8.066L20.1 20.1A22.5
			22.5 0 0 1 36 13.5v-5z"/>
		<path fill="#fff" opacity=".25" d="M55.434 16.566L51.9 20.1A22.5 22.5 0
			0 1 58.5 36h5a27.5 27.5 0 0 0-8.066-19.434z"/>
		<path fill="#fff" opacity=".375" d="M58.5 36a22.5 22.5 0 0 1-6.6
			15.9l3.534 3.534A27.5 27.5 0 0 0 63.5 36z"/>
		<path fill="#fff" opacity=".5" d="M51.9 51.9A22.5 22.5 0 0 1 36
			58.5v5a27.5 27.5 0 0 0 19.434-8.066z"/>
		<path fill="#fff" opacity=".875" d="M16.566 16.566A27.5 27.5 0 0 0 8.5
			36h5a22.5 22.5 0 0 1 6.6-15.9z"/>

		<!--animateTransform
			attributeName="transform"
			attributeType="XML"
			type="rotate"
			from="0 0 0"
			to="360 0 0"
			dur="1s"
			repeatCount="indefinite"/-->
		<!-- svg animation is too expensive - use css animation instead -->
	</svg>`);

/* -------------------------------------------------------------------------- */

entrypoint();

/* -------------------------------------------------------------------------- */