// ==UserScript==
// @name        Rule34.xxx: Extra Image Info
// @namespace   6930e44863619d3f19806f68f74dbf62
// @version     2017-08-17
// @match       *://*.rule34.xxx/*
// @downloadURL https://github.com/bipface/userscripts/raw/master/rule34-extraimginfo.user.js
// @run-at      document-end
// @grant       GM_xmlhttpRequest
// ==/UserScript==

'use strict';

/* -------------------------------------------------------------------------- */

const entrypoint = () => {
	if (![`/`, `/index.php`].includes(location.pathname)) {return;};

	let Q = new URLSearchParams(location.search);
	if (!(Q.get(`page`) === `post` && Q.get(`s`) === `view`)) {
		return;};

	let ImgHref = xpath(`//a[text() = 'Original image']/@href`).next().value;
	enforce(ImgHref instanceof Attr && ImgHref.value);

	let StatsBox = enforce(document.getElementById(`stats`));

	let BeforeEl = enforce(
		xpath(`./ul/li/text()[contains(., 'Size:')]/..`, StatsBox).next().value
			|| xpath(`./ul/li[last()]`, StatsBox).next().value);

	let TypeElId = `499c6ba6d1703b3520fa96591db08a86`;
	let BytesElId = `9ec44c89ee93d262e3ceb35ff2483aeb`;
	BeforeEl.insertAdjacentHTML(`afterend`,
		`<li>Type:
			<span id="${TypeElId}" style="opacity: 0.5;">(fetching)</span>
		</li>
		<li>Bytes:
			<span id="${BytesElId}" style="opacity: 0.5;">(fetching)</span>
		</li>`);

	GM_xmlhttpRequest({
		method : `HEAD`,
		url : ImgHref.value,
		onload : Resp => {
			enforce(Resp.status === 200);
			let Headers = Resp.responseHeaders.toLowerCase().split(`\r\n`);

			let TypeEl = enforce(document.getElementById(TypeElId));
			let ContType = Headers.find(X => X.startsWith(`content-type`));
			if (ContType) {
				TypeEl.textContent = /:\s*([^\s]+)$/.exec(ContType)[1];
				TypeEl.style.opacity = `1`;
			} else {
				TypeEl.textContent = `unknown`;};

			let BytesEl = enforce(document.getElementById(BytesElId));
			let ContLen = Headers.find(X => X.startsWith(`content-length`));
			if (ContLen) {
				let N = parseInt(/:\s*(\d+)$/.exec(ContLen)[1]);
				BytesEl.textContent =
					/* digit grouping */
					[...joiner.call(
						chunks.call(
							`${N}`.split(``).reverse(),
							3),
						`,`)]
						.reverse()
						.join(``);
				BytesEl.style.opacity = `1`;
			} else {
				BytesEl.textContent = `unknown`;};
		},
	});
};

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

const chunks = function*(ChunkSize) {
	enforce(is_iterable(this));
	enforce(Number.isSafeInteger(ChunkSize) && ChunkSize > 0);

	let Iter = this[Symbol.iterator]();
	let X = Iter.next();
	while (!X.done) {
		let Chunk = Array(ChunkSize);
		let Idx = 0;
		for (; Idx < ChunkSize && !X.done; ++Idx, X = Iter.next()) {
			Chunk[Idx] = X.value;
		};
		Chunk.length = Idx;
		yield Chunk;
	};
};

const joiner = function*(Sep = []) {
	enforce(is_iterable(this));
	enforce(is_iterable(Sep));

	let First = true;
	for (let Xs of this) {
		enforce(is_iterable(Xs));
		if (First) {
			First = false;
		} else {
			yield* Sep;};
		yield* Xs;};
};

const is_iterable = Xs =>
	Xs != null && typeof Xs[Symbol.iterator] === `function`;

/* -------------------------------------------------------------------------- */

entrypoint();

/* -------------------------------------------------------------------------- */

/*








































*/

/* -------------------------------------------------------------------------- */