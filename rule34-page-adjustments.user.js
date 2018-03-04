// ==UserScript==
// @id          rthirtyfimgpgadj
// @name        Rule34.xxx: Image Page Adjustments
// @version     2018-03-04
// @match       *://*.rule34.xxx/*
// @downloadURL https://github.com/bipface/userscripts/raw/master/rule34-page-adjustments.user.js
// @run-at      document-start
// @grant       none
// ==/UserScript==

/* -------------------------------------------------------------------------- */

'use strict';

let query_xpath_all = (Expr, Root = document.body) => {
	let Iter = document.evaluate(
		Expr, Root, null,
		XPathResult.ORDERED_NODE_ITERATOR_TYPE,
		null
	);
	let Xs = [];
	for (let X; (X = Iter.iterateNext()); Xs.push(X)) {};
	return Xs;
};
let query_xpath = (...Xs) => query_xpath_all(...Xs)[0];

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

let adjust_searchbar = () => {
	let Hdr = query_xpath(`//h5[text() = 'Search']`);
	if (!Hdr) {return;};
	Hdr.remove();
	let Btn = document.querySelector(`input[value=Search]`);
	Btn.style.width = ``;
	let Wild = query_xpath(`//small[text() = '(Supports wildcard *)']`);
	Btn.parentNode.insertBefore(Wild, Btn.nextSibiling);
};

let StyleColourTbl = {// TODO
	BgMain : `#303a30`,
	BgAlt : `rgb(41, 49, 41)`,
	TextMain : `#c0c0c0`,
	Link : `#b0e0b0`,
	LinkArtist : `#f0a0a0`,
	LinkCopyright : `#f0a0f0`,
	LinkCharacter : `#f0f0a0`,
};

let GlobalStyleRules = [
	`* {color : ${StyleColourTbl.TextMain};}`,
	`a:link, a:visited {color : ${StyleColourTbl.Link} !important;}`,

	`.tag-type-copyright > a {
		color : ${StyleColourTbl.LinkCopyright} !important;
	}`,
	`.tag-type-artist > a {
		color : ${StyleColourTbl.LinkArtist} !important;
	}`,
	`.tag-type-character > a {
		color : ${StyleColourTbl.LinkCharacter} !important;
	}`,
	`li[class*="tag-type-"]:hover a {
		text-shadow :
			1px 1px 1px black,
			-1px -1px 1px black,
			1px -1px 1px black,
			-1px 1px 1px black;
	}`,

	`#tag-sidebar > li > span:not([class]) {/* tag count */
		color : ${StyleColourTbl.TextMain} !important;
		opacity : 0.4;
	}`,

	`body {
		background-image : none !important;
		background-color : ${StyleColourTbl.BgMain};
	}`,

	`#header * {color : #88a088 !important;}`,
	`#header, #header > * {
		background-image : none !important;
		background-color : #303030;
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
	`input[type=submit][disabled],
		input[type=button][disabled],
		button[disabled]
	{
		filter : saturate(0%) brightness(70%);
	}`,
	`input[type=submit]:not([disabled]):active,
		input[type=button]:not([disabled]):active,
		button:not([disabled]):active
	{
		filter : invert(100%) hue-rotate(180deg);
	}`,

	`#blacklisted-sidebar {display : none !important;}`,

	`#taglinks-container {margin-top : 10px;}`,
	`img[src="//rule34.xxx/images/r34chibi.png"] {
		opacity : 0.5;
	}`,

	`.tags-status:hover {
		background-color : rgba(0, 0, 0, 0.12) !important;
	}`,

	`.tag-type-options input + * {
		text-shadow :
			1px 1px 1px black,
			-1px -1px 1px black,
			1px -1px 1px black,
			-1px 1px 1px black !important;
	}`,

	`.tag-type-options input[value="general"] + * {
		color : ${StyleColourTbl.Link} !important;
	}`,

	`.tag-type-options input[value="artist"] + * {
		color : ${StyleColourTbl.LinkArtist} !important;
	}`,

	`.tag-type-options input[value="character"] + * {
		color : ${StyleColourTbl.LinkCharacter} !important;
	}`,

	`.tag-type-options input[value="copyright"] + * {
		color : ${StyleColourTbl.LinkCopyright} !important;
	}`,

	`.tag.tag-added {
		background-image : var(--u-Checkerboard2px00ff0064);
	}`,

	`.tag.tag-deleted {
		background-image : var(--u-Checkerboard2pxff000080);
	}`,
];

let adjust_image_page = function() {
	insert_style_rules([
		`iframe {display : none !important;}`,

		`body {
			background-color : ${StyleColourTbl.BgAlt};
		}`,
		`#header, #header > * {
			background-color : transparent !important;
		}`,
		`#header li {display : block;}`,
		`#content {
			padding : 0px !important;
			min-height : 100vh;
			text-align : center;
			background-color : ${StyleColourTbl.BgAlt};
		}`,

		`.fit-viewport {
			max-width : 100vw;
			max-height : 100vh;
		}`,

		`.centre-box {
			display : inline-block;
			position : relative;
			min-height : inherit;
			padding : 0px 20px;
			text-align : initial;
			background-color : ${StyleColourTbl.BgMain};
			/* extend the background 2000vh beyond the bottom edge: */
			box-shadow : ${
				[...Array(20)].map((_, Idx) =>
					"0px "+((Idx+1)*100)+"vh 0px 0px "+StyleColourTbl.BgMain
				).join(",")
			};
		}`,

		`.side-box {position : absolute; top : 0px;}`,
		`.side-box li {list-style-type : none;}`,

		`.left-box {width : 135px; left : -135px;}`,

		`.right-box {
			width : 280px;
			right : -310px;
			padding : 7px 10px 7px 20px;
		}`,

		`#note-container {position : absolute;}`,
		`#note-container > .note-body {
			position : absolute;
			padding : 5px;
			border : 1px solid black;
			max-width : 300px;
			min-height : 10px;
			min-width : 140px;
			overflow : auto;
			cursor : pointer;
			background-color : rgba(0, 0, 0, 0.7);
		}`,
		`#note-container > .note-body > p.tn {color: gray; font-size: 0.8em;}`,
		`#note-container > .note-box {
			position : absolute;
			height : 150px;
			width : 150px;
			background-color : #FFF;
			border : 1px solid black;
			cursor : move;
		}`,
		`#note-container > .note-box > .note-corner {
			position : absolute;
			height : 7px;
			width : 7px;
			right : 0;
			bottom : 0;
			background-color : black;
			cursor : se-resize;
		}`,
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

	adjust_searchbar();

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
			Link.textContent =
				En ? `View original size` : `Shrink to window size`;
			Link.style.cursor = En ? `zoom-in` : `zoom-out`;
		});
		document.dispatchEvent(new Event(`:toggle-autosize`));

		OrigLink.parentNode.parentNode
			.insertBefore(ToggleSizeBtn, OrigLink.parentNode);
	};

	/* autosize toggle hotkey */
	document.addEventListener(`keyup`, Ev => {
		if (Ev.code !== `Numpad0` || Ev.target !== document.body) {return;};
		toggle_autosize();
	});

	/* images: resize on click */
	if (Img instanceof HTMLImageElement) {
		Img.addEventListener(`click`, toggle_autosize);
	};

	{/* remove original 'resize image' button */
		let E = document.evaluate(`
			.//h5//text()[contains(., 'Options')]/../..//a//text()
			[contains(., 'Resize image')]/../..
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

	{/* correct note positioning */
		let Script = document.createElement(`script`);
		Script.appendChild(document.createTextNode(`(function() {
			"use strict";
			if (Note === undefined) {return;};
			let adjust_all = function() {
				let Idx = 0; let Arr = Note.all; let Len = Arr.length;
				for (; Idx < Len; Idx += 1) {Arr[Idx].adjustScale();};
			};
			window.addEventListener("resize", adjust_all, false);
			document.addEventListener(":main-image-adjusted", adjust_all, false);
			document.addEventListener(":toggle-autosize", adjust_all, false);
			adjust_all();
		})()`));

		document.getElementById(`note-container`).style.display = `none`;
		document.addEventListener(`:main-image-loaded`, function f() {
			document.removeEventListener(`:main-image-loaded`, f);
			document.getElementById(`note-container`).style.display = ``;
			document.body.appendChild(Script);
		}, false);
	};

	{/* image load checking */
		let check_img = () => {
			let X = is_image_complete(Img);
			document.querySelector(`.image-container`)
				.classList.toggle(`image-loaded`, X);
			if (X) {document.dispatchEvent(
				new CustomEvent(`:main-image-loaded`, {}));};
		};
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
			document.dispatchEvent(new CustomEvent(`:main-image-adjusted`, {}));
		};
		window.addEventListener(`resize`, adjust_margin, false);
		adjust_margin();
	};

	if (true) {/* overlay edit controls */
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

	if (false) {/* tag editor button */
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

	{/* ad space */
		let x = document.getElementById(`bottom`);
		if (x) {x.remove();};
	};

	if (false) {/* tag configuration links */
		let TagList = document.getElementById(`tag-sidebar`);
		for (let TagEl of [...TagList.children]) {
			let Name = TagEl.firstChild.textContent.replace(/ /g, `_`);

			let Link = document.createElement(`a`);
			Link.href = `/index.php?page=tags&s=list&tags=${Name}`;

			let Icon = document.createElement(`img`);
			Icon.src = `data:image/png;base64,
				iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAYAAABWdVznAAAABHNCSVQICAgIfAhk
				iAAAAZJJREFUKJFlkDFr21AUhc+1/LDRG63B0CDjKmCIVBBeKgnSGs9djWM6dSgd
				u3TpX2nJ0kGG+j9oUHEQdIv7zAMZ24LM3p4HGfG6KCE4Z7znwD3fId/3cS7HcW6J
				qLHZbD6dew0AIKJXnPOb+mb0er3Atu23AAwA4JxPiegCAJoAYJrm9WQyiYUQXxhj
				pm3bVwAQRdFdWZbK87zRYrH4qJSaG91uF6fT6R9jbOS67vs8z5dpmn5drVa/2u32
				6+Fw+EEIke73+29PHwAYjDEzy7LfUsrHapBSJgDQ6XScul7VdBzntu58Fcfx93PI
				7Xb7IwiCpNVq3RdFkTWIqAGAXkz1UkRERPWsRhRFd4fDYSulnD1PDQaD2LKsy+Vy
				GQKoHhmqsixVEARTrbXe7XY/AaDf738Ow/BGCJECqJ6gOedTz/NGQojUsqzLMAwT
				AMjz/K8QInVd9916vZ4ppebk+z6I6MI0zWul1ByAMR6P7wFQkiRvAFSc89nxePyj
				tX5oAoDW+qEOA0BVFEVWj1EBwDMP/wFnTpz32zcEVwAAAABJRU5ErkJggg==`;
			Icon.style.margin = `0 3px`;
			Icon.style.verticalAlign = `bottom`;
			Icon.style.filter = `brightness(200%)`;

			Link.appendChild(Icon);
			TagEl.appendChild(Link);
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
			max-width : 23em !important;
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

		`#tag-sidebar img[src="//rule34.xxx/images/r34chibi.png"] {
			margin-top : 1em;
		}`,
	]);

	adjust_searchbar();

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
		let ThumbContainer = document.querySelector(
			`#post-list .image-container`);
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
		`#post-list > .content > div:not([style])`
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
			//E.parentNode.querySelector(`h5`)
			//	.setAttribute(`style`, `display : none;`);
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
	if (location.pathname === `/` && location.search === ``) {
		location.search = `?page=post&s=list`
		return;
	};

	if (RegExp(
		`/(index.php|chat.php|icameout.php|(stats(/[^?]*)?))?(\\?.*)?$`
	).test(location.pathname+location.search)) {
		let Q = new URLSearchParams(location.search);
		if (Q.get(`page`) === `dapi`) {
			return;};
		insert_style_rules(GlobalStyleRules);
	};
};

/* delay until document fully loaded */
document.addEventListener(`DOMContentLoaded`, function callee() {
	if (!document.body) {return;};
	/* only apply to …/index.php?page=post… */
	if (![`/`, `/index.php`].includes(location.pathname)) {return;};

	let Q = new URLSearchParams(location.search);
	if (Q.get(`page`) === `favorites`) {return adjust_gallery_page();};
	if (Q.get(`page`) !== `post`) {return;};
	if (Q.get(`s`) === `view`) {return adjust_image_page();};
	if (Q.get(`s`) === `list`) {return adjust_gallery_page();};
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