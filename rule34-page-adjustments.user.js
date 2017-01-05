// ==UserScript==
// @id             rthirtyfimgpgadj
// @name           Rule34.xxx: Image Page Adjustments
// @version        1.08
// @include        *rule34.xxx/*
// @domain         rule34.xxx
// @run-at         document-start
// @grant          none
// ==/UserScript==

/* -------------------------------------------------------------------------- */

`use strict`;

let move_childnodes = (Src, Dst) => {
	while (Src.hasChildNodes()) {Dst.appendChild(Src.firstChild);};
};

let insert_style_rules = (Rules) => {
	let Style = document.createElement(`style`);
	document.head.appendChild(Style);
	for (let Rule of Rules) {
		Style.sheet.insertRule(Rule, Style.sheet.cssRules.length);
	};
};

/* check the image had loaded and is not corrupt */
let is_image_complete = (Img) => {
	if (Img instanceof HTMLImageElement) {
		return Img.complete && Img.naturalWidth > 0;
	} else if (Img instanceof HTMLVideoElement) {
		return Img.readyState > 0;
	};
	throw new Error(``);
};

let GlobalStyleRules = [
	`* {color : #c0c0c0 !important;}`,
	`a:link, a:visited {color : #b0e0b0 !important;}`,
	`.tag-type-copyright > a {color : #f0a0f0 !important;}`,
	`.tag-type-artist > a {color : #f0a0a0 !important;}`,
	`.tag-type-character > a {color : #f0f0a0 !important;}`,
	`*[class*="tag-type-"]:hover {
		background-color : rgb(80, 90, 80);
		text-shadow : 0px 0px 2px black;
	}`,

	`body {
		background-image : none !important;
		background-color : #303a30 !important;
	}`,

	`#header * {color : #88a088 !important;}`,
	`#header, #header > * {
		background-image : none !important;
		background-color : #303030 !important;
	}`,
	`#header #subnavbar * {color : #878787 !important;}`,

	`li.current-page,
	tr.tableheader, tr[style="background-image: url(topban00.jpg);"],
	table.highlightable > tbody > tr[style="background: #006ffa;"] {
		background-image : none !important;
		background-color : #505a50 !important;
	}`,

	`table tr.pending-tag {
		background-color : #445644 !important;
	}`,

	`#header #site-title {display : none !important;}`,

	`div.quote {background-color : #505a50 !important;}`,

	`div.has-mail {background-color : #303030 !important;}`,

	`.status-notice,
	#post-view > div [ /* child posts banner */
		style="background: #f0f0f0; padding: 10px; `+
		`text-align: center; border: 3px solid #dadada;"
	] {
		background-color : #303030 !important;
		border-width : 1px !important;
		border-color : #505a50 !important;
		border-style : solid !important;
	}`,

	`.status-notice {margin : 0px 0px 1em 0px !important;}`,

	`table.highlightable > tbody >
	tr:not([style="background: #006ffa;"]):not(.tableheader):hover {
		background-color : initial !important;
	}`,

	`img[src*="icame.png"][alt="I came!"] {
		display : none !important;
	}`,

	`input[type=text], textarea, select, select {
		background-color : #303030 !important;
		border-width : 1px !important;
		border-color : #505a50 !important;
		border-style : solid !important;
	}`,
	`input[type=submit], input[type=button], button {
		padding : 0 0.3em !important;
		color : #303a30 !important;
		font-weight : bold !important;
		background-color : #88a088 !important;
		border-width : 1px !important;
		border-style : solid !important;
		border-color : #505a50 !important;
		text-align : center;
	}`,
	`input[type=submit]:active, input[type=button]:active, button:active {
		filter : invert(100%) hue-rotate(180deg);
	}`,
	`input[value=Search] {display : none !important;}`,

	`#blacklisted-sidebar {display : none !important;}`,

	`#tag-sidebar img {padding : 10px 0px;}`,
	`#taglinks-container {margin-top : 10px;}`,
	`img[src="//rule34.xxx/images/r34chibi.png"] {
		opacity : 0.5;
	}`
];

let adjust_image_page = function() {
	insert_style_rules([
		`iframe {display : none !important;}`,
		`#header li {display : block;}`,
		`#content {
			padding : 0px !important;
			text-align : center;
		}`,

		`.fit-viewport {
			max-width : 100vw;
			max-height : 100vh;
		}`,

		".centre-box {"+
			"display : inline-block;"+
			"position : relative;"+
			"text-align : initial;"+
		"}",

		".side-box {position : absolute; top : 0px;}",
		".side-box li {list-style-type : none;}",

		".left-box {width : 135px; left : -155px;}",

		".right-box {"+
			"width : 250px;"+
			"right : -300px;"+
			"padding : 7px 10px 7px 20px;"+
			"background-color : rgba(0, 0, 0, 0.15);"+
		"}",

		"#note-container {position : absolute;}",
		"#note-container > .note-body {"+
			"position : absolute;"+
			"padding : 5px;"+
			"border : 1px solid black;"+
			"max-width : 300px;"+
			"min-height : 10px;"+
			"min-width : 140px;"+
			"overflow : auto;"+
			"cursor : pointer;"+
			"background-color : rgba(0, 0, 0, 0.7);"+
		"}",
		"#note-container > .note-body > p.tn {color: gray; font-size: 0.8em;}",
		"#note-container > .note-box {"+
			"position : absolute;"+
			"height : 150px;"+
			"width : 150px;"+
			"background-color : #FFF;"+
			"border : 1px solid black;"+
			"cursor : move;"+
		"}",
		"#note-container > .note-box > .note-corner {"+
			"position : absolute;"+
			"height : 7px;"+
			"width : 7px;"+
			"right : 0;"+
			"bottom : 0;"+
			"background-color : black;"+
			"cursor : se-resize;"+
		"}",
		`#note-container > .unsaved {
			border : 1px solid red;
			background-color : #FFF;
		}`,
		`#note-container > .unsaved > .note-corner {
			background-color : red;
		}`,

		`#ci ~ div[style="display:inline;"] {/* comments */
			display : block !important;
			max-width : 1000px;
			margin : 0px 10px;
		}`,

		`.image-container {
			display : flex;
			flex-direction : column;
		}`,
		`.image-container .edit-overlay {
			align-self : flex-start;
		}`,
		`.image-container.fit-viewport .edit-overlay {
			align-self : center;
		}`,

		`.edit-overlay {
			display : flex;
			position : relative;
			flex-direction : column;
			order : 1;
			justify-content : flex-end;
			max-height : 0px;
			opacity : 0.85;
			z-index : 1;
			text-align : initial;
		}`,
		`.image-container.fullsize .edit-overlay,
			.image-container:not(.image-loaded) .edit-overlay
		{
			order : -1;
			justify-content : flex-start;
		}`,
		/* convert the table to divs */
		`.edit-overlay table, .edit-overlay tbody,
			.edit-overlay tr, .edit-overlay td
		{
			display : block;
		}`,
		`.edit-overlay > table {
			position : relative;
			max-width : 100vw;
			min-width : -moz-available;
			width : -moz-min-content;
			margin : 0px;
			padding : 7px 5px;
			background-color : rgb(41, 49, 41);
		}`,
		`.edit-overlay #tags, .edit-overlay #source {
			width : -moz-available;
			color : white !important;
			text-shadow: 0px 0px 2px black;
		}`,
		`.edit-overlay #tags {
			padding : 4px;
		}`,
		`.edit-overlay .button-container {
			position : absolute;
			top : 10px;
			right : 7px;
		}`
	]);

	/* find "original image" link */
	let OrigLink = (() => {
		let Sidebar = document.getElementsByClassName(`sidebar`)[0];
		if (!Sidebar) {return null;};
		let LinkNode = Array.from(Sidebar.getElementsByTagName(`a`)).find(
			function(Elem) {
				if (Elem.childNodes.length !== 1) {return false;};
				let Fc = Elem.firstChild;
				if (
					Fc && Fc.nodeType === Node.TEXT_NODE &&
					Fc.textContent === `Original image`
				) {
					return true;
				};
				return false;
			}
		);
		if (!LinkNode) {return null;};
		return LinkNode;
	})();
	if (!OrigLink) {return;};

	/* find original image dimensions */
	let ImgWh = (() => {
		let TxtNode = document.evaluate(
			`.//text()[contains(., 'Size:')]`, document.getElementById(`stats`),
			null, XPathResult.ANY_TYPE, null
		).iterateNext();
		if (TxtNode === null) {return [NaN, NaN];};
		let RexResult = TxtNode.textContent.match(/(\d+)x(\d+)/);
		if (RexResult === null) {return [NaN, NaN];};
		return [parseInt(RexResult[1]), parseInt(RexResult[2])];
	})();

	let NoteBox = document.getElementById(`note-container`);
	if (!NoteBox) {
		NoteBox = document.createElement(`div`);
		NoteBox.setAttribute(`id`, `note-container`);
	};

	/* find or create the image element */
	let Img = document.getElementById(`image`);
	if (Img) {
		Img.removeAttribute(`width`);
		Img.removeAttribute(`height`);

	} else if (Img = document.getElementById(`gelcomVideoPlayer`)) {
		Img.removeAttribute(`style`);

	} else {
		Img = document.createElement(`img`);
		Img.setAttribute(`id`, `image`);

		let insert = E => {
			NoteBox.parentNode.insertBefore(E, NoteBox.nextSibling);
		};

		let Div = document.createElement(`div`);
		Div.setAttribute(`style`, `margin-bottom: 1em;`);
		insert(Div);
		insert(document.createElement(`br`));
		insert(Img);
	};
	Img.setAttribute(`src`, OrigLink.getAttribute(`href`));
	Img.removeAttribute(`onclick`);
	Img.classList.add(`fit-viewport`);

	let is_autosize_enabled = () => Img.classList.contains(`fit-viewport`);
	let toggle_autosize = () => {
		Img.classList.toggle(`fit-viewport`);
		let X = document.querySelector(`.image-container`);
		X.classList.toggle(`fit-viewport`);
		X.classList.toggle(`fullsize`);

		document.dispatchEvent(new Event(`:toggle-autosize`));
	};

	{/* toggle-autosize button */
		let ToggleSizeBtn = document.createElement(`li`);
		ToggleSizeBtn.innerHTML = `<a id="toggle-autosize" href="#">?</a>`;
		ToggleSizeBtn.addEventListener(`click`, () => toggle_autosize());
		document.addEventListener(`:toggle-autosize`, () => {
			let En = is_autosize_enabled();
			let Link = ToggleSizeBtn.firstElementChild;
			Link.textContent = En ? `View original size` : `Shrink to window size`;
			Link.style.cursor = En ? `zoom-in` : `zoom-out`;
		});
		document.dispatchEvent(new Event(`:toggle-autosize`));

		OrigLink.parentNode.parentNode
			.insertBefore(ToggleSizeBtn, OrigLink.parentNode);
	};

	/* images: resize on click */
	if (Img instanceof HTMLImageElement) {
		Img.addEventListener(`click`, toggle_autosize);
	};

	{/* remove original 'resize image' button */
		let E = document.evaluate(`
			.//h5//text()[contains(., 'Options')]/../..//a//text()[contains(., 'Resize image')]/../..
		`, document.body, null, XPathResult.ANY_TYPE, null).iterateNext();
		if (E) {E.parentNode.removeChild(E);};
	};

	{/* ? */
		let E = document.querySelector(`#tag-sidebar`).parentNode;
		E.setAttribute(`id`, `taglinks-container`);
	};

	{/* move status notice into sidebar */
		let StatusNotice = document.querySelector(`#content .status-notice`);
		if (StatusNotice) {
			let E = document.querySelector(`#taglinks-container`);
			E.parentNode.insertBefore(StatusNotice, E);
		};
	};

	{/* remove the 'cum on this' section */
		let E = document.evaluate(
			`.//h5//text()[contains(., 'Cum on this')]/../..`, document.body,
			null, XPathResult.ANY_TYPE, null
		).iterateNext();
		E.parentNode.removeChild(E);
	};

	let RightBox = document.createElement(`div`);
	RightBox.setAttribute(`class`, `right-box side-box`);
	move_childnodes(document.querySelector(`#post-view > .sidebar`), RightBox);

	let LeftBox = document.createElement(`div`);
	LeftBox.setAttribute(`class`, `left-box side-box`);
	LeftBox.appendChild(document.getElementById(`header`));

	let CentreBox = document.createElement(`div`);
	CentreBox.setAttribute(`class`, `centre-box`);
	move_childnodes(Img.parentNode, CentreBox);

	{
		let ContentBox = document.getElementById(`content`);
		while (ContentBox.hasChildNodes()) {
			ContentBox.removeChild(ContentBox.lastChild);
		};
		CentreBox.appendChild(RightBox);
		CentreBox.appendChild(LeftBox);
		ContentBox.appendChild(CentreBox);
	};

	{/* put #image and #note-container in some boxes */
		let OuterBox = document.createElement(`div`);
		OuterBox.setAttribute(`style`, `text-align : center;`);
		Img.parentNode.insertBefore(OuterBox, Img);

		let InnerBox = document.createElement(`div`);
		InnerBox.setAttribute(
			`style`, `display : inline-block; position : relative;`
		);
		InnerBox.appendChild(NoteBox);
		InnerBox.appendChild(Img);

		OuterBox.appendChild(InnerBox);
	};

	{/* image-container ; scaled to fit window by default */
		let E = Img.parentNode.parentNode;
		E.classList.add(`image-container`);
		E.classList.add(`fit-viewport`);
	};

	{/* image load checking */
		let check_img = () =>
			document.querySelector(`.image-container`)
				.classList[is_image_complete(Img) ? `add` : `remove`](
					`image-loaded`);
		Img.addEventListener(`load`, check_img);
		Img.addEventListener(`loadedmetadata`, check_img);
		Img.addEventListener(`loadeddata`, check_img);
		Img.addEventListener(`error`, check_img);
		(new MutationObserver(check_img)).observe(Img, {attributes : true});
		check_img();
	};

	{/* widen the searchbar */
		let Bar = document.getElementById(`stags`);
		Bar.removeAttribute(`size`);
		Bar.setAttribute(`style`, `width : -moz-available;`);
	};

	if (!isNaN(ImgWh[0]+ImgWh[1])) {/* image top margin */
		let adjust_margin = function() {
			let WinH = window.innerHeight;
			let ImgH = ImgWh[1];
			if (WinH <= ImgH) {Img.setAttribute(`style`, ``); return;};
			let V = Math.min(Math.pow((WinH - ImgH)/60, 2), WinH/2 - ImgH/2);
			Img.setAttribute(`style`, `margin-top : `+Math.floor(V)+`px;`);
			NoteBox.setAttribute(`style`, `margin-top : `+Math.floor(V)+`px;`);
		};
		window.addEventListener(`resize`, adjust_margin, false);
		adjust_margin();
	};

	{/* overlay edit controls */
		let E = document.getElementById(`edit_form`);
		E.classList.add(`edit-overlay`);
		E.parentNode.insertBefore(E, E.parentNode.firstChild);

		document.querySelector(`.image-container`).insertBefore(E, null);

		for (let X of [
			`#title`, `input[name="parent"]`, `#next_post`, `#previous_post`
		]) {
			E.querySelector(X).parentNode.style.display = `none`;
		};

		{/* removing 'Rating' text */
			let Cont = E.querySelector(`input[name="rating"]`).parentNode;
			for (let X of [...Cont.childNodes]) {
				if (X instanceof Text && X.textContent === `Rating`) {
					X.remove();
				} else if (X instanceof HTMLBRElement) {
					X.remove();
				};
			};
		};

		let Submit = E.querySelector(`input[name="submit"]`);
		let Cancel = document.createElement(`button`);
		Cancel.setAttribute(`form`, ` `);
		Cancel.textContent = `Cancel`;
		Submit.parentNode.classList.add(`button-container`);
		Submit.parentNode.insertBefore(Cancel, null);

		Cancel.addEventListener(`click`, Ev => {
			E.style.display = `none`;
		});
	};

	{/* tag editor button */
		let E = document.getElementById(`taglinks-container`);
		let Btn = document.createElement(`button`);
		Btn.setAttribute(`form`, ` `);
		Btn.textContent = `Edit`;
		Btn.style.marginLeft = `0.5em`;
		E.firstChild.insertBefore(Btn, null);

		let Ed = document.getElementById(`edit_form`);
		Btn.addEventListener(`click`, Ev => {
			Ed.style.display = Ed.style.display === `none` ? `` : `none`;
		});

		(new MutationObserver(() => {
			let Txt = Ed.style.display === `none` ? `Edit` : `Cancel editing`;
			if (Btn.textContent !== Txt) {Btn.textContent = Txt;};
		})).observe(Ed, {attributes : true});
	};

	/* ad space */
	document.getElementById(`bottom`).remove();

	{/* correct note positioning */
		let Txt = document.createTextNode(`(function() {
			"use strict";
			if (Note === undefined) {return;};
			let adjust_all = function() {
				let Idx = 0; let Arr = Note.all; let Len = Arr.length;
				for (; Idx < Len; Idx += 1) {Arr[Idx].adjustScale();};
			};
			window.addEventListener("resize", adjust_all, false);
			adjust_all();
		})()`);
		let Script = document.createElement(`script`);
		Script.setAttribute(`type`, `application/javascript;version=1.8`);
		Script.appendChild(Txt);
		if (Img.complete) {
			document.body.appendChild(Script);
		} else {
			Img.addEventListener(`load`, function f() {
				Img.removeEventListener(`load`, f);
				document.body.appendChild(Script);
			}, false);
		};
	};
};

let adjust_gallery_page = function() {
	insert_style_rules([
		`#content {padding : 0px !important;}`,
		`#post-list {display : flex !important; align-items : flex-start;}`,
		`#post-list > * {float : none !important;}`,
		`.sidebar {
			width : auto !important;
			max-width : 19em !important;
			margin-right : auto !important;
			padding : 7px 10px 7px 20px;
			flex-shrink : 0;
			align-self : stretch;
			background-color : rgba(0, 0, 0, 0.15);
		}`,
		`#post-list > .content {
			display : flex;
			flex-direction : column;
			justify-content : center;
			align-items : center;
			min-height : calc(100vh - 14px);
			width : auto !important;
			flex-grow : 1;
			text-align : center;
			padding : 7px 0px;
		}`,
		`#post-list .image-container {
			display : inline-block;
			width : -moz-fit-content;
		}`,
		`#header li {display : block !important;}`,
		`#header {
			height : 7em;
			overflow : hidden;
			position : relative;
			border-width : 1px;
			border-color : #505a50;
			border-style : solid;
		}`,
		`#header.open {height : auto !important;}`,
		`#header > .more {
			display : block;
			position : absolute;
			bottom : 0px;
			width : 100%;
			text-align : center;
			background-color : #505a50 !important;
			color : #303030 !important;
		}`,
		`#header.open > .more {position : relative;}`,
		`#header > * {margin : 0px !important;}`,
		`.blacklisted-image {background : unset !important;}`,
		`.blacklisted-image > a {display : block !important;}`,
		`.blacklisted-image > a > img {
			display : block; border : 2px solid black;
		}`,
		`.blacklisted-image > a:after {
			content : "[blacklisted]";
			color : #aaa;
			background-color : black;
		}`,
		`.thumb > a > img.preview {
			vertical-align : unset !important;
		}`,
		`.thumb > a {
			border-bottom : 1px dotted #B0E0B0 !important;
		}`,
		`.thumb > a:visited {
			border-bottom-color : #303a30 !important;
		}`,
	]);

	let Header = document.querySelector(`#header`);
	if (Header) {
		let E = document.createElement(`a`);
		E.setAttribute(`href`, `#`);
		E.addEventListener(`click`, () => Header.classList.toggle(`open`));
		E.setAttribute(`class`, `more`);
		E.appendChild(document.createTextNode(`• • •`));
		Header.appendChild(E);
	};

	/* favourites page has a different layout; normalise it */
	if (!document.getElementById(`content`)) {
		let Thumbs = [...document.getElementsByClassName(`thumb`)];

		let ContentBox = document.createElement(`div`);
		ContentBox.id = `content`;
		ContentBox.innerHTML = `
			<div id="post-list">
				<div class="sidebar"></div>
				<div class="content">
					<div class="image-container"></div>
				</div>
			</div>
		`;

		Thumbs[0].parentNode.insertBefore(ContentBox, Thumbs[0]);
		let ThumbContainer = document.querySelector(`#post-list .image-container`);
		for (let X of Thumbs) {
			X.querySelector(`img`).classList.add(`preview`);
			ThumbContainer.appendChild(X);
		};

		document.querySelector(`.content`)
			.appendChild(document.getElementById(`paginator`));

		/* delete blacklist filter link */
		document.getElementById(`pi`).parentNode.parentNode.remove();

		/* delete leftover linebreaks */
		for (let X of [...document.querySelectorAll(`body > br`)]) {
			X.remove();
		};

		/* favourites has no tags; open header by default */
		Header.classList.add(`open`);
	};

	let Sidebar = document.querySelector(`#post-list > .sidebar`);
	Sidebar.insertBefore(Header, Sidebar.firstChild);

	let Content = document.querySelector(`#post-list > .content`);
	let ImageContainer = Content.querySelector(
		`#post-list > .content > div:not([id])`
	);
	ImageContainer.classList.add(`image-container`);
	let Paginator = Content.querySelector(`#paginator`);

	while (Content.lastChild) {Content.removeChild(Content.lastChild);};
	Content.appendChild(ImageContainer);
	if (Paginator) {Content.appendChild(Paginator);};
	let Tips = document.querySelector(`#header > div.tips`);
	if (Tips) {
		Tips.setAttribute(`style`, (
			`background-image : none !important; text-align : center;`
		));
		Content.appendChild(Tips);
	};

	{/* ? */
		let E = document.querySelector(`#tag-sidebar`);
		if (E) {
			E.parentNode.setAttribute(`id`, `taglinks-container`);
			E.parentNode.querySelector(`h5`)
				.setAttribute(`style`, `display : none;`);
		};
	};

	{/* widen the searchbar */
		let Bar = document.getElementById(`tags`);
		if (Bar) {
			Bar.removeAttribute(`size`);
			Bar.setAttribute(`style`, `width : -moz-available;`);
		};
	};
};

/* --- --- */

let on_document_head_loaded = function() {
	if (document.location.pathname === `/`) {
		document.location.pathname = `/index.php?page=post&s=list`
		return;
	};

	if (RegExp(
		`/(index.php|chat.php|icameout.php|(stats(/[^?]*)?))?(\\?.*)?$`
	).test(document.location.pathname+document.location.search)) {
		insert_style_rules(GlobalStyleRules);
	};
};

/* delay until document fully loaded */
document.addEventListener(`DOMContentLoaded`, function() {
	/* only apply to …/index.php?page=post… */
	if (document.location.pathname !== `/index.php`) {return;};
	let QueryTbl = {};
	document.location.search.substring(1).split(`&`).forEach(function(Txt) {
		let Arr = Txt.split(`=`);
		QueryTbl[Arr[0]] = Arr[1];
	});
	if (QueryTbl[`page`] === `favorites`) {return adjust_gallery_page();};
	if (QueryTbl[`page`] !== `post`) {return;};
	if (QueryTbl[`s`] === `view`) {return adjust_image_page();};
	if (QueryTbl[`s`] === `list`) {return adjust_gallery_page();};
});

{/* delay until document.head exists */
	let on_root_append = function(_, Obs) {
		if (!document.head) {return;};
		Obs.disconnect();
		on_document_head_loaded();
	};

	let on_document_append = function(_, Obs) {
		if (!document.documentElement) {return;};
		Obs.disconnect();
		let NextObs = new MutationObserver(on_root_append)
		NextObs.observe(document.documentElement, {childList : true});
		on_root_append(null, NextObs);
	};

	let Obs = new MutationObserver(on_document_append);
	Obs.observe(document, {childList : true});
	on_document_append(null, Obs);
};

/* -------------------------------------------------------------------------- */

/*











































*/

/* -------------------------------------------------------------------------- */
