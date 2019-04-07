// ==UserScript==
// @name		Booru: Inline Gallery View
// @namespace	6930e44863619d3f19806f68f74dbf62
// @match		*://*.rule34.xxx/*
// @version		2019-04-05
// @run-at		document-end
// @grant		GM_xmlhttpRequest
// ==/UserScript==

'use strict';

/*

	known issues:
		- animated gif / video lose playback position when scale-mode changes

*/

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

const hostnameDomainTbl = {
	[`rule34.xxx`] : `r34xxx`,
	//[`gelbooru.com`] : `gelbooru`,
	//[`e621.net`] : `e621`,
	//[`danbooru.donmai.us`] : `danbooru`,
	//[`yande.re`] : `yandere`,
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

	let scaleBtnMode = state.scaleMode === `fit` ? `full` : `fit`;

	let baseHref = doc.location.href;

	let scaleHref = stateAsFragment(
		{...state, scaleMode : scaleBtnMode}, baseHref);

	let prevHref = `#`;

	let exHref = postPageUrl(state, state.currentPostId).href;

	let nextHref = `#`;

	let closeHref = stateAsFragment(
		{...state, currentPostId : undefined}, baseHref);

	view.insertAdjacentHTML(`beforeend`,
		`<div class='${qual('iv-header')} ${qual('iv-ctrls')}'>
			<a title='Toogle Size'
				class='${qual('scale')} ${qual(scaleBtnMode)}'
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
		<div class='${qual('iv-content-panel')}'>
			<div class='${qual('iv-content-stack')}'>
				<img class='${qual('iv-image')}' id='image' src=''></img>
				<img class='${qual('iv-image-sample')}' src=''></img>
				<img class='${qual('iv-image-thumbnail')}' src=''></img>
				<img class='${qual('iv-image-placeholder')}' src=''></img>
			</div>
		</div>
		<div class='${qual('iv-footer')}'>
			<!-- -->
		</div>`);

	let stackElem = enforce(view.getElementsByClassName(
		qual(`iv-content-stack`))[0]);

	let imgElem = enforce(view.getElementsByClassName(qual(`iv-image`))[0]);
	let sampleElem = enforce(view.getElementsByClassName(
		qual(`iv-image-sample`))[0]);
	let thumbnailElem = enforce(view.getElementsByClassName(
		qual(`iv-image-thumbnail`))[0]);

	let phldrElem = enforce(view.getElementsByClassName(
		qual(`iv-image-placeholder`))[0]);

	let info = await tryGetPostInfo(state, state.currentPostId);
	if (info !== null) {
		stackElem.classList.toggle(
			qual('scale-fit'), state.scaleMode === `fit`);

		{/* scroll to the placeholder when it loads: */
			let triggered = false;
			let f = ev => {
				phldrElem.removeEventListener(ev.type, f);
				if (!triggered) {
					maybeScrollIntoView(doc.defaultView, phldrElem);};
				triggered = true;
			};
			phldrElem.addEventListener(`load`, f);
			phldrElem.addEventListener(`loadedmetadata`, f);
		};

		phldrElem.src = `data:image/svg+xml,`+encodeURIComponent(
			svgEmptyPlaceholder(info.width, info.height));

		if (info.thumbnailHref) {
			thumbnailElem.src = info.thumbnailHref;
		} else {
			thumbnailElem.hidden = true;};

		if (info.sampleHref) {
			sampleElem.src = info.sampleHref;
		} else {
			sampleElem.hidden = true;};

		/* hide the resampled versions when the full image loads: */
		imgElem.addEventListener(`load`, ev => {
			thumbnailElem.hidden = true;
			sampleElem.hidden = true;
		});

		imgElem.src = info.imageHref;
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

	let ovr = ensureThumbnailOverlay(state, doc, thumb, extUrl);
	if (ovr !== null) {
		let inLink = enforce(ovr.getElementsByClassName(
			qual('thumb-in-link'))[0]);

		inLink.href = stateAsFragment(
			{...state, currentPostId : postId},
			doc.location.href);
	};
};

const ensureThumbnailOverlay = function(state, doc, thumb, extUrl) {
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

	let title = thumbnailTitle(state, thumb);

	ovr.insertAdjacentHTML(`beforeend`,
		`<a class='${qual('thumb-ex-link')}'
			title='${escapeAttr(title)}'
			href='${escapeAttr(extUrl.href)}'></a>
		<a class='${qual('thumb-in-link')}'
			title='${escapeAttr(title)}' href='#)}'></a>`);

	thumb.prepend(ovr);

	return ovr;
};

const ensureInlineView = function(state, doc, parentElem) {
	let containerElem = getInlineView(state, parentElem);

	if (parentElem && containerElem === null) {
		containerElem = doc.createElement(`div`);
		containerElem.classList.add(qual(`iv-panel`));
		parentElem.append(containerElem);
	};

	return containerElem;
};

const getInlineView = function(state, parentElem) {
	let containerElem = null;
	if (parentElem) {
		let xs = parentElem.getElementsByClassName(qual(`iv-panel`));
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

	let domain = hostnameDomainTbl[url.hostname];
	if (domain === undefined) {
		/* unknown site */
		return null;};

	return {
		currentPostId : postIdFromUrl(null, url),
		...stateFromFragment(url.hash),
		domain,
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

	let xml = resp.responseXML;
	if (!(xml instanceof Document)) {
		return null;};

	info = singlePostInfoFromGelbooruPostsElem(state, xml.documentElement);

	if (info === null || info.postId !== postId) {
		return null;};

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

const singlePostInfoFromGelbooruPostsElem = function(state, postsElem) {
	if (!(postsElem instanceof Element)
		|| postsElem.tagName !== `posts`
		|| postsElem.children.length !== 1)
	{
		return null;};

	let post = postsElem.children[0];
	if (!(post instanceof Element)
		|| post.tagName !== `post`)
	{
		return null;};

	let postId = parseInt(post.getAttribute(`id`));
	if (!isPostId(postId)) {
		return null;};

	let imageHref = post.getAttribute(`file_url`);

	let sampleHref = post.getAttribute(`sample_url`);
	if (sampleHref === imageHref) {
		sampleHref = undefined;};

	let thumbnailHref = post.getAttribute(`preview_url`);
	if (thumbnailHref === imageHref) {
		thumbnailHref = undefined;
	} else if (state.domain === `r34xxx`) {
		/* rule34 search result pages have the post id at the end of the
		thumbnail image url, but api search results don't,
		add it to avoid cache misses: */
		let url = tryParseHref(thumbnailHref);
		if (url !== null && url.search.length <= 1) {
			url.search = `?${postId}`;
			thumbnailHref = url.href;
		};
	};

	return {
		postId,
		imageHref,
		sampleHref,
		thumbnailHref,
		width : post.getAttribute(`width`)|0,
		height : post.getAttribute(`height`)|0,};
};

/* --- urls --- */

const requestPostInfoByIdUrl = function(state, postId) {
	enforce(isPostId(postId));

	let url = new URL(
		`https://rule34.xxx/?page=dapi&s=post&q=index&limit=1`);
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

const sampleImageUrl = function(state, imgPath) {
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

const maybeScrollIntoView = function(viewport /* window */, el) {
	if (!(el instanceof Element)) {
		return;};

	let rect = el.getBoundingClientRect();
	if (typeof viewport !== `object`
		||rect.left < 0
		|| rect.right > viewport.innerWidth
		|| rect.top < 0
		|| rect.bottom > viewport.innerHeight)
	{
		el.scrollIntoView({
			behavior : `instant`,});
	};
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

	`.${qual('iv-panel')} {
		display : flex;
		flex-direction : column;
		align-items : center;
		justify-content : flex-start;
	}`,

	`.${qual('iv-content-panel')} {
		display : flex;
		justify-content : center;
		align-items : center;
		min-height : 10rem;
	}`,

	`.${qual('iv-content-stack')} {
		display : grid;
	}`,

	`.${qual('iv-content-stack')} > * {
		grid-column : 1;
		grid-row : 1;
	}`,

	`.${qual('iv-content-stack')}.${qual('scale-fit')} > * {
		max-width : 100vw;
		max-height : 100vh;
	}`,

	`.${qual('iv-content-stack')} > .${qual('iv-image')} {
		z-index : 2;
	}`,

	`.${qual('iv-content-stack')} > .${qual('iv-image-sample')} {
		z-index : 1;
	}`,

	`.${qual('iv-content-stack')} > .${qual('iv-image-thumbnail')} {
		z-index : 0;
		opacity : 0.5;
	}`,


	`.${qual('iv-content-stack')} > .${qual('iv-image-sample')},
	.${qual('iv-content-stack')} > .${qual('iv-image-thumbnail')}
	{
		width : 100%;
	}`,

	`.${qual('iv-header')}, .${qual('iv-footer')} {
		max-width : 100vw;
		width : 50rem;
		min-height : 3rem;
		background-color : var(--${qual('c-base')});
	}`,

	/* --- controls --- */

	`.${qual('iv-ctrls')} {
		display : flex;
		flex-direction : row;
		align-items : stretch;
		justify-content : center;
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

	`.${qual('iv-ctrls')} > .${qual('scale')}.${qual('full')}
		> .${qual('btn-icon')}
	{
		background-image : url(${svgCircleExpandHref});
	}`,

	`.${qual('iv-ctrls')} > .${qual('scale')}.${qual('fit')}
		> .${qual('btn-icon')}
	{
		background-image : url(${svgCircleContractHref});
	}`,

	`.${qual('iv-ctrls')} > .${qual('prev')} > .${qual('btn-icon')} {
		background-image : url(${svgCircleArrowLeftHref});
	}`,

	`.${qual('iv-ctrls')} > .${qual('ex')}:hover {
		background-color : var(--${qual('c-ex-link')});
	}`,

	`.${qual('iv-ctrls')} > .${qual('ex')} > .${qual('btn-icon')} {
		background-image : url(${svgCircleLinkHref});
	}`,

	`.${qual('iv-ctrls')} > .${qual('next')} > .${qual('btn-icon')} {
		background-image : url(${svgCircleArrowRightHref});
	}`,

	`.${qual('iv-ctrls')} > .${qual('close')}:hover {
		background-color : var(--${qual('c-iv-action')});
	}`,

	`.${qual('iv-ctrls')} > .${qual('close')} > .${qual('btn-icon')} {
		background-image : url(${svgCircleArrowUpHref});
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
		background-image : url(${svgCircleLinkHref});
		background-color : var(--${qual('c-ex-link')});
	}`,

	`.thumb > .${qual('thumb-overlay')}
		> a.${qual('thumb-in-link')}:hover,
	.thumb.${qual('selected')} > .${qual('thumb-overlay')}
		> a.${qual('thumb-in-link')}
	{
		background-image : url(${svgCircleArrowDownHref});
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
	return `<svg xmlns='http://www.w3.org/2000/svg'`
		+` width='${w|0}' height='${h|0}'><path/></svg>`;
};

const svgCircleArrow = function(rot = 0) {
	return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 72 72'>
		<path fill='#fff'
			transform='rotate(${rot|0} 36 36)'
			d='M0 36a36 36 0 1 0 72 0 36 36 0 0 0-72 0zm60 6l-8
				8-16-15-16 15-8-8 24-24z'/>
	</svg>`;
};
const svgCircleArrowUpHref = svgBlobHref(svgCircleArrow(0));
const svgCircleArrowRightHref = svgBlobHref(svgCircleArrow(90));
const svgCircleArrowDownHref = svgBlobHref(svgCircleArrow(180));
const svgCircleArrowLeftHref = svgBlobHref(svgCircleArrow(270));

const svgCircleLinkHref = svgBlobHref(
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

const svgCircleRingHref = svgBlobHref(
	`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 72 72'>
		<path fill='#fff' d='M36 0C16.118 0 0 16.118 0 36s16.118 36 36 36
			36-16.118 36-36S55.882 0 36 0zm0 8.5A27.5 27.5 0 0 1 63.5 36 27.5
			27.5 0 0 1 36 63.5 27.5 27.5 0 0 1 8.5 36 27.5 27.5 0 0 1 36 8.5zm0
			5A22.5 22.5 0 0 0 13.5 36 22.5 22.5 0 0 0 36 58.5 22.5 22.5 0 0 0
			58.5 36 22.5 22.5 0 0 0 36 13.5z'/>
	</svg>`);

const svgCircleSpinnerHref = svgBlobHref(
	`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 72 72'>
		<path fill='#fff' d='M36 0C16.118 0 0 16.118 0 36s16.118 36 36 36
			36-16.118 36-36S55.882 0 36 0zm0 8.5A27.5 27.5 0 0 1 63.5 36 27.5
			27.5 0 0 1 36 63.5 27.5 27.5 0 0 1 8.5 36 27.5 27.5 0 0 1 36 8.5zm0
			5A22.5 22.5 0 0 0 13.5 36 22.5 22.5 0 0 0 36 58.5 22.5 22.5 0 0 0
			58.5 36 22.5 22.5 0 0 0 36 13.5z'/>
		<path fill='#fff' opacity='.75' d='M8.5 36a27.5 27.5 0 0 0 8.066
			19.434L20.1 51.9A22.5 22.5 0 0 1 13.5 36z'/>
		<path fill='#fff' opacity='.625' d='M20.1 51.9l-3.534 3.534A27.5 27.5 0
			0 0 36 63.5v-5a22.5 22.5 0 0 1-15.9-6.6z'/>
		<path fill='#fff' opacity='.125' d='M36 8.5v5a22.5 22.5 0 0 1 15.9
			6.6l3.534-3.534A27.5 27.5 0 0 0 36 8.5z'/>
		<path fill='#fff' d='M36 8.5a27.5 27.5 0 0 0-19.434 8.066L20.1 20.1A22.5
			22.5 0 0 1 36 13.5v-5z'/>
		<path fill='#fff' opacity='.25' d='M55.434 16.566L51.9 20.1A22.5 22.5 0
			0 1 58.5 36h5a27.5 27.5 0 0 0-8.066-19.434z'/>
		<path fill='#fff' opacity='.375' d='M58.5 36a22.5 22.5 0 0 1-6.6
			15.9l3.534 3.534A27.5 27.5 0 0 0 63.5 36z'/>
		<path fill='#fff' opacity='.5' d='M51.9 51.9A22.5 22.5 0 0 1 36
			58.5v5a27.5 27.5 0 0 0 19.434-8.066z'/>
		<path fill='#fff' opacity='.875' d='M16.566 16.566A27.5 27.5 0 0 0 8.5
			36h5a22.5 22.5 0 0 1 6.6-15.9z'/>

		<!--animateTransform
			attributeName='transform'
			attributeType='XML'
			type='rotate'
			from='0 0 0'
			to='360 0 0'
			dur='1s'
			repeatCount='indefinite'/-->
		<!-- svg animation is too expensive - use css animation instead -->
	</svg>`);

const svgCircleExpandHref = svgBlobHref(
	`<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72'>
		<path fill='#fff' d='M35.999 0a36.187 36.187 0 0 0-5.86.488c-.337`+
			`.055-.675.105-1.011.17l-.006.002c-.565.11-1.129.232-1.69.369l-.00`+
			`3.002c-.561.137-1.121.287-1.676.451l-.004.002c-.555.165-1.106.342`+
			`-1.654.533-.192.067-.38.145-.57.215-.357.132-.716.26-1.07.403 0 0`+
			`-.002 0-.003.002-.54.219-1.076.452-1.607.699-.002 0-.004 0-.006.0`+
			`02-.531.246-1.056.507-1.576.781-.352.185-.698.385-1.045.582-.168.`+
			`096-.34.183-.506.281l-.006.004c-.51.301-1.015.615-1.512.944l-.004`+
			`.003c-.177.118-.35.245-.525.366a35.9 35.9 0 0 0-2.383 1.773l-.006`+
			`.004c-.47.383-.93.78-1.385 1.19l-.006.003a36.642 36.642 0 0 0-2.6`+
			`15 2.618l-.004.003c-.41.455-.808.917-1.191 1.387l-.004.004c-.383.`+
			`47-.751.947-1.107 1.432-.312.423-.608.855-.899 1.289-.042.063-.08`+
			`9.124-.13.187l-.005.006a35.692 35.692 0 0 0-3.146 5.918c-.047.113`+
			`-.1.225-.147.338 0 .002 0 .004-.002.006-.218.54-.423 1.085-.615 1`+
			`.633-.068.195-.126.393-.191.59-.118.356-.24.711-.346 1.07v.004a35`+
			`.908 35.908 0 0 0-.453 1.674v.004a36.032 36.032 0 0 0-.84 4.912c-`+
			`.007.068-.019.136-.025.205v.002a36.147 36.147 0 0 0-.123 1.72v.00`+
			`4a36.245 36.245 0 0 0 0 3.452v.002c.027.574.068 1.15.123 1.722.00`+
			`6.07.018.138.025.207.1.981.24 1.958.42 2.93.018.095.03.192.049.28`+
			`7v.002c.11.567.234 1.131.371 1.693v.002a35.834 35.834 0 0 0 2.305`+
			` 6.586l.002.002a35.69 35.69 0 0 0 4.736 7.56v.003a36.426 36.426 0`+
			` 0 0 8.117 7.346l.002.002c.498.329 1.003.643 1.514.945l.002.002c.`+
			`51.301 1.027.589 1.549.863a35.773 35.773 0 0 0 1.584.783s0 .002.0`+
			`02.002c.532.247 1.068.478 1.61.698.337.137.678.258 1.019.384.206.`+
			`077.41.162.617.235h.002c.549.192 1.102.37 1.658.535h.002c.556.165`+
			` 1.114.316 1.676.453h.004c.56.137 1.125.262 1.691.371h.004c.19.03`+
			`7.383.064.574.098.868.153 1.74.28 2.615.369.078.008.155.02.233.02`+
			`7h.002A36.146 36.146 0 0 0 36 72c1.29 0 2.578-.075 3.861-.213a36.`+
			`137 36.137 0 0 0 3.01-.445c.197-.038.392-.087.588-.129a35.985 35.`+
			`985 0 0 0 2.787-.695c.36-.107.717-.228 1.074-.346.557-.184 1.11-.`+
			`382 1.659-.594.187-.072.377-.137.564-.212l.006-.002c.542-.22 1.07`+
			`9-.454 1.611-.702.171-.079.338-.17.508-.252a35.66 35.66 0 0 0 2.6`+
			`25-1.396c.51-.302 1.017-.616 1.516-.945 0 0 0-.002.002-.002.497-.`+
			`329.987-.67 1.47-1.026l.006-.004a36.188 36.188 0 0 0 2.612-2.123c`+
			`.069-.061.142-.117.21-.18.002 0 .003-.002.004-.003.046-.042.09-.0`+
			`87.135-.13.407-.37.81-.75 1.203-1.144.44-.439.866-.886 1.278-1.34`+
			`1l.006-.006a36.11 36.11 0 0 0 2.3-2.823l.004-.004c.356-.484.699-.`+
			`974 1.028-1.472 0-.001 0-.003.002-.004a35.827 35.827 0 0 0 1.81-3`+
			`.063l.002-.006c.088-.167.167-.338.252-.507a35.77 35.77 0 0 0 1.22`+
			`9-2.682l.002-.004c.053-.132.098-.267.15-.4.16-.411.322-.823.467-1`+
			`.239.124-.354.235-.712.347-1.07.062-.196.132-.39.19-.588a35.97 35`+
			`.97 0 0 0 .451-1.676v-.003c.137-.562.262-1.126.371-1.692v-.004c.0`+
			`37-.19.064-.383.098-.574.153-.868.28-1.74.369-2.615.008-.078.02-.`+
			`155.027-.233v-.002a36.24 36.24 0 0 0 .123-1.72v-.004c.028-.574.04`+
			`1-1.148.041-1.723v-.004c0-.575-.013-1.15-.04-1.724v-.002a36.155 3`+
			`6.155 0 0 0-.124-1.721v-.002a36.22 36.22 0 0 0-.205-1.717v-.002c-`+
			`.082-.57-.18-1.138-.289-1.705v-.002c-.024-.123-.055-.246-.08-.37a`+
			`35.924 35.924 0 0 0-1.897-6.3 35.744 35.744 0 0 0-6.63-10.565 36.`+
			`072 36.072 0 0 0-9.992-7.771 35.746 35.746 0 0 0-4.831-2.098c-.37`+
			`2-.13-.75-.245-1.125-.363A35.944 35.944 0 0 0 41.661.455c-.164-.0`+
			`26-.326-.06-.49-.084h-.004c-.57-.082-1.14-.152-1.713-.207h-.004A3`+
			`6.226 36.226 0 0 0 37.73.04h-.004A36.205 36.205 0 0 0 35.999 0zm-`+
			`3.027 16.425h22.603l-.451 22.153-7.686-.453V24.562l-14.015-.451zM`+
			`16.876 33.422l7.685.453v13.562l14.016.451.451 7.686H16.425z'/>
	</svg>`);

const svgCircleContractHref = svgBlobHref(
	`<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72'>
		<path fill='#fff' d='M35.999 0a36.187 36.187 0 0 0-5.86.488c-.337`+
			`.055-.675.105-1.011.17l-.006.002a36.05 36.05 0 0 0-1.69.369l-.003`+
			`.002c-.561.137-1.121.287-1.676.451l-.004.002c-.555.165-1.106.342-`+
			`1.654.533-.192.067-.38.145-.57.215-.357.132-.716.26-1.07.403 0 0-`+
			`.002 0-.003.002-.54.219-1.076.452-1.607.699-.002 0-.004 0-.006.00`+
			`2-.531.246-1.056.507-1.576.781-.352.185-.698.385-1.045.582-.168.0`+
			`96-.34.183-.506.281l-.006.004c-.51.301-1.015.615-1.512.944l-.004.`+
			`003c-.177.118-.35.245-.525.366a35.9 35.9 0 0 0-2.383 1.773l-.006.`+
			`004c-.47.383-.93.78-1.385 1.19l-.006.003a36.643 36.643 0 0 0-2.61`+
			`5 2.618l-.004.003c-.41.455-.808.917-1.191 1.387l-.004.004c-.383.4`+
			`7-.751.947-1.107 1.432-.312.423-.608.855-.899 1.289-.042.063-.089`+
			`.124-.13.187l-.005.006a35.692 35.692 0 0 0-3.146 5.918c-.047.113-`+
			`.1.225-.147.338 0 .002 0 .004-.002.006-.218.54-.423 1.085-.615 1.`+
			`633-.068.195-.126.393-.191.59-.118.356-.24.711-.346 1.07v.004a35.`+
			`908 35.908 0 0 0-.453 1.674v.004a36.032 36.032 0 0 0-.84 4.912c-.`+
			`007.068-.019.136-.025.205v.002a36.147 36.147 0 0 0-.123 1.72v.004`+
			`a36.245 36.245 0 0 0 0 3.452v.002c.027.574.068 1.15.123 1.722.006`+
			`.07.018.138.025.207.1.981.24 1.958.42 2.93.018.095.03.192.049.287`+
			`v.002c.11.567.234 1.131.371 1.693v.002a35.834 35.834 0 0 0 2.305 `+
			`6.586l.002.002a35.69 35.69 0 0 0 4.736 7.56v.003a36.426 36.426 0 `+
			`0 0 8.117 7.346l.002.002c.498.329 1.003.643 1.514.945l.002.002c.5`+
			`1.301 1.027.589 1.549.863l.002.002c.521.274 1.05.535 1.582.781l.0`+
			`02.002c.532.247 1.068.478 1.61.698.337.137.678.258 1.019.384.206.`+
			`077.41.162.617.235h.002c.549.192 1.102.37 1.658.535h.002c.556.165`+
			` 1.114.316 1.676.453h.004c.56.137 1.125.262 1.691.371h.004c.19.03`+
			`7.383.064.574.098.868.153 1.74.28 2.615.369.078.008.155.02.233.02`+
			`7h.002A36.146 36.146 0 0 0 36 72c1.29 0 2.578-.075 3.861-.213a36.`+
			`137 36.137 0 0 0 3.01-.445c.197-.038.392-.087.588-.129a35.985 35.`+
			`985 0 0 0 2.787-.695c.36-.107.717-.228 1.074-.346.557-.184 1.11-.`+
			`382 1.659-.594.187-.072.377-.137.564-.212l.006-.002c.542-.22 1.07`+
			`9-.454 1.611-.702.171-.079.338-.17.508-.252a35.66 35.66 0 0 0 2.6`+
			`25-1.396c.51-.302 1.017-.616 1.516-.945l.002-.002c.497-.329.987-.`+
			`67 1.47-1.026l.006-.004a36.188 36.188 0 0 0 2.612-2.123c.069-.061`+
			`.142-.117.21-.18.002 0 .003-.002.004-.003.046-.042.09-.087.135-.1`+
			`3.407-.37.81-.75 1.203-1.144.44-.439.866-.886 1.278-1.341l.006-.0`+
			`06a36.11 36.11 0 0 0 2.3-2.823l.004-.004c.356-.484.699-.974 1.028`+
			`-1.472 0-.001 0-.003.002-.004a35.827 35.827 0 0 0 1.81-3.063l.002`+
			`-.006c.088-.167.167-.338.252-.507a35.77 35.77 0 0 0 1.229-2.682l.`+
			`002-.004c.053-.132.098-.267.15-.4.16-.411.322-.823.467-1.239.124-`+
			`.354.235-.712.347-1.07.062-.196.132-.39.19-.588a35.97 35.97 0 0 0`+
			` .451-1.676v-.003c.137-.562.262-1.126.371-1.692v-.004c.037-.19.06`+
			`4-.383.098-.574.153-.868.28-1.74.369-2.615.008-.078.02-.155.027-.`+
			`233v-.002a36.24 36.24 0 0 0 .123-1.72v-.004c.028-.574.041-1.148.0`+
			`41-1.723v-.004c0-.575-.013-1.15-.04-1.725v-.002a36.155 36.155 0 0`+
			` 0-.124-1.72v-.003a36.223 36.223 0 0 0-.205-1.716v-.002c-.082-.57`+
			`-.18-1.139-.289-1.706v-.002c-.024-.123-.055-.245-.08-.369a35.933 `+
			`35.933 0 0 0-1.896-6.3 35.899 35.899 0 0 0-4.325-7.74 36.14 36.14`+
			` 0 0 0-3.584-4.168 36.072 36.072 0 0 0-8.715-6.428 35.746 35.746 `+
			`0 0 0-4.83-2.098c-.372-.13-.75-.245-1.125-.363A35.944 35.944 0 0 `+
			`0 41.661.455c-.164-.026-.326-.06-.49-.084h-.004c-.57-.082-1.14-.1`+
			`52-1.713-.207h-.004A36.226 36.226 0 0 0 37.73.04h-.004A36.205 36.`+
			`205 0 0 0 35.999 0zm2.877 11.422l7.685.453v13.562l14.016.451.451 `+
			`7.686H38.425zM10.972 38.425h22.603l-.451 22.153-7.686-.453V46.562`+
			`l-14.015-.451z'/>
	</svg>`);

/* -------------------------------------------------------------------------- */

entrypoint();

/* -------------------------------------------------------------------------- */