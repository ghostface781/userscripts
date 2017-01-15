// ==UserScript==
// @name        Rule34.xxx: Tagging Tools
// @id          rthirtyftaggingtools
// @namespace   6930e44863619d3f19806f68f74dbf62
// @version     2016-01-15
// @include     *rule34.xxx/*
// @domain      rule34.xxx
// @run-at      document-end
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_deleteValue
// ==/UserScript==

`use strict`;

/* -------------------------------------------------------------------------- */

let entrypoint = () => {
	let Q = new URLSearchParams(location.search);
	if (Q.get(`page`) === `favourites` ||
		(Q.get(`page`) === `post` && [`list`, `view`].includes(Q.get(`s`)))
	) {
		// greasemonkey bug?
		if (!document.getElementById(`tag-sidebar`)) {return;};

		insert_style_rules(global_style_rules());

		if (Q.get(`s`) === `view`) {
			new ImagePageCtrlrº(parseInt(Q.get(`id`)));
		} else if (Q.get(`s`) === `list`) {
			new GalleryPageCtrlrº();
		};
	};
};

class PageCtrlrº {
	constructor(create_main_tagset_ctrlr) {
		enforce(!window.TaggingToolsCtrlr);
		window.TaggingToolsCtrlr = this;

		this.MainTagSet = letx((
			X = enforce(document.getElementById(`tag-sidebar`)),
			TagDescrs = parse_tag_list(X),
			Mts = create_main_tagset_ctrlr(TagDescrs).El
		) => (
			TagDescrs.length ||
				console.warn(`main tag set is empty`),
			Mts.id = `tag-sidebar`,
			X.replaceWith(Mts),
			Mts
		));

		this.SearchBar = letx((
			X = enforce(document.querySelector(
				`input[id$="tags"][type="text"]`)),
			Sb = (new SearchBarCtrlrº()).El
		) => (
			Sb.id = X.id,
			Sb.value = X.value,
			X.replaceWith(Sb),
			Sb
		));

		this.SearchBar.addEventListener(`:query-update`, (Ev) =>
			this.MainTagSet.Ctrlr
				.on_search_query_update(Ev.QueryTbl)
		);

		this.MainTagSet.addEventListener(`:search-tag-toggle`, (Ev) => {
			let Tbl = this.SearchBar.Ctrlr.QueryTbl;
			if (Ev.Mode) {
				Tbl.set(Ev.Tag, Ev.Mode);
			} else {
				Tbl.delete(Ev.Tag);
			};
			this.SearchBar.Ctrlr.set_query_from_tbl(Tbl);
		});

		this.SearchBar.Ctrlr.on_query_update();

		/* remove the original tag list header */
		query_xpath(`../h5/text()[.="Tags"]/..`, this.MainTagSet).remove();
	};
};

class ImagePageCtrlrº extends PageCtrlrº {
	constructor(ImageId) {
		super((Xs) => new ImageTagSetCtrlrº(Xs, ImageId));
		this.ImageId = ImageId;
		this.EditForm = enforce(document.getElementById(`edit_form`));

		let InitialSourceBox = query_xpath(
			`//li/text()[contains(., "Source:")]/..`,
			document.getElementById(`stats`)
		);
		let SourceTxt = this.EditForm.querySelector(`input#source`).value;
	};
};

class GalleryPageCtrlrº extends PageCtrlrº {
	constructor() {
		super((Xs) => new GalleryTagSetCtrlrº(Xs));
	};
};

class SearchBarCtrlrº {
	constructor() {
		this.El = document.createElement(`input`);
		this.El.Ctrlr = this;
		this.El.name = `tags`;
		this.El.type = `text`;

		this.El.addEventListener(`input`, (Ev) =>
			this.on_query_update());
	};

	on_query_update() {
		let Ev = new Event(`:query-update`, {bubbles : true});
		Ev.QueryTbl = this.QueryTbl;
		this.El.dispatchEvent(Ev);
	};

	get QueryTbl() {
		/*
			`tag_oNE -taG_two score:>=100`
		becomes:
			new Map(Object.entries({
				"tag_one" : `include`,
				"tag_two" : `exclude`,
				"score:>=100" : `unknown`,
			}))
		*/

		let QueryParts = this.El.value
			.toLowerCase()
			.trim()
			.replace(/\s+/g, ` `)
			.split(` `)
		;

		let Tbl = new Map();

		for (let X of QueryParts) {
			if (X.includes(`:`) || X.includes(`*`) || X.includes(`~`)) {
				Tbl.set(X, `unknown`);
			} else if (X.startsWith(`-`) && X.length >= 2) {
				Tbl.set(X.slice(1), `exclude`);
			} else {
				Tbl.set(X, `include`);
			};
		};

		return Tbl;
	};

	set_query_from_tbl(Tbl) {
		let Parts = [];
		for (let [X, Mode] of Tbl.entries()) {
			if (Mode === `exclude`) {X = `-${X}`;};
			Parts.push(X);
		};
		this.El.value = Parts.join(` `);
		this.on_query_update();
	};
};

class TagSetCtrlrº {
	constructor(TagDescrs, ImageId) {
		this.El = document.createElement(`ul`);
		this.El.Ctrlr = this;
		this.El.classList.add(`tagset`);

		this.El.insertAdjacentHTML(`beforeend`, `
			<div class="tags-header">
				<h5 class="tags-title">Tags</h5>
				<div class="tags-status"></div>
			</div>
		`);

		this.El.append(...TagDescrs.map((X) =>
			(new TagCtrlrº(X)).El));

		delete_whitenodes(this.El);

		window.addEventListener(`focus`, () => this.on_pref_update());
		window.addEventListener(`blur`, () => this.on_pref_update());
	};

	get Tags() {return this.El.querySelectorAll(`:scope > li`);};

	q(X) {return this.El.getElementsByClassName(`tags-${X}`)[0];};

	on_search_query_update(QueryTbl) {
		for (let Li of this.Tags) {
			Li.Ctrlr.SearchQueryStatus =
				QueryTbl.get(Li.Ctrlr.TagDescr.Name) || null;
		};
	};

	on_pref_update() {
		;
	};

	apply_tag_type(Name, Type) {
		if (Type === `general`) {Type = `tag`;};

		let X = new URLSearchParams(``);
		X.set(`tag`, Name);
		X.set(`type`, type);
		X.set(`commit`, `Save`);

		http_request({
			Addr : `/index.php?page=tags&s=edit`,
			Method : `post`,
			Mime : `application/x-www-form-urlencoded`,
			Body : X,
		}).then((Resp) => {
			//
		}, (Xcep) => {
			//
		});
	};

	http_request({Addr, Method, Mime, Body,}) {
		return new Promise((resolve, reject) => {
			fetch(Addr, {
				method : Method.toUpperCase(),
				headers : new Headers({"Content-Type" : Mime,}),
				body : Body,
				mode : `same-origin`,
				cache : `no-cache`,
				redirect : `manual`,
				referrer : `no-referrer`,
				referrerPolicy : `no-referrer`,
			}).then((Resp) => {
				enforce(Resp.ok);
				resolve(Resp);
			}, (Xcep) => {
				reject(Xcep);
			});
		});
	};
};

class ImageTagSetCtrlrº extends TagSetCtrlrº {
	constructor(TagDescrs, ImageId) {
		super(TagDescrs, ImageId);

		this.El.classList.add(`tags-editable`);
		this.ImageId = ImageId;

		this.q(`title`).insertAdjacentHTML(`afterend`, `
			<figure class="tags-refresh" title="Refresh tags"></figure>
			<figure class="tags-togglectrls"></figure>
			<button class="tags-apply">Apply</button>
			<button class="tags-discard">Cancel</button>
		`);

		this.El.insertAdjacentHTML(`beforeend`, `
			<div class="tags-footer">
				<div class="tags-add-form">
					<figure class="tags-add-btn" title="Add tag"></figure>
					<input type="text"></input>
				</div>
			</div>
		`);

		delete_whitenodes(this.El);

		this.q(`togglectrls`).addEventListener(`mousedown`, (Ev) => {
			if (Ev.button !== 0) {return;};
			GM_setValue(`tagset-show-extra-controls`,
				!GM_getValue(`tagset-show-extra-controls`, false));
			this.on_pref_update();
		});

		this.on_pref_update();
	};

	on_pref_update() {
		super.on_pref_update();
		letx((X = GM_getValue(`tagset-show-extra-controls`, false)) => (
			this.El.classList.toggle(`tags-extractrls`, X),
			this.q(`togglectrls`).title =
				`${X ? "Hide" : "Show"} extra controls`
		));
	};
};

class GalleryTagSetCtrlrº extends TagSetCtrlrº {
	constructor(TagDescrs) {
		super(TagDescrs);

		this.El.classList.add(`tags-extractrls`);
	};
};

class TagCtrlrº {
	constructor(TagDescr) {
		this.TagDescr = TagDescr;
		this.El = document.createElement(`li`);
		this.El.Ctrlr = this;
		this.El.setAttribute(`tag-type`, TagDescr.Type);
		this.El.classList.add(`tag`);
		this.El.classList.add(`tag-type-${TagDescr.Type}`);

		this.El.insertAdjacentHTML(`beforeend`, `
			<span class="tag-ctrls"></span>

			<a class="tag-link" href="${
				textcontent("/index.php?page=post&s=list&tags="+TagDescr.Name)
			}">
				${textcontent(TagDescr.Name.replace(/_/g, ` `))}
			</a>

			<span class="tag-count" title="Total usage count">${
				TagDescr.Count}</span>

			<form class="tag-config-form">
				<fieldset class="tag-type-options">
					<legend>Type</legend>
					${[`general`, `artist`, `character`, `copyright`]
						.map((X) => `
							<label>
								<input name="tag-type" value="${X}" type="radio"
									${X === TagDescr.Type ? 'checked="1"' : ""}
								></input>
								<span>${X}</span>
							</label>
						`)
						.join(``)}
				</fieldset>
				<button class="tag-config-apply-btn" disabled="true">
					Apply</Button>
			</form>
		`);

		let CtrlsBox = this.q(`ctrls`);
		for (let Xª of TagCtrlrº.ControlButtonDescrs) {
			let X = Xª; // bugzilla 1101653

			CtrlsBox.insertAdjacentHTML(`beforeend`, `
				<figure class="tag-btn tag-${X.Name}-btn"
					${X.Type ? 'type="'+X.Type+'"' : ''}
					state="${X.State}"
					title="${X.Title}"
				><div></div></figure>
			`);

			CtrlsBox.lastElementChild.addEventListener(`click`, (Ev) => {
				if (Ev.button !== 0) {return;};
				X.on_action.call(this, Ev);
			});

			//(X.init || (() => {})).call(this, X);
		};

		this.q(`type-options`).addEventListener(`change`, (Ev) => {
			/* enable apply only when selected type differs from current type */
			this.q(`config-apply-btn`).disabled = Ev.currentTarget
				.querySelector(`input[value="${TagDescr.Type}"]`).checked;
		}, true);

		this.ConfigFormIsOpen = false;
	};

	q(X) {return this.El.getElementsByClassName(`tag-${X}`)[0];};

	static get ControlButtonDescrs() {return [
		{Name : `config`, Title : `Configure tag`, State : `off`,
			on_action : function(Ev) {
				this.ConfigFormIsOpen = !this.ConfigFormIsOpen;
			},
		},
		{Name : `searchin`, Title : `Include in search`, State : `off`,
			on_action : function(Ev) {
				this.on_searchbutton_toggle(Ev.currentTarget, `include`);
			},
		},
		{Name : `searchex`, Title : `Exclude from search`, State : `off`,
			on_action : function(Ev) {
				this.on_searchbutton_toggle(Ev.currentTarget, `exclude`);
			},
		},
		{Name : `toggle`, Title : ``, State : `on`, Type : `edit`,
			on_action : function(Ev) {
				//
			},
		},
		{Name : `edit`, Title : `Edit tag`, State : `on`, Type : `edit`,
			on_action : function(Ev) {
				//
			},
		},
	];};

	get ConfigFormIsOpen() {return !!this._ConfigFormIsOpen;};

	set ConfigFormIsOpen(X) {
		this.El.classList.toggle(`tag-config-is-open`, X);
		this.q(`config-btn`).setAttribute(`state`, X ? `on` : `off`);
		this.q(`config-form`).setAttribute(`state`, X ? `open` : `closed`);
		this._ConfigFormIsOpen = !!X;
	};

	set SearchQueryStatus(Status) {
		enforce([`include`, `exclude`, null, undefined].includes(Status));
		this.q(`searchin-btn`).setAttribute(
			`state`, Status === `include` ? `on` : `off`);
		this.q(`searchex-btn`).setAttribute(
			`state`, Status === `exclude` ? `on` : `off`);
	};

	on_searchbutton_toggle(X, Mode) {
		let Ev = new Event(`:search-tag-toggle`, {bubbles : true});
		Ev.Tag = this.TagDescr.Name;
		Ev.Mode = X.getAttribute(`state`) === `off` ? Mode : null;
		this.El.dispatchEvent(Ev);
	};
};

let parse_tag_list = (TagList) => {
	let NameSet = new Set();
	return [...TagList.children]
		.filter((X) => X.tagName === `LI` && X.hasChildNodes())
		.map((X) => {
			/* check for cached descriptor */
			if (X.TagDescr) {return X.TagDescr;};
			/* create new descriptor */
			return ({
				Name : [...X.children]
					.find((Y) =>
						Y.tagName === `A` &&
						Y.getAttribute(`href`)
							.startsWith(`index.php?page=post&s=list&tags=`)
					)
					.textContent
					.trim()
					.replace(/ /g, `_`)
					.toLowerCase()
				,
				Type : [...X.classList]
					.find((C) => C.startsWith(`tag-type-`))
					.replace(/^tag-type-/, ``)
				,
				Count : parseInt([...X.children]
					.find((Y) =>
						Y.tagName === `SPAN` &&
						/^\d+$/.test(Y.textContent.trim())
					)
					.textContent
				),
			});
		})
		.filter((X) => {/* remove duplicates */
			if (NameSet.has(X.Name)) {return false;};
			NameSet.add(X.Name);
			return true;
		})
		.sort((X, Y) =>
			X.Name < Y.Name ? -1 : X.Name > Y.Name ? 1 : 0
		)
	;
};

/* --- miscellaneous --- */

let letx = (f) => f();
let letif = (X, f) => X ? f(X) : undefined;

let enforce = (Cond, Msg) => {
	if (!Cond) {throw new Error(Msg);};
	return Cond;
};

let query_xpath_all = (Expr, Root = document.body) => {
	let Iter;
	try {
		Iter = document.evaluate(
			Expr, Root, null,
			XPathResult.ORDERED_NODE_ITERATOR_TYPE,
			null
		);
	} catch (X) {
		console.error(X);
		console.log(`irritant: `, Expr);
		throw X;
	};
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
		try {
			Style.sheet.insertRule(Rule, Style.sheet.cssRules.length);
		} catch (X) {
			console.error(X);
			console.log(`irritant: `, Rule);
			throw X;
		};
	};
};

let sets_eq = (S1, S2) => {
	if (S1.size !== S2.size) {return false;};
	for (let X of S1) if (!S2.has(X)) {return false;};
	return true;
};

let textcontent = (Txt) => {
	let X = document.createElement(`span`);
	X.textContent = Txt;
	return X.innerHTML;
};

let delete_whitenodes = (Root) => {
	/* delete all whitespace-only text nodes */
	for (let X of query_xpath_all(
		`.//text()[normalize-space(.)=""]`, Root
	)) {
		X.remove();
	};
};

/* --- assets --- */

let global_style_rules = () => [
	`* {
		--c-ctrl-hi : #5CCD7F;
		--c-ctrl-bg : rgba(255,255,255,0.4);
		--c-tag-artist : #a00;
		--c-tag-character : #0a0;
		--c-tag-copyright : #a0a;
		--ff-narrow : "tahoma", "trebuchet ms", "arial", sans-serif;
	}`,

	/* --- tagset --- */

	`.tagset {
		margin-top : 0.5em;
		padding-bottom : 1px;
		/*overflow : auto;*/
		white-space : nowrap;
	}`,

	`.tagset button {
		border : 1px solid black;
		background-color : white;
	}`,

	`.tagset button {
		border : 1px solid black;
		background-color : white;
	}`,

	`.tagset button:not([disabled]):active {
		background-color : var(--c-ctrl-hi);
	}`,

	`.tagset button[disabled] {
		border : 1px solid white;
		background-color : #ccc;
	}`,

	/* --- tagset header --- */

	`.tags-header {
		display : flex;
		margin-bottom : 0.4em;
	}`,

	`.tags-header > * {
		margin : 0;
	}`,

	`.tags-header > *:not(:last-child) {
		margin-right : 0.5em;
	}`,

	`.tagset:not(.tags-modified) .tags-apply,
		.tagset:not(.tags-modified) .tags-discard,
		.tagset.tags-modified .tags-title,
		.tagset.tags-modified .tags-togglectrls,
		.tagset.tags-modified .tags-refresh
	{
		display : none;
	}`,

	`.tags-togglectrls {
		width : 16px;
		height : 16px;
		cursor : pointer;
		background-image : url("${IconTbl.UiButtons}");
		filter : brightness(90%);
	}`,

	`.tagset:not(.tags-extractrls) .tags-togglectrls {
		opacity : 0.4;
	}`,

	`.tags-refresh {
		width : 16px;
		height : 16px;
		cursor : pointer;
		background-image : url("${IconTbl.RefreshArrow}");
		/*filter : hue-rotate(-75deg);*/ /* blue -> green */
	}`,

	`.tags-status {
		margin-left : 0.5em;
		min-height : 1em;
		padding : 1px 0.4em;
		border-radius : 5px;
		background-color : rgba(0, 0, 0, 0.12);
		background-repeat : no-repeat;
	}`,

	/* --- tagset footer --- */

	`.tags-footer {
		margin-top : 0.6em;
		margin-left : calc(2px + 0.01em);
	}`,

	`.tags-add-form {
		display : flex;
	}`,

	`.tags-add-btn {
		margin : 0;
		margin-right : 0.3em;
		width : 16px;
		height : 16px;
		border-radius : 3px;
		background-image : url("${IconTbl.PlusButton}");
		background-repeat : no-repeat;
		background-position : center;
	}`,

	`.tags-add-btn:not([disabled]) {
		cursor : pointer;
	}`,

	`.tags-add-btn:not([disabled]):hover {
		width : 14px;
		height : 14px;
		border : 1px solid white;
		background-color : var(--c-ctrl-bg);
	}`,

	`.tags-add-btn:not([disabled]):not(:hover) {
		filter : brightness(90%) contrast(120%);
	}`,

	`.tags-add-btn:not([disabled]):hover:active {
		border : 1px dotted black;
	}`,

	`.tags-add-btn[disabled] {
		filter : saturate(0%) opacity(50%);
	}`,

	/* --- tag --- */

	`.tag {
		display : block;
		margin-left : -0.2em !important;
		padding-left : 0.24em;

		width : -moz-fit-content;
		width : -webkit-fit-content;
		max-width : 100%;
		overflow-x : hidden;
		text-overflow : ellipsis;

		border-left-style : solid;
		border-radius : 7px;
	}`,

	`.tag, .tag * {
		border-color : white;
		border-width : 2px;
	}`,

	`.tag.tag-config-is-open {
		margin-bottom : 0.5em;
	}`,

	`.tag:not(.tag-config-is-open) {
		border-color : transparent;
	}`,

	`.tag > * {
		margin-right : 0.3em;
		vertical-align : middle;
	}`,

	`.tag-link {
		border : 1px solid transparent;
		border-radius : 5px;
	}`,

	`.tag-deleted .tag-link {
		text-decoration-line : line-through;
	}`,

	`.tag-added .tag-link::before, .tag-deleted .tag-link::before {
		content : "*";
		display : inline-block; /* text-decoration-line : none; */
		text-transform : full-width;
	}`,

	`.tag-link:hover {
		border-color : white;
	}`,

	`.tag-link:active {
		border-style : dotted;
		border-color : black;
	}`,

	`.tag:hover > .tag-link {
		background-color : var(--c-ctrl-bg);
	}`,

	`.tag-count {
		opacity : 0.3;
		font-size : xx-small;
		font-family : var(--ff-narrow);
	}`,

	/* --- tag controls --- */

	`.tag-ctrls {
		display : inline-block;
		max-height : 16px;
	}`,

	`.tag-btn {
		display : inline-block;
		margin : 0;
		width : 16px;
		height : 16px;
		border-radius : 3px;
		overflow : hidden;
		cursor : pointer;
	}`,

	`.tag-btn:not(:last-child) {
		margin-right : 0.15em;
	}`,

	`.tag-btn:hover {
		width : 14px;
		height : 14px;
		border : 1px solid white;
		background-color : var(--c-ctrl-bg);
	}`,
	`.tag-btn:active {
		border-color : black;
		border-style : dotted;
	}`,

	`.tag-btn > * {
		width : 16px;
		height : 16px;
		pointer-events : none; /* prevents glitchiness (important) */
		background-repeat : no-repeat;
		background-position : center;
	}`,

	`.tag-btn:hover > * {
		width : 14px;
		height : 14px;
	}`,

	`.tagset:not(.tags-edited):not(:hover) .tag-btn[state="off"],
		.tagset:not(.tags-edited):not(:hover) .tag-btn[type="edit"] {
		opacity : 0.1;
		background-image : url("${IconTbl.BlackDot8}");
	}`,

	`.tagset:not(:hover) .tag-btn[state="off"] > *,
		.tagset:not(.tags-editable) .tag-btn[type="edit"],
		.tagset:not(.tags-edited):not(:hover) .tag-btn[type="edit"] > *,
		.tagset:not(.tags-extractrls) .tag-btn:not([type="edit"]) {
		display : none;
	}`,

	`.tag-btn[state="off"]:not(:active) > * {
		opacity : 0.3;
		filter : brightness(80%);
	}`,

	`.tag-config-btn {
		border-radius : 8px;
	}`,

	`.tag-config-btn > * {
		background-image : url("${IconTbl.Gear}");
	}`,

	`.tag-searchin-btn > * {
		background-image : url("${IconTbl.MagnifierPlus}");
	}`,

	`.tag-searchex-btn > * {
		background-image : url("${IconTbl.MagnifierMinus}");
	}`,

	`.tag-toggle-btn > * {
		background-image : url("${IconTbl.MinusButton}");
	}`,

	`.tag-deleted .tag-toggle-btn > * {
		background-image : url("${IconTbl.PlusButton}");
	}`,

	`.tag-edit-btn > * {
		background-image : url("${IconTbl.EditButton}");
	}`,

	/* --- tag config form --- */

	`.tag:not(.tag-config-is-open) .tag-config-form {
		display : none;
	}`,

	`.tag-config-form > * {
		margin-left : 0.5em;
		margin-bottom : 0.5em;
	}`,

	`.tag-config-form * {
		font-weight : normal;
	}`,

	`.tag-config-form > button {
		margin-left : 1em;
	}`,

	`.tag-type-options {
		display : block;
		width : -moz-fit-content;
		width : -webkit-fit-content;
		border-style : solid;
		border-radius : 7px;
	}`,

	`.tag-type-options > * {
		display : block;
	}`,

	`.tag-type-options input[value="artist"] + * {
		color : var(--c-tag-artist);
	}`,

	`.tag-type-options input[value="character"] + * {
		color : var(--c-tag-character);
	}`,

	`.tag-type-options input[value="copyright"] + * {
		color : var(--c-tag-copyright);
	}`,

	`.tag-type-options input {
		display : none;
	}`,

	`.tag-type-options input + span {
		display : block;
		padding : 0.2em 0.5em;
		min-width : 7em;
		border-left-style : solid;
		border-left-color : transparent;
		text-transform : capitalize;
		background-color : var(--c-ctrl-bg);
	}`,

	`.tag-type-options input + span:hover {
		border-left-color : white;
		text-shadow : 0px 0px 2px white;
	}`,

	`.tag-type-options input:checked + span {
		background-color : white;
		font-weight : bold;
	}`,
];

/* icons (CC BY 3.0) from http://p.yusukekamiyamane.com/ */
let IconTbl = {
	TagEdit : `data:image/png;base64,
		iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9i
		ZSBJbWFnZVJlYWR5ccllPAAAAu1JREFUeNqEUW1Ik1EUPu/7brM13drm0GTDyFluA+kL0gK1
		KZmTPn40QlCE/RATsrAiI1AypJX0YYaYkCD+kJoGlh9TiSFZoWyCQqWWkmAf20QbyHRu797O
		nZus+tGBh3Pvc+7znHvPpd5RVE4iwEWbVnvXqtW+LzvVBSRud6ggdn8RMAwDNAFNq5HWw5/x
		g+cGuJlZW5vVaLU6OI7DLXwhFf1xFYy7tw6mBoNBvaWuriVCUIizNTXl9DLH1ee3tj4w22y3
		vF7vCY6D7L+6pAZZNvcZit/Y7fCovR1I5rCAPMVjAYbs6+s/dTrdyofRc02DPQP920Uh4QgR
		syyb1202N2MGt8cDUpmMwkz0wBKD8GJKt+u7vK3FbDOVVxsGe8wgoHwq7CB50dDw2OfzhWah
		SUmBRZeLUyUkhDpgneZF7hkMgm11lWPQBIiJp+tJ8tMr93XetTWgKYp0gd1KJahVqpCZoarq
		ArLDjDI9HZxJSRCHrkFR0vxKIJ6ZmRzWmkrPp03aLSCSHACBULbZBQfE5/PBUFlZiethiqZn
		aQcaKDQa8MnSYS5waO/H9SNxZ0q7U1/1vYWsY43weeI5BFFIIIiJgfyKikt49SH8sRniSUdN
		Oy0QCBheNjc/FMUfhOR916GpsRr0p+tD4m1CIeSVlVXhvAYj4tB3Hi4uBobP1+C6wNrWdm9l
		eTn05miIxWLINZkuUxTVj++f5vF4wIRBhqhh/f7CoY6OhqWlJaDIwKJCLJFATknJVSwMoGA6
		ws+Pj8Pc2Bjw8NonX3d23nG6XJsdyY+ED0mlUsgqKrqGpn3Y+RPhFiYmYMHh2GrAwzf1ZhuN
		1IjFYnahSWQwUrkcjhqN1SjuJeJvU1OwiPgnErVaSCss1O0pKLjxC6cz63RyHsxkT3hS/18w
		CIlErc5NyMioIyYk71Crc5CXk8uQOiIWIUTEIPhhXWhiZLMTES9QKJR8hSLT73aPbrjdX5Hz
		IwLhTLARxRGwvwUYAPtdOq+kzpk5AAAAAElFTkSuQmCC
	`.replace(/\s/g, ""),

	Gear : `data:image/png;base64,
		iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9i
		ZSBJbWFnZVJlYWR5ccllPAAAAoJJREFUeNqkU01oE1EQnk02iTFQE7QihUKRkKTF1iU9+FdQ
		CoWYgAcPegkIeiiIWiHgwUvpQXs1Ggo99OYlFwUhWAhYhZJWUmhMxJbYYk1LFDcmJraSv911
		vjQbevPgg9kZ5vu+eW9n3hM0TaP/WSI+gUCADAYDmUwmEgSBUNRoNJ5jaKjNSyuKsqRjjUaD
		VFWlWCy2X0BfDJ5nd5r9KxZI0Wh0BuRgMHibcznGrrD/wD6hawwHxBdcLte12dnZGYfDcYOF
		hkJBpnL5F3Y0IAcMHHB1nYAj+Xw+xHeZ8FSWf1BPTw+trqY2JElyAkilUhsej8dZKhWpu/s4
		jY+P3+P0s/n5+f0TVCoVqlarL0Oh0KTZbCZZlmlgoN+pqgrBEO/u/iZg4IALTecX+BQX6/X6
		9Xw+v8e7bYqiSMvLy+t+f2AGhhg5YOCAC43+7+T1eh+srCS1hYU32tJSQkun09rg4NA0TwLT
		IMTIAQMHXGigbU2hVqsZq9UaNZsKKYrKoxRZKDYwKizEyAEDB1xoOk3kzo6xP4PExMT9WyMj
		l/q2t7+npqYevkBucvLx1d7eE9Li4tutcPjJXEsoCO+z2WxcP0GcC3zmDt8ZHj7bVyyWyO32
		SLHYOwl4ufyTdna+ELCuriN2nlSEC2x1mshdRZGbkchcSJaLfCOtFI+//prLbRIMMXLAwAEX
		mk4T+ZLALo+Ojj1PJtc1t7s/bLfbHyUSGQ2GGDlg4IALTesd6Y8JY7JarX6bzTZtsVhOwq+t
		fdMymZx2MAcOuPrmrSYKaDHRUbZjbIcA8sM6xQ9sADFP4xNf54/t21tnk9kKrG3qBdCLw20T
		//GCFbY9tj+sVf8KMAACOoVxz9PPRwAAAABJRU5ErkJggg==
	`.replace(/\s/g, ""),

	Cross : `data:image/png;base64,
		iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9i
		ZSBJbWFnZVJlYWR5ccllPAAAAcJJREFUeNqkUz1PAkEQfStggjESejU0GozlGqn8SGywkYIY
		Y0IsaLCwIBTQUN5fMLGm8S8QSWwslVAYjAlUBEJDhCgWwp3nzN6eHqIVl8zN7rx5b+dm9oRt
		25jlmcOMj59f10JAkPcBcXIGWdECyqYn6TfGdZ9S9d4K4gQYx4WCtJzE+G/sKJudwpQABUGn
		GSf5vKzX60jmctL8SYzz+iCdls1mEzuplMIsLSC4iSUh1ClUlpHIZGStVkM0GsVNqVRlIJZI
		yG63i1AohMdKpUrZRQqXz4j7LWA7VSiR/WRSNhsNRRgOh+i02wgGg3hrtRSZelLmI6cExs7n
		KJGVtTX50uupMn0+H157PUWmZpYDXLoWUFPo6MC87jivx4MBFtxOWZYS11VipNdT98DWDVsP
		h2XQNLFIMdc4xpg9OZ3JMdIpRowSXVKt36+yuXvGxn+N0XS+3zj0kG+JSPEi261H5FCLmN9l
		UyNWyZ+Qag54eA6Hbfa8j1A88g+2qrlqCkKIZdovbAG7m8D5E3B5D9xR7IPsk/u7DextABd1
		4OrBwd6J23YFligQ0IPwXE7lbedXUAPya5yHMiLuq5j1d/4SYAAj3NATBGE4PgAAAABJRU5E
		rkJggg==
	`.replace(/\s/g, ""),

	Plus : `data:image/png;base64,
		iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9i
		ZSBJbWFnZVJlYWR5ccllPAAAAatJREFUeNqkU71KA0EQ/vaiib+lWCiordidpSg+QHwDBSt7
		n8DGhwhYCPoEgqCCINomARuLVIqgYKFG5f6z68xOzrvzYuXA3P7MzLffN7unjDH4jw3xx91b
		QXuxU4woNDjUX7VgsFOIH3/BnHgC0J65AzwFjDpZgoG7vb7lMsPDq6MiuK+B+kjGwFpCUjwK
		1DIQ3/dl0ssVh5TTM0UJP8aBgBKGleSGIWyP0oKYRm3KPSgYJ0Q0EpEgCASA2WmWZQY3kazB
		mjP9UhBFEbTWAgA0f9W2yHeG+vrd+tqGy5r5xNTT9erSqpvfdxwHN7fXOQZ0QhzH1oWArLsf
		XXieJ/KTGEZLcbVaTVn9ALTOLk9L+mYX5lxd0Xh6eGyVgspK6APwI8n3x9hmNpORJOuBo5ah
		8GcTc7dAHmkhNpYQlpHr47Hq2NspA1yEwHkoO/MVYLMmWJNarjEUQBzQw7rPvardFC8tZuOE
		wwB4p9PHqXgCdm738sUDJPB8mnwKj7qCTtJ527+XyAs6tOf2Bb6SP0OeGxRTVMp2h9nweWMo
		KS20l3+QT/vwqfZbgAEAUCrnlLQ+w4QAAAAASUVORK5CYII=
	`.replace(/\s/g, ""),

	MagnifierPlus : `data:image/png;base64,
		iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9i
		ZSBJbWFnZVJlYWR5ccllPAAAAr9JREFUeNp0k19IU1Ecx8/9t9zudm+3ectW23QuTZmM1JyC
		5ZxFD5KFQUQxXxT681A47cGXIPIlKAqCQsikeoiiAikiKvIliuE0FJ04H6SwSa42h27e7f7r
		HNnMxvrBh3POj9/39/udfxjIWGFhISgvLwdGo3F9TRAEgsMwzAmXJggNSUDCqqpOyLIcgwAS
		iZA4K9xkJTo921zX0laxr3q/3cQzRelUKur3+2c/vH5hW4lHR2DMPNHQ0AC0Wi2AWTeAxtHM
		1tb2zt6DpWV7HZbtDE/iGKmhKIO1uNhaZKsyzEyM4ikhOY+jNnKRJKna5WmrNHBGK0drNDgG
		sGxbaG7ZvdPeeOR4FYoj0+k0yGPmPY4aC5qEY2sCIjeg0llb8nzojpkURTFfArZAq90mK+vb
		ARW7GCY3YCG6RkEt+78OkooorABiC5tPvL4VOb0CtUk8lUqBPCzMjH8JkwROiJIq54pRY1Pj
		n3+gOJzjOMCyLDAYDECv1wOapoFGo5kbfjq0QEmrYlpW/q2MY0T898+lwbu3ZxKJxCiemx1e
		o5WiqGPnz57r7zp11P92+FlIFYWkVkMU+Ka7zdXva811D+v54PTUG0EQfmEejwcoipKlUqej
		232+y9e83tP9sVj0CczpgJRCGOkW09F1ptN0/9XQJDErOeVSHJCbKtfz/I62np6+Pq/35E0o
		fgTdc2oZGZR9ugH4EmrgejEux01AUkQoDgAVjGFutxtVbrXZyg53d/dd8npP3AsGpwZhwjHF
		jgP1IvoCINDc7qnJ3e7Iy49jwGKxAJfL1RsKLalNTS0PSJI8BD/Q3yg7bPICPQBuMAGE4/sB
		NTtHfhRZwPN8I6zoXl5eXoTP8xP0oauTMogb41X9O1OH1Rl+/O0ruLLqQnHoDKRIJDIJxyA6
		igxKHmQQSY+Gr4cUQGGBjE/9I8AAGStQh6qrcL4AAAAASUVORK5CYII=
	`.replace(/\s/g, ""),

	MagnifierMinus : `data:image/png;base64,
		iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9i
		ZSBJbWFnZVJlYWR5ccllPAAAApVJREFUeNpiZIACERERBnV1dQZhYWEwn5mZGYQFGRkZ9YFc
		KSDmBuKvQPzs////F//+/fseiBlYQJpAmmEakYAiFw+/o5mzn6ahkamKlCifxK+fP9+dPHny
		5p4ta5U+f3y3H6jmPrOlpSUDJycnA9BUOAYCQW4+Ae+g5BI7ZTUNHTkxPlEWJkYWNlZWXnkF
		BXkJJV3e6xdPM/388e0+E8gZ6PjPnz9G5k5+WryCwvKC3GxsTIwMjDBngdhyMpIqNu4BuiB1
		LL9+/WLAAmRVdYzlQIxn77//AGF0BVr6Jopr5k+WZfn9+zc2A/g5ODmF/v4De4dBU5qPD13B
		k3ffWYF6+XG54Nu/3z8+MzCz82PTDPbK31+fgXq/Mf38+ZMBC35y/dzxZyzMTMy///z/i64Z
		5LAr5449BaljEhQUZODn52fg5eVl4OHhYeDm5mZgY2O7vXHl/Cesf778/vX3H6rNTIzMH9++
		fDV32oTrX79+Pc2EbjowGuVZWVn9M9MzWlIifE/u2Ljq1v/fP75xsjFzMP79+X3HxjU3Qv29
		jl67emXbjx8/3jA6OTkx/Pv3D4a1uLi4g4qKSptjY6Na3r9/txxopg4QKwMxKCw+AfHd4H//
		DmgzMr5SBaVEJJstREXF/YqLKytjY8N6gZoXAYVva/z/f63q79+ZwIRgjOTQMrAeBoazLFCb
		vZWV1V0LCyvzY2ODpz9+/Gg50MDbqkC5HGDKBFprHB8XZ4zu3YWLFgFTlZwcg6SkZMnixZu7
		U1Mj5x89enAZMDXugSZpBiUgdmBgmCmH6gIweAR0ASiJcoiKitoANTh8+PDhOTB5HgGKgaLu
		DxT/RqJ/I/FBav6CDACFgxCU/g/F/7Dgv2g0WB1AgAEAWtRFcjbMlj0AAAAASUVORK5CYII=
	`.replace(/\s/g, ""),

	RefreshArrow : `data:image/png;base64,
		iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9i
		ZSBJbWFnZVJlYWR5ccllPAAAAt9JREFUeNqkU0tPE1EUPtOZQh9QSVsKtAgB5A3RWDRaU+PC
		R4RUDSZGSTeuiDvjD3DRhJ1xYeI/MJi4wMRHosTEuJCNEqJBQQtFaAuhb0amnee9nlsLNW5c
		OMk3c+fc8333nO/McJRS+J9LYLfjD1ZBMJtBEAQw8byX47hxDAcQPZW874g5PGyGELLJ83wY
		34Nvb3omhb8EQwJPI4cO2tytjRanwybYWFAs6v2JtByMrktXCaVzhq5f2COY9qmUhqy1MHXl
		tOdIm9PSyulgK5UMUBSCZXK2dpeldeyk+4yO5PCY14/PaguUEC/PkchYoGk4tVmCkqrLK1tS
		MpEuFth+h8/ecKzf1ZVNy3D9vM+/k1dBU9VqBbqqjnf5rO6tuAjZ/K785kPiy3qycBeFRzRZ
		HonGcq+mX0bnPS1WWI/mQNd00BWlKqAqyim3w+zcyRfhayybRPX7aNi0JIpsL4w4cSs86Bfz
		JWhwWcBiFVi82gKe0s1znE2SNUhuFwo4iWlD0wAdZ94E2ajvPZyb/9NtnNT8vgBTkxQdJIOU
		18QwwDB0qLVY2XgnmRDrGUn+kcPt9c1NdfT568X1aguyHN0uyEXJJIDjgLUBPZlQSzLkUinI
		ZzKwg8Aqj9bV1ZzDnKF4erdRUxTzvgC+vF+LZ3KiUAstvW0+PO0Olj1R2cMu6CjGrnn72lsw
		h9tIZFWM71YFVHVmbflHhtitkODtlqHRwKCnrTGCU/iIeIfr20MXAwNJcz1lORvRuIScbNkL
		ZpAj/Jj1HeLttinX5dHhkk7BbubAUVPWF0WVJCWNxqwCt5J9+mLBKMmzaPSW+OjGbwE0B0ye
		PjD1XgqZfMMRc0+3m+vscBKni33KoimXjdHV2JIWjX4mycUn5NuzGEktQ5lbEWDTcCHcnGeg
		mes8GwRn9yDw5k6MSaDLC5BZ+kRXZpdpfu0nxtKIDHL1PQFWq60C4R9/sFEWBSgil/wSYABg
		+JOXZhLaRAAAAABJRU5ErkJggg==
	`.replace(/\s/g, ""),

	EditButton : `data:image/png;base64,
		iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9i
		ZSBJbWFnZVJlYWR5ccllPAAAAhJJREFUeNqkk89rE1EQx79vfySNbSm4rNSLIkgrPUfUg5eA
		CAqhrCD2B3joH+Kf4kEonjxUEEXIJWiMNNfgoRclbCRJC8s27O7bX868zRZbi0UcGHbfvveZ
		+c7MW5HnOf7HjNcvBARQEQJ1Wt8kr13ABOQHlHefUkuDv9DL7dV728/X7m47ZmXeOnX8jMJY
		Tg/7nVdvvn3Zpbz4ZGSZ+r5y686WkweJJQPvItXWav2Z0/+82ykCFAkWBEwrDKfnEuPxGK1W
		C41GA7Ztw6jVLOIWeE9LSQG5LqMIQRD84YPBQMFs/IzTFFEYKoZZg9ZsupQSEQUpLaUN13UL
		KI7V2tnYwGg0glmp0Bq6mkJa9EBPZ4cyakpIGYbDIdrtttoUNKInBM8ZBiJSxaNnBSpAUigw
		MoKTJFHwZDJBt9tFhTKxPXYcBUuCNU1TkyHOOKWAe8Bl8IFer4dqtao2HjabmNN1SAqs6/rJ
		aEsFGivgaFwnw1zz081NFeDR+joumSaSWeDSuSRmmC2baHBUzmAS8G5vD1s7O/BofDEpO8n8
		m6VlCXHCFwqRDI8906wtNaletuOjI2TUk/PgKPQ94tTI9ANXYOUarsgouGov37BFLqosmZvK
		Us96GPh+r/P2q+v++PDyPfqc/vLSvLj+oI77yxbWNIHFv91juoH+z0P0P+6j7U3z72L29y2q
		PvybJeT+LwEGAHYXG2+hHqmoAAAAAElFTkSuQmCC
	`.replace(/\s/g, ""),

	PlusButton : `data:image/png;base64,
		iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9i
		ZSBJbWFnZVJlYWR5ccllPAAAAelJREFUeNqkU81qFEEQ/tr50UncrI4iwq6oRJCIIV6zxFxE
		9iCIbxHwXXwA32CPXgRFEZFgPGgiIcfNn0hgYU1mnV070zPTbXXP7Mwke4hgNzVT3f3VV9VV
		1Uwphf8ZDJ2r9GUXSVuhdZvEP8PmkOQtFF5CqaFttpRauXN99vmDmwtNz7ngVtGnI+QxF9/3
		Nme3ezt6+cJGavbbCzfmm+JP5ApEBXgwGJh/vV6vcrj3G/ea2wc77ZzAePAtWG54HBaoMAzx
		efm10VufnqBWqxVnnue5ZGeuaiPJQoyiCJzzAiSEOKFXzxhjGNsVBBpUJdF6v9836/0f+5BS
		Zga2Dd/3JwniOMZoNMK3x+/R6/UwHA4NgeM4+PronTHUMvemhTAKJwnSNAVPOLrdrsm8Bmvj
		seFYQDVKnKRCEGfKkThC4AR4uPU0uyhhNpY+GKP5j8samY0ZcsaodPGpCAIrgJoifWpccJRe
		L+vUl3WUNCciENQBOIcqqiQ4j5JYNxfNMoLIZPcwllQGD2UXkse59VamN072suSSSiZ1S8PC
		Lt3nFq5Jnt61G+40m2aWua+dvwo/13MhnDj+MviZHkQddMQaM5AZdhtL7BmuYJHWl854TAF+
		YQ2r6hV+q12Wp6eGMs//OhLd8X8FGACYiuElnjs9iAAAAABJRU5ErkJggg==
	`.replace(/\s/g, ""),

	MinusButton : `data:image/png;base64,
		iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9i
		ZSBJbWFnZVJlYWR5ccllPAAAAYFJREFUeNqkUsFKw0AQfdtsF0yiiFIPUkQtovTYQ6Ggh556
		9S8K/osf4B/Um+DJu6X+QXKroORUS2jTNE2axFmTBjHURhx4YXez782b2WFxHOM/we8ZAwN0
		Qpf2HcLeBs6Y8ERp7wgOlye06B7V6zcXrVZVqKpYx5Rufdf1jcGg9mYY8uiWh8m/zlmzWXU8
		T8DzNrkWp41G9dUwOt8F9qJSSTiOU6huTdNEmJbKl+mhR5mn02khAVnKipcJuK6L2WyWXQqC
		AC7tJXzfx3KZ3OSco1Kp5AVWl676fViWBdu2oSiKtAtd1yFE0tvHWg3zySQvIMk+lWCa5te6
		XC7nyDK2JIncZQJBuliMx4hHI5jt9q/164QSJQh+OmAkoFJz1CJdjKK8A0E9KByUKHOwSMcz
		pC5SfaIIfx5F/iIZaShD+hwDB/MwPD/kXNMYU+R8r4Mkv3jeuxWGvR4wYHIKd4CTS+B6H2jR
		fneDAfuDiM/AwwQYsvRlttMEfwnZx+mnAAMAHAutdoqA2jQAAAAASUVORK5CYII=
	`.replace(/\s/g, ""),

	UiButtons : `data:image/png;base64,
		iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9i
		ZSBJbWFnZVJlYWR5ccllPAAAAXNJREFUeNrEk8tqwlAQhicnxxClFCULaTYVlD6Bq0DAVV/A
		B+iT+A55ESXtossiUuimy4BSyMJFUzeKhMQE46X/pJdN66W46IGfcOac+flmJkfZbrd0yhJ0
		4pKdTocURaH1ek1CCE1V1Sbidai4Jy+BfOQ8yxxDCMqyjDabTdOyrJtWq9XWdd3YlZ2m6bTf
		73cHg8FHCUxQKBT44Mq27baU0litVrRLfM73+D4TaGhkExR1mFx7nmeA5GetUlKlUqFqtUoo
		MzdZLBYlCcdjscn3fRqPx2SaZk4cx7EQf8CmWq1Gk8mElsslhWE4jaIolTkGkjl4cGQwYRJo
		5rruHUxeJGNwMk/h0GJsx3Hc0Wj0gPtv8/ncl4zBOGiMccgAtDNQPAZB0MWWf+FQRUPOUGOx
		0WhcappW5JH+piRJZr1e73Y4HN6Xy2UPvYhgkClIukDAgrOJgL4HIP3EfsL39SuoQCXo/Mh3
		kWND8bfBv7/GdwEGAPvu4dGLBqEtAAAAAElFTkSuQmCC
	`.replace(/\s/g, ""),

	Tick : `data:image/png;base64,
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
	`.replace(/\s/g, ""),

	Info : `data:image/png;base64,
		iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9i
		ZSBJbWFnZVJlYWR5ccllPAAAAmVJREFUeNqkU01rE2EQnt3sV2JiGslHTUMTCznVEqTYVtJD
		sBd7FH+AQYSCVwnUH+BB0ouIh6hIwZMeepMieAjStHgICLmIgaQtNVUSaTeJSbq72TjzrrsY
		8ebA8348M8+878y+y41GI/gfE2jI3CmB1+sDv38CFMWd4Hl+DelVRPJ3XBWxbZpmYTDo76vq
		KXS7HSi+TFsJbMOALA9n+cwVb/Da3DmIhix3o2mk9io/U8Vy/y7G5JDaHLuBLXaLg8L67biU
		uCiBVdqQ+aYjHMQnfbB0WQ4+fHFQUE0T7CQ8DbquJ0yjl1/PTkmxEE97MAwDS9tloDVx5KMY
		iiWNk6DT6a6tLPiDsbDLERPa7TaDvWdJMOb6VX+QNE4J/f5gdWUpzAJso/X7ZwswHJpQq9Vx
		NhjvcgmwOOuB528G1OQHglU/n0xEPThr7CRVbUOv14eb978w0dZGEnjeahe1JhJwMY1zA0Hw
		oIducobiDjUUTxItnvmlsW8/wsodHw2Kcr5aPeylLng0FEoIKxB5NouiMpbgqGlpnCa63YHt
		D2WdHhFIkuwAeYY/OVlWYK9iaZwEsuwrFMtcq6lSAjc7kaAofgZ7Tzj+IcNuRWyRxkmA9e5r
		hpLbeGVo309kFigICrx9EmGgNXENFD9+DRrFkoa0HL24mfkccJwLAtHlbGxmOZ+Zl4LplAhT
		YZ4196g5hNInHYplvfW1vpOrlR9tnjR22GtlCTiOsxsaCcVvzE7P3bs1MbmY5njxEuu6qddP
		v30sHVaebjUP3n1G6hih/Z2AyvEiPHZp/zD6Qfr0eOlHIe0vAQYA3M8ZunBCGsoAAAAASUVO
		RK5CYII=
	`.replace(/\s/g, ""),

	Warn : `data:image/png;base64,
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
	`.replace(/\s/g, ""),

	WhiteDot8 : `data:image/png;base64,
		iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1B
		AACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAZdEVYdFNvZnR3YXJlAHBhaW50Lm5l
		dCA0LjAuMTM0A1t6AAAAcklEQVQ4T2P4//8/AyWYIs0giwevASpA560H4u9QDGKDxDBcjM0L
		IIWfgRgdgMQwDMFmAMg2XAAkh6IHmwEgZ+MCIDnaG7AZjwtAcgRdoIMnEEFyBA0AKQApBNkG
		i0YQG0MzyLDBmxKJdhnRCrElY5AYAEc9L1oUOhIkAAAAAElFTkSuQmCC
	`.replace(/\s/g, ""),

	RedDot8 : `data:image/png;base64,
		iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1B
		AACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAZdEVYdFNvZnR3YXJlAHBhaW50Lm5l
		dCA0LjAuMTM0A1t6AAAAcUlEQVQ4T2P4//8/AyWYIs0giwerAQwMKkDHrQfi71AMYqtgCytM
		L0A0fwb7DhWDxDAMwWYAyDZ0zTD+enRXYDMA5GxcBnyniwGb8bhgMzEu0METiDqEDQAlbQYG
		kCEgl8CiEcTG0DyYUyIJOZTizAQAbMC3wybUVq4AAAAASUVORK5CYII=
	`.replace(/\s/g, ""),

	BlackDot8 : `data:image/png;base64,
		iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAAAAlw
		SFlzAAAOwgAADsIBFShKgAAAABl0RVh0U29mdHdhcmUAcGFpbnQubmV0IDQuMC4xMzQDW3oA
		AABaSURBVDhPY2AYBbhCQAUosR6Iv0MxiA0SIwqAFH4G4v9oGCRGlCEg29A1w/ggOYIA5Gxc
		BoDkCAKKDdiMxwUgOYJAB08gguSIAiCFINtg0QhiE62ZKBuGkSIAhZEyLVvvDhMAAAAASUVO
		RK5CYII=
	`.replace(/\s/g, ""),

	/* ([^\s]{1,72}) => \1\n\t\t */
};

/* -------------------------------------------------------------------------- */

entrypoint();

/* -------------------------------------------------------------------------- */

/*

































*/

/* -------------------------------------------------------------------------- */
