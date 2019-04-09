// ==UserScript==
// @name		Booru: Inline Gallery View
// @namespace	6930e44863619d3f19806f68f74dbf62
// @match		*://rule34.xxx/*
// @match		*://e621.net/*
// @match		*://danbooru.donmai.us/*
// @match		*://realbooru.com/*
// @version		2019-04-09
// @downloadURL	https://github.com/bipface/userscripts/raw/master/booru-inline-gallery-view.user.js
// @run-at		document-end
// @grant		GM_xmlhttpRequest
// ==/UserScript==

'use strict';

/*

	known issues:
		- doesn't work on gelbooru or yandere, yet
		- animated gif / video loses playback position when scale-mode changes
		- controls typically end up off-screen; hinders navigation by clicking
			(mainly affects mobile browsing)
		- can't navigate when search query includes sort:* / order:*
		- won't work with danbooru's zip-player videos
		- 2-tag search limit on danbooru breaks navigation
		- loading full-size images may not always be desirable
			(e.g. mobile browsing with small data allowance)
		- scale-mode 'full' doesn't seem to work well on rule34's mobile layout
		- media type badge is misaligned on e621 thumbnails
		- stateAsFragment() should optimise away redundant fields

*/

/* -------------------------------------------------------------------------- */

const dbg = true;
const unittests = dbg ? [] : null;
const test =
	dbg
		? f => unittests.push(f)
		: () => {};

const entrypoint = function() {
	if (!isGalleryUrl(tryParseHref(location.href))) {
		return;};

	document.addEventListener(`keydown`, onKeyDown, true);

	window.addEventListener(
		`hashchange`,
		ev => applyToDocument(ev.target.document, ev.newURL),
		false);

	applyToDocument(document, location.href);
};

const onKeyDown = function(ev) {
	/* global hotkeys: */

	if (ev.key === `ArrowRight` || ev.key === `Right`) {
		let btn = getSingleElemByClass(ev.target, qual(`prev`));
		if (btn instanceof HTMLElement) {
			btn.click();
			ev.stopPropagation();};

	} else if (ev.key === `ArrowLeft` || ev.key === `Left`) {
		let btn = getSingleElemByClass(ev.target, qual(`next`));
		if (btn instanceof HTMLElement) {
			btn.click();
			ev.stopPropagation();};
	};
};

/* -------------------------------------------------------------------------- */

/*
	state : {
		origin : `protocol://hostname:port`,
		domain : string,
		searchQuery : string,
		currentPostId : int,
		scaleMode : `fit` / `full`,
	}
*/

const namespace = `inline-gallery-view`;

const qual = function(n) {
	return namespace+`-`+n;
};

const hostnameDomainTbl = {
	[`rule34.xxx`] : `r34xxx`,
	[`gelbooru.com`] : `gelbooru`,
	[`e621.net`] : `e621`,
	[`danbooru.donmai.us`] : `danbooru`,
	[`yande.re`] : `yandere`,
	[`safebooru.org`] : `safebooru`,
	[`realbooru.com`] : `realbooru`,
};

const domainKindTbl = {
	e621 : `danbooru`,
	danbooru : `danbooru`,
	yandere : `danbooru`,
	r34xxx : `gelbooru`,
	gelbooru : `gelbooru`,
	safebooru : `gelbooru`,
	realbooru : `gelbooru`,
};

const applyToDocument = function(doc, href) {
	enforce(doc instanceof HTMLDocument);

	let url = tryParseHref(href);
	if (!isGalleryUrl(url)) {return;};

	let state = stateFromUrl(url);
	if (state === null) {return;};

	ensureApplyStyleRules(doc, () => getGlobalStyleRules(state.domain));

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
	dbg && assert(isPostId(state.currentPostId));

	while (view.hasChildNodes()) {
		view.removeChild(view.firstChild);};

	let scaleBtnMode = state.scaleMode === `fit` ? `full` : `fit`;

	let baseHref = doc.location.href;

	let scaleHref = stateAsFragment(
		{...state, scaleMode : scaleBtnMode}, baseHref);

	let exHref = postPageUrl(state, state.currentPostId).href;

	let closeHref = stateAsFragment(
		{...state, currentPostId : undefined}, baseHref);

	view.insertAdjacentHTML(`beforeend`,
		`<div class='${qual('iv-header')} ${qual('iv-ctrls')}'>
			<a title='Toggle Size'
				class='${qual('scale')} ${qual(scaleBtnMode)}'
				href='${escapeAttr(scaleHref)}'>
				<figure class='${qual('btn-icon')}'></figure></a>

			<a title='Next' class='${qual('next')}' href='#'>
				<figure class='${qual('btn-icon')}'></figure></a>

			<a title='#${state.currentPostId}' class='${qual('ex')}'
				href='${escapeAttr(exHref)}'>
				<figure class='${qual('btn-icon')}'></figure></a>

			<a title='Previous' class='${qual('prev')}' href='#'>
				<figure class='${qual('btn-icon')}'></figure></a>

			<a title='Close' class='${qual('close')}'
				href='${escapeAttr(closeHref)}'>
				<figure class='${qual('btn-icon')}'></figure></a>
		</div>
		<div class='${qual('iv-content-panel')}'>
			<div class='${qual('iv-content-stack')}'>
				<img class='${qual('iv-media')} ${qual('iv-image')}'
					hidden=''></img>

				<video class='${qual('iv-media')} ${qual('iv-video')}'
					hidden='' controls='' loop=''></video>

				<img class='${qual('iv-media-sample')}' hidden=''></img>

				<img class='${qual('iv-media-thumbnail')}' hidden=''></img>

				<img class='${qual('iv-media-placeholder')}'></img>
			</div>
		</div>
		<div class='${qual('iv-footer')}'>
			<!-- -->
		</div>`);

	let stackElem = enforce(getSingleElemByClass(
		view, qual(`iv-content-stack`)));

	let imgElem = enforce(getSingleElemByClass(view, qual(`iv-image`)));

	let vidElem = enforce(getSingleElemByClass(view, qual(`iv-video`)));

	let sampleElem = enforce(getSingleElemByClass(
		view, qual(`iv-media-sample`)));

	let thumbnailElem = enforce(getSingleElemByClass(
		view, qual(`iv-media-thumbnail`)));

	let phldrElem = enforce(getSingleElemByClass(
		view, qual(`iv-media-placeholder`)));

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
			thumbnailElem.hidden = false;};

		if (info.type === `video`) {
			vidElem.src = info.imageHref;
			vidElem.hidden = false;

		} else {
			if (info.sampleHref) {
				sampleElem.src = info.sampleHref;
				sampleElem.hidden = false;
			};

			/* hide the resampled versions when the full image loads: */
			imgElem.addEventListener(`load`, ev => {
				thumbnailElem.hidden = true;
				thumbnailElem.src = ``;
				sampleElem.hidden = true;
				sampleElem.src = ``;
			});

			imgElem.src = info.imageHref;
			imgElem.hidden = false;
		};
	};

	let prevBtn = enforce(getSingleElemByClass(view, qual(`prev`)));
	let nextBtn = enforce(getSingleElemByClass(view, qual(`next`)));

	if (searchQueryContainsOrderTerm(state, state.searchQuery)) {
		/* navigation cannot work when using non-default sort order */
		prevBtn.classList.add(qual(`disabled`));
		nextBtn.classList.add(qual(`disabled`));
	} else {
		bindNavigationButton(state, doc, prevBtn, `prev`);
		bindNavigationButton(state, doc, nextBtn, `next`);
	};

	let closeBtn = enforce(getSingleElemByClass(view, qual(`close`)));
	/* when closing, return to the corresponding thumbnail: */
	closeBtn.addEventListener(`click`, () =>
		onCloseInlineView(state, doc), false);
};

const onCloseInlineView = function(state, doc) {
	maybeScrollIntoView(doc.defaultView,
		doc.getElementById(`post_${state.currentPostId}`) /* danbooru */
		|| doc.getElementById(`p${state.currentPostId}`) /* others */,
		`instant` /* smooth scroll can fail due to changing page height */);
};

const bindNavigationButton = function(state, doc, btn, direction) {
	enforce(btn instanceof HTMLAnchorElement);
	enforce(direction === `prev` || direction === `next`);

	primeNavigationButton(state, doc, btn, direction);

	let onClick = ev => {
		if (!btn.classList.contains(qual(`ready`))) {
			primeNavigationButton(state, doc, btn, direction);
			if (ev) {
				ev.preventDefault();
				ev.stopPropagation();};
		};
	};

	btn.addEventListener(`click`, onClick, false);
};

const primeNavigationButton = async function(state, doc, btn, direction) {
	enforce(btn instanceof HTMLAnchorElement);
	enforce(direction === `prev` || direction === `next`);
	enforce(isPostId(state.currentPostId));

	if (btn.classList.contains(qual(`pending`))
		|| btn.classList.contains(qual(`ready`)))
	{
		return;};

	btn.classList.add(qual(`pending`));

	let info;
	try {
		info = await tryNavigatePostInfo(
			state, state.currentPostId, direction, state.searchQuery);
	} finally {
		btn.classList.remove(qual(`pending`));};

	if (info === null) {
		return;};

	btn.href = stateAsFragment(
		{...state, currentPostId : info.postId},
		doc.location.href);

	btn.classList.add(qual(`ready`));
};

const bindThumbnailsList = function(state, doc, thumbsParent) {
	for (let thumb of thumbsParent.children) {
		bindThumbnail(state, doc, thumb);};
};

const bindThumbnail = function(state, doc, thumb) {
	let info = thumbnailInfo(state, thumb);
	if (info === null) {
		return null;};

	thumb.classList.toggle(qual(`selected`),
		info.postId === state.currentPostId);

	let ovr = ensureThumbnailOverlay(state, doc, thumb, info.url);
	if (ovr !== null) {
		let inLink = enforce(getSingleElemByClass(ovr, qual('thumb-in-link')));

		inLink.href = stateAsFragment(
			{...state,
				currentPostId : (
					state.currentPostId === info.postId
						? undefined
						: info.postId)},
			doc.location.href);
	};
};

const ensureThumbnailOverlay = function(state, doc, thumb, extUrl) {
	enforce(thumb instanceof HTMLElement);

	let ovr = getSingleElemByClass(thumb, qual(`thumb-overlay`));
	if (ovr !== null) {
		return ovr;};

	ovr = doc.createElement(`div`);
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
	let ivPanel = getInlineView(state, parentElem);

	if (parentElem !== null && ivPanel === null) {
		ivPanel = doc.createElement(`div`);
		ivPanel.classList.add(qual(`iv-panel`));
		parentElem.append(ivPanel);
	};

	return ivPanel;
};

const getInlineView = function(state, parentElem) {
	let ivPanel = null;
	if (parentElem instanceof Element) {
		ivPanel = getSingleElemByClass(parentElem, qual(`iv-panel`));};

	if (!(ivPanel instanceof HTMLDivElement)) {
		return null;};

	return ivPanel;
};

const getInlineViewParent = function(state, doc) {
	return getSingleElemByClass(doc, `content-post`) /* gelbooru */
		|| getSingleElemByClass(doc, `content`) /* e621 */
		|| doc.getElementById(`content`) /* danbooru */;
};

const getThumbnailsParent = function(state, doc) {
	let outerElem = getInlineViewParent(state, doc);
	if (outerElem === null) {
		return null;};

	let firstThumb = outerElem.getElementsByClassName(
		getThumbClass(state)).item(0);
	if (firstThumb === null) {
		return null;};

	return firstThumb.parentElement;
};

const thumbnailInfo = function(state, elem) {
	enforce(elem instanceof HTMLElement);

	let info = null;
	for (let c of elem.children) {
		if (!(c instanceof HTMLAnchorElement)) {
			continue;}

		let url = tryParseHref(c.href);
		if (url === null) {
			continue;};

		let postId = postIdFromUrl(state, url);
		if (!isPostId(postId)) {
			continue;};

		if (info !== null) {
			/* thumbnail has multiple <a> children */
			return null;};

		info = {postId, url};
	};

	return info;
};

const thumbnailTitle = function(state, elem) {
	enforce(elem instanceof HTMLElement);

	let xs = getSingleElemByClass(elem, `preview`);
	if (xs === null) {
		return ``;};

	return xs.title.trim();
};

const isPostId = function(id) {
	return (id|0) === id && id >= 0;
};

const domainKindOrderTermPrefixTbl = {
	danbooru : `order:`,
	gelbooru : `sort:`,
};

const searchQueryContainsOrderTerm = function(state, searchQuery) {
	/* navigation cannot work when using non-default sort order */
	if (searchQuery === undefined) {
		return false;};

	let orderPrefix = domainKindOrderTermPrefixTbl[getDomainKind(state)];
	if (orderPrefix === undefined) {
		return false;};

	if (typeof searchQuery === `string`) {
		for (let s of searchQuery.split(/\s/)) {
			if (s.length === 0) {
				continue;};

			s = s.toLowerCase();
			if (s.startsWith(orderPrefix)) {
				return true;};
		};
	};

	return false;
};

const getDomainKind = function({domain}) {
	enforce(typeof domain === `string`);
	let k = domainKindTbl[domain];
	enforce(typeof k === `string`);
	return k;
};

const getThumbClass = function({domain}) {
	enforce(typeof domain === `string`);
	return domain === `danbooru`
		? `post-preview`
		: `thumb`;
};

/* --- post info --- */

/*

	note: post info is retained indefinitely, so it should only store
	immutable attributes (file type, dimensions, etc.).

*/

const postInfoTbl = new Map(); /* postId → postInfo */

const tryGetPostInfo = async function(state, postId) {
	enforce(isPostId(postId));

	let info = postInfoTbl.get(postId);
	if (info !== undefined) {
		dbg && assert(typeof info === `object`);
		return info;};

	info = null;

	let resp = await tryHttpGet(
		requestPostInfoByIdUrl(state, postId));
	if (resp === null) {
		return null;};

	switch (getDomainKind(state)) {
		case `danbooru` :
			let respObj = tryParseJson(resp.responseText);
			if (typeof respObj !== `object`) {
				return null;};

			info = singlePostInfoFromDanbooruApiPostsList(state, respObj);
			break;

		case `gelbooru` :
			let xml = resp.responseXML;
			if (!(xml instanceof Document)) {
				return null;};

			info = singlePostInfoFromGelbooruApiPostsElem(
				state, xml.documentElement);
			break;
	};


	if (info === null || info.postId !== postId) {
		return null;};

	postInfoTbl.set(postId, info);

	return info;
};

const apiRequPostIdCache = new Map(); /* href → postId */

const apiRequPostIdCacheExpireMs = 30000;

const tryNavigatePostInfo = async function(
	state, fromPostId, direction, searchQuery)
{
	enforce(isPostId(fromPostId));
	enforce(direction === `prev` || direction === `next`);

	let requUrl = requestNavigatePostInfoUrl(
		state, fromPostId, direction, searchQuery);
	if (requUrl === null) {
		return null;};

	let cacheKey = requUrl.href;
	let postId = apiRequPostIdCache.get(cacheKey);
	if (isPostId(postId)) {
		let info = postInfoTbl.get(postId);
		if (info !== undefined) {
			dbg && assert(typeof info === `object`);
			return info;};
	};

	let resp = await tryHttpGet(requUrl);
	if (resp === null) {
		return null;};

	let info = null;
	switch (getDomainKind(state)) {
		case `danbooru` :
			let respObj = tryParseJson(resp.responseText);
			if (typeof respObj !== `object`) {
				return null;};
			info = singlePostInfoFromDanbooruApiPostsList(state, respObj);
			break;

		case `gelbooru` :
			let xml = resp.responseXML;
			if (!(xml instanceof Document)) {
				return null;};
			info = singlePostInfoFromGelbooruApiPostsElem(
				state, xml.documentElement);
			break;
	};

	if (info === null) {
		return null;};
	dbg && assert(isPostId(info.postId));

	postInfoTbl.set(info.postId, info);

	apiRequPostIdCache.set(cacheKey, info.postId);
	setTimeout(
		() => apiRequPostIdCache.delete(cacheKey),
		apiRequPostIdCacheExpireMs);

	return info;
};

const singlePostInfoFromDanbooruApiPostsList = function(state, posts) {
	if (!Array.isArray(posts) || posts.length !== 1) {
		return null;};

	let post = posts[0];
	if (typeof post !== `object` || post === null) {
		return null;};

	if (!isPostId(post.id)) {
		return null;};

	let imageHref = post.file_url;

	let sampleHref = post.large_file_url || post.sample_url;
	if (sampleHref === imageHref) {
		sampleHref = undefined;};

	let thumbnailHref = post.preview_file_url || post.preview_url;
	if (thumbnailHref === imageHref) {
		thumbnailHref = undefined;};

	return {
		postId : post.id,
		type : getMediaType(imageHref),
		imageHref,
		sampleHref,
		thumbnailHref,
		width : (post.image_width || post.width)|0,
		height : (post.image_height || post.height)|0,};
};

const singlePostInfoFromGelbooruApiPostsElem = function(state, postsElem) {
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

	let postId = tryParsePostId(post.getAttribute(`id`));
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
		type : getMediaType(imageHref),
		imageHref,
		sampleHref,
		thumbnailHref,
		width : post.getAttribute(`width`)|0,
		height : post.getAttribute(`height`)|0,};
};

const getMediaType = function(href) {
	let type = `image`;

	let url = tryParseHref(href);
	if (url !== null) {
		let p = url.pathname.toLowerCase();
		if (p.endsWith(`.webm`) || p.endsWith(`.mp4`)) {
			type = `video`;
		} else if (p.endsWith(`.swf`)) {
			type = `flash`;
		};
	};

	return type;
};

/* --- urls --- */

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

const stateFromUrl = function(url) {
	if (!(url instanceof URL)) {
		return null;};

	let domain = hostnameDomainTbl[url.hostname];
	if (domain === undefined) {
		/* unknown site */
		return null;};

	return {
		currentPostId : postIdFromUrl({domain}, url),
		scaleMode : `fit`,
		...stateFromFragment(url.hash),
		origin : url.origin,
		domain,
		searchQuery : searchQueryFromUrl({domain}, url),};
};

test(_ => {
	/* e621 search queries */

	let url = new URL(`https://e621.net`);
	for (let [path, queryString, expect] of [
		[`/post`, ``, undefined],
		[`/post/`, ``, undefined],
		[`/post/index`, ``, undefined],
		[`/post/index/`, ``, undefined],
		[`/post/index/1`, ``, undefined],
		[`/post/index/1/`, ``, undefined],
		[`/post/index/1/id:<1837141 order:id`, ``, `id:<1837141 order:id`],
		[`/post/index/1/id:<1837141 order:id/`, ``, `id:<1837141 order:id`],
		[`/post/index/1/id:<1837141 order:id//`, ``, undefined],
		[`/post/index/1/id:<1837141 order:id/asdf`, ``, undefined],
		[`/post/index//id:<1837141 order:id`, ``, undefined],
		[`/post/index/1//id:<1837141 order:id`, ``, undefined],
		[`/post/index/asdf/id:<1837141 order:id`, ``, undefined],
		[`/post`, `tags=id:<1837141 order:id`, `id:<1837141 order:id`],
		[`/post/`, `tags=id:<1837141 order:id`, `id:<1837141 order:id`],
		[`/post/index`, `tags=id:<1837141 order:id`, `id:<1837141 order:id`],
		[`/post/index/`, `tags=id:<1837141 order:id`, `id:<1837141 order:id`],
		[`/post/index/1`, `tags=id:<1837141 order:id`, `id:<1837141 order:id`],
		[`/post/index/1/`, `tags=id:<1837141 order:id`, `id:<1837141 order:id`],
		/* path takes precedence over querystring: */
		[`/post/index/1/absurdres`, `tags=id:<1837141 order:id`, `absurdres`],])
	{
		url.pathname = path;
		url.search = queryString;

		assert(isGalleryUrl(url));

		let {searchQuery} = stateFromUrl(url);
		assert(searchQuery === expect);
	};
});

test(_ => {
	/* danbooru search queries */

	let url = new URL(`https://danbooru.donmai.us`);
	for (let [path, queryString, expect] of [
		[`/`, ``, undefined],
		[`/posts`, ``, undefined],
		[`/posts/`, ``, undefined],
		[`/posts`, `tags=id:<1837141 order:id`, `id:<1837141 order:id`],
		[`/posts/`, `tags=id:<1837141 order:id`, `id:<1837141 order:id`],])
	{
		url.pathname = path;
		url.search = queryString;

		assert(isGalleryUrl(url));

		let {searchQuery} = stateFromUrl(url);
		assert(searchQuery === expect);
	};
});

test(_ => {
	/* gelbooru search queries */

	let url = new URL(`https://rule34.xxx`);
	for (let [path, queryString, expect] of [
		[`/`, `page=post&s=list&tags=all`, undefined],
		// todo
		])
	{
		url.pathname = path;
		url.search = queryString;

		assert(isGalleryUrl(url));

		let {searchQuery} = stateFromUrl(url);
		assert(searchQuery === expect);
	};
});

const searchQueryFromUrl = function({domain}, url) {
	if (!(url instanceof URL)) {
		return undefined;};

	let domainKind = getDomainKind({domain});

	let searchQuery = url.searchParams.get(`tags`);

	if (domainKind === `danbooru`
		&& domain !== `danbooru`)
	{
		let xs = tryParsePathFromUrl(url);
		if (xs !== null
			&& xs.length === 4
			&& xs[0] === `post`
			&& xs[1] === `index`
			&& /^\d+$/.test(xs[2]))
		{
			searchQuery = xs[3];
		};
	};

	if (typeof searchQuery !== `string`
		|| !/\S/.test(searchQuery))
	{
		/* contains only whitespace characters */
		return undefined;};

	searchQuery = searchQuery.trim();

	if (domainKind === `gelbooru`
		&& searchQuery === `all`)
	{
		return undefined;};

	return searchQuery;
};

const isGalleryUrl = function(url) {
	if (!(url instanceof URL)) {
		return false;};

	let domain = hostnameDomainTbl[url.hostname];
	if (domain === undefined) {
		/* unknown site */
		return false;};

	switch (getDomainKind({domain})) {
		case `danbooru` :
			let xs = tryParsePathFromUrl(url);
			if (domain === `danbooru`) {
				return xs !== null
					&& (xs.length === 0
						|| (xs.length === 1
							&& xs[0] === `posts`));
			} else {
				return xs !== null
					&& xs[0] === `post`
					&& (xs.length === 1 || xs[1] === `index`);
			};

		case `gelbooru` :
			return (url.pathname === `/` || url.pathname === `/index.php`)
				&& url.searchParams.get(`page`) === `post`
				&& url.searchParams.get(`s`) === `list`;
	};

};

test(_ => {
	assert(isGalleryUrl(new URL(
		`https://e621.net/post/index/1/absurdres?tags=id:<1837141 order:id`)));

	// todo
});

const postIdFromUrl = function({domain}, url) {
	if (!(url instanceof URL)) {
		return -1;};

	switch (getDomainKind({domain})) {
		case `danbooru` :
			let xs = tryParsePathFromUrl(url);
			if (domain === `danbooru`) {
				if (xs !== null && xs[0] === `posts`) {
					return tryParsePostId(xs[1]);};
			} else {
				if (xs !== null && xs[0] === `post` && xs[1] === `show`) {
					return tryParsePostId(xs[2]);};
			};

		case `gelbooru` :
			if ((url.pathname === `/` || url.pathname === `/index.php`)
				&& url.searchParams.get(`page`) === `post`
				&& url.searchParams.get(`s`) === `view`)
			{
				return tryParsePostId(url.searchParams.get(`id`));
			};
	};

	return -1;
};

test(_ => {
	// todo
});

const requestPostInfoByIdUrl = function(state, postId) {
	dbg && assert(isPostId(postId));

	let url = new URL(state.origin);

	switch (getDomainKind(state)) {
		case `danbooru` :
			if (state.domain === `danbooru`) {
				url.pathname = `/posts.json`;
			} else {
				url.pathname = `/post/index.json`;};

			url.searchParams.set(`limit`, `1`);
			url.searchParams.set(`tags`, `id:${postId}`);

			return url;

		case `gelbooru` :
			url.pathname = `/`;
			url.searchParams.set(`page`, `dapi`);
			url.searchParams.set(`s`, `post`);
			url.searchParams.set(`q`, `index`);
			url.searchParams.set(`limit`, `1`);
			url.searchParams.set(`tags`, `id:${postId}`);
			return url;
	};

	return null;
};

const requestNavigatePostInfoUrl = function(
	state, postId, direction, searchQuery)
{
	dbg && assert(isPostId(postId));
	dbg && assert(direction === `prev` || direction === `next`);
	dbg && assert(!searchQueryContainsOrderTerm(searchQuery));

	let url = new URL(state.origin);

	switch (getDomainKind(state)) {
		case `danbooru` : {
			if (state.domain === `danbooru`) {
				url.pathname = `/posts.json`;
			} else {
				url.pathname = `/post/index.json`;};

			url.searchParams.set(`limit`, `1`);

			let q =
				direction === `prev`
					? `id:<${postId} order:-id`
					: `id:>${postId} order:id`;

			if (typeof searchQuery === `string` && searchQuery.length !== 0) {
				q += ` `+searchQuery;};

			url.searchParams.set(`tags`, q);

			return url;
		};

		case `gelbooru` : {
			url.pathname = `/`;
			url.searchParams.set(`page`, `dapi`);
			url.searchParams.set(`s`, `post`);
			url.searchParams.set(`q`, `index`);
			url.searchParams.set(`limit`, `1`);

			let q =
				direction === `prev`
					? `id:<${postId} sort:id:desc`
					: `id:>${postId} sort:id:asc`;

			if (typeof searchQuery === `string` && searchQuery.length !== 0) {
				q += ` `+searchQuery;};

			url.searchParams.set(`tags`, q);

			return url;
		};
	};

	return null;
};

test(_ => {
	let url = requestNavigatePostInfoUrl(
		{domain : `r34xxx`, origin : `https://rule34.xxx`},
		265, `next`, `absurdres`);

	assert(url.origin === `https://rule34.xxx`);
	assert(url.pathname === `/`);
	assert(url.searchParams.get(`page`) === `dapi`);
	assert(url.searchParams.get(`s`) === `post`);
	assert(url.searchParams.get(`q`) === `index`);
	assert(url.searchParams.get(`limit`) === `1`);
	assert(url.searchParams.get(`tags`)
		=== `id:>265 sort:id:asc absurdres`);

	// todo
});

const postPageUrl = function(state, postId) {
	dbg && assert(isPostId(postId));

	let url = new URL(state.origin);

	switch (getDomainKind(state)) {
		case `danbooru` :
			if (state.domain === `danbooru`) {
				url.pathname = `/posts/${postId}`;
			} else {
				url.pathname = `/post/show/${postId}`;};
			return url;

		case `gelbooru` :
			url.pathname = `/index.php`;
			url.searchParams.set(`page`, `post`);
			url.searchParams.set(`s`, `view`);
			url.searchParams.set(`id`, `${postId}`);
			return url;
	};

	return null;
};

/* --- utilities --- */

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
			dbg && assert(typeof resp === `object` && resp !== null);
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

const getSingleElemByClass = function(scopeElem, className) {
	enforce(typeof className === `string`);
	enforce(scopeElem instanceof Element || scopeElem instanceof Document);

	let elems = scopeElem.getElementsByClassName(className);

	if (elems.length !== 1) {
		return null;};

	return elems.item(0);
};

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

const tryParsePathFromUrl = function(url) {
	if (!(url instanceof URL)) {
		return null;};

	return tryParsePath(decodeURIComponent(url.pathname));
};

test(_ => {
	let url = new URL(`https://x`)
	url.pathname = `/id:<1837141 order:id`;

	let xs = tryParsePathFromUrl(url);
	assert(xs[0] === `id:<1837141 order:id`);
});

const tryParsePath = function(s) {
	/* s is expected to already have been decoded via decodeURIComponent() */

	if (typeof s !== `string` || s.length === 0 || s[0] !== `/`) {
		return null;};

	let components = [];

	for (let i = 1, j = 1, n = s.length; i < n; ++i) {
		if (s[i] === `/`) {
			components.push(s.slice(j, i));
			j = i + 1;
		} else if (i === n - 1) {
			components.push(s.slice(j, n));
		};
	};

	return components;
};

test(_ => {
	assert(tryParsePath(``) === null);
	assert(tryParsePath(`post/`) === null);
	assert(sequiv(tryParsePath(`/`), []));
	assert(sequiv(tryParsePath(`/post`), [`post`]));
	assert(sequiv(tryParsePath(`/post/`), [`post`]));
	assert(sequiv(tryParsePath(`/post//`), [`post`, ``]));
	assert(sequiv(tryParsePath(`/post/index`), [`post`, `index`]));
	assert(sequiv(tryParsePath(`/post/index/`), [`post`, `index`]));
	assert(sequiv(tryParsePath(`/post//index`), [`post`, ``, `index`]));
	assert(sequiv(tryParsePath(`/post//index/`), [`post`, ``, `index`]));
	assert(sequiv(tryParsePath(`/post/index//`), [`post`, `index`, ``]));
});

const tryParsePostId = function(s) {
	if (typeof s !== `string`) {
		return -1;};

	let len = s.length;
	let lenNibble = len & 0b1111; /* prevent excessive iteration */
	let c0 = s.charCodeAt(0) - 48;

	let invalid =
		(lenNibble === 0)
		| (len > 10)
		| ((c0 >>> 1) > 4) /* c0 < 0 || c0 > 9 */
		| ((c0 << 3) < (lenNibble >>> 1)) /* c0 === 0 && lenNibble !== 1 */
		| (lenNibble === 10 && s > `2147483647`);

	let n = c0;
	for (let i = 1; i < lenNibble; ++i) {
		let c = s.charCodeAt(i) - 48;
		n = Math.imul(10, n) + c;
		invalid |= ((c >>> 1) > 4); /* c < 0 || c > 9 */
	};

	return n | -invalid;
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

const maybeScrollIntoView = function(
	viewport /* window */, el, behavior = `smooth`)
{
	if (!(el instanceof Element)) {
		return;};

	let rect = el.getBoundingClientRect();
	if (!viewport
		|| rect.left < 0
		|| rect.right > viewport.innerWidth
		|| rect.top < 0
		|| rect.bottom > viewport.innerHeight)
	{
		el.scrollIntoView({behavior});
	};
};

const sequiv = function(xs, ys, pred = Object.is) {
	/* compare two sequences for equivalence */

	if (xs === ys) {
		return true;};

	let xsIter = xs[Symbol.iterator]();
	let ysIter = ys[Symbol.iterator]();
	let xObj, yObj;

	dbg && assert(typeof xsIter === `object`);
	dbg && assert(typeof ysIter === `object`);

	while (true) {
		xObj = xsIter.next();
		yObj = ysIter.next();

		dbg && assert(typeof xObj === `object`);
		dbg && assert(typeof yObj === `object`);

		if (xObj.done) {
			break;};

		if (yObj.done) {
			return false;};

		if (!pred(xObj.value, yObj.value)) {
			return false;};
	};

	return yObj.done;
};

const enforce = function(cond, msg = `enforcement failed`) {
	if (!cond) {
		let x = new Error();
		throw new Error(`${msg} | ${x.stack}`);
	};
	return cond;
};

const assert = function(cond, msg = `assertion failed`) {
	if (!cond) {
		debugger;
		throw new Error(msg);
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

const getGlobalStyleRules = function(domain) {
	let thumbClass = getThumbClass({domain});
	let darkTheme = domain === `danbooru`;

	return [
		/* --- vars --- */

		`:root {
			--${qual('c-base')} :
				${darkTheme
					? `hsla(0, 0%, 30%, 0.5)`
					: `hsla(0, 0%, 100%, 0.5)`};
			--${qual('c-iv-action')} : hsl(33, 100%, 70%);
			--${qual('c-ex-link')} : hsl(233, 100%, 75%);
		}`,

		/* --- inline view --- */

		`.${qual('iv-panel')} {
			display : flex;
			flex-direction : column;
			align-items : center;
			justify-content : flex-start;
			min-height : calc(20rem + 50vh);
		}`,

		`.${qual('iv-content-panel')} {
			display : flex;
			justify-content : center;
			align-items : center;
			min-height : 10rem;
		}`,

		`.${qual('iv-content-stack')} {
			display : grid;
			justify-items : center;
			align-items : center;
		}`,

		`.${qual('iv-content-stack')} > * {
			grid-column : 1;
			grid-row : 1;
		}`,

		`.${qual('iv-content-stack')}.${qual('scale-fit')} > * {
			max-width : 100vw;
			max-height : 100vh;
		}`,

		`.${qual('iv-content-stack')} > .${qual('iv-media')} {
			z-index : 2;
		}`,

		`.${qual('iv-content-stack')} > .${qual('iv-media-sample')} {
			z-index : 1;
		}`,

		`.${qual('iv-content-stack')} > .${qual('iv-media-thumbnail')} {
			z-index : 0;
			opacity : 0.5;
		}`,

		`.${qual('iv-content-stack')} > .${qual('iv-media-sample')},
		.${qual('iv-content-stack')} > .${qual('iv-media-thumbnail')}
		{
			width : auto;
			height : 100%;
		}`,

		`.${qual('iv-header')}, .${qual('iv-footer')} {
			max-width : 100vw;
			width : 50rem;
			min-height : 3rem;
		}`,

		`.${qual('iv-header')} > *, .${qual('iv-footer')} {
			background-color : var(--${qual('c-base')});
			opacity : 0.60;
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

		`.${qual('iv-ctrls')} > a:hover {
			opacity : 1;
		}`,

		`.${qual('iv-ctrls')} > * > .${qual('btn-icon')} {
			margin : 0;
			width : 2rem;
			height : 2rem;
			background-size : cover;
			background-image : url(${svgCircleRingHref});
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

		`.${qual('iv-ctrls')} > .${qual('prev')}.${qual('ready')}
			> .${qual('btn-icon')}
		{
			background-image : url(${svgCircleArrowRightHref});
		}`,

		`.${qual('iv-ctrls')} > .${qual('ex')}:hover {
			background-color : var(--${qual('c-ex-link')});
		}`,

		`.${qual('iv-ctrls')} > .${qual('ex')} > .${qual('btn-icon')} {
			background-image : url(${svgCircleLinkHref});
		}`,

		`.${qual('iv-ctrls')} > .${qual('next')}.${qual('ready')}
			> .${qual('btn-icon')}
		{
			background-image : url(${svgCircleArrowLeftHref});
		}`,

		`.${qual('iv-ctrls')} > .${qual('close')}:hover {
			background-color : var(--${qual('c-iv-action')});
		}`,

		`.${qual('iv-ctrls')} > .${qual('close')} > .${qual('btn-icon')} {
			background-image : url(${svgCircleArrowUpHref});
		}`,

		`.${qual('iv-ctrls')} > .${qual('prev')}.${qual('pending')},
		.${qual('iv-ctrls')} > .${qual('prev')}.${qual('disabled')},
		.${qual('iv-ctrls')} > .${qual('next')}.${qual('pending')},
		.${qual('iv-ctrls')} > .${qual('next')}.${qual('disabled')}
		{
			pointer-events : none;
		}`,

		`.${qual('iv-ctrls')} > .${qual('prev')}.${qual('pending')}
			> .${qual('btn-icon')},
		.${qual('iv-ctrls')} > .${qual('next')}.${qual('pending')}
			> .${qual('btn-icon')}
		{
			${spinnerStyleRules}
			background-image : url(${svgCircleSpinnerHref});
		}`,

		/* --- thumbnails --- */

		`.${thumbClass} {
			position : relative;
			/* centre the thumbnail images: */
			display : inline-flex !important;
			flex-direction : column;
			align-items : center;
			justify-content : center;
		}`,

		`.${thumbClass} > .post-score {
			${domain === `e621`
				? `margin-top : unset !important;
					margin-bottom : unset !important;`
				: ``}
		}`,

		`.${thumbClass} > .${qual('thumb-overlay')} {
			display : flex;
			flex-direction : column;
			position : absolute;
			z-index : 32767;
			top : 0;
			left : 0;
			bottom : 0;
			right : 0;
		}`,

		`.${thumbClass} > .${qual('thumb-overlay')} > * {
			display : block;
			flex-grow : 1;
		}`,

		`.${thumbClass} > .${qual('thumb-overlay')} > a {
			background-position : center;
			background-repeat : no-repeat;
			background-size : 30%;
			opacity : 0.7;
		}`,

		`.${thumbClass} > .${qual('thumb-overlay')}
			> a.${qual('thumb-ex-link')}:hover
		{
			background-image : url(${svgCircleLinkHref});
			background-color : var(--${qual('c-ex-link')});
		}`,

		`.${thumbClass} > .${qual('thumb-overlay')}
			> a.${qual('thumb-in-link')}:hover,
		.${thumbClass}.${qual('selected')} > .${qual('thumb-overlay')}
			> a.${qual('thumb-in-link')}
		{
			background-image : url(${svgCircleArrowDownHref});
			background-color : var(--${qual('c-iv-action')});
		}`,

		`.${thumbClass}.${qual('selected')} > .${qual('thumb-overlay')}
			> a.${qual('thumb-in-link')}:hover
		{
			background-image : url(${svgCircleArrowUpHref});
		}`,

		/* --- animation --- */

		`@keyframes ${qual('spinner')} {
			from {}
			to {transform : rotate(1.0turn);}
		}`,
	];
};

const spinnerStyleRules =
	`animation-name : ${qual('spinner')};
	animation-iteration-count : infinite;
	animation-duration : 0.36s;
	animation-timing-function : linear;`;

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

if (dbg) {
	let passCount = 0;
	for (let f of unittests) {
		try {
			f();
			++passCount;
		} catch (x) {
			console.warn(`${namespace}:`, `unittest failure`);
			console.error(`${x.message} | ${x.stack}`);};
	};
	console.info(`${namespace}:`,
		`${passCount}/${unittests.length} unittests passed`);
};

entrypoint();

/* -------------------------------------------------------------------------- */