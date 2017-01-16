// ==UserScript==
// @name        Rule34.xxx: Tagging Tools
// @id          rthirtyftaggingtools
// @namespace   6930e44863619d3f19806f68f74dbf62
// @version     2017-01-17
// @include     *rule34.xxx/*
// @domain      rule34.xxx
// @run-at      document-end
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_deleteValue
// ==/UserScript==

`use strict`;

/*
	TODO
		test parallel requests
		tag 'stock' popup
*/

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
			Mts = create_main_tagset_ctrlr().El
		) => (
			TagDescrs.length ||
				console.warn(`main tag set is empty`),

			Mts.id = `tag-sidebar`,

			/* add tags */
			[for (X of TagDescrs)
				Mts.Ctrlr.assoc(X)],

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

		this.SearchBar.addEventListener(`:query-update`, ({detail : X}) =>
			this.MainTagSet.Ctrlr
				.on_search_query_update(X.QueryTbl)
		);

		this.MainTagSet.addEventListener(
			`:search-tag-toggle`, ({detail : X}) => {
				let Tbl = this.SearchBar.Ctrlr.QueryTbl;
				if (X.Mode) {
					Tbl.set(X.Tag, X.Mode);
				} else {
					Tbl.delete(X.Tag);
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
		super(() => new ImageTagSetCtrlrº(ImageId));
		this.ImageId = ImageId;
		this.EditForm = enforce(document.getElementById(`edit_form`));

		this.MainTagSet.Ctrlr.mark_clean();

		let InitialSourceBox = query_xpath(
			`//li/text()[contains(., "Source:")]/..`,
			document.getElementById(`stats`)
		);
		let SourceTxt = this.EditForm.querySelector(`input#source`).value;
	};
};

class GalleryPageCtrlrº extends PageCtrlrº {
	constructor() {
		super(() => new GalleryTagSetCtrlrº());
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
		this.El.dispatchEvent(new CustomEvent(`:query-update`, {
			bubbles : true,
			detail : {QueryTbl : this.QueryTbl,},
		}));
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
	constructor() {
		this.PendingRequCount = 0;

		this.El = document.createElement(`ul`);
		this.El.Ctrlr = this;
		this.El.classList.add(`tagset`);

		this.El.insertAdjacentHTML(`beforeend`, `
			<div class="tags-header">
				<h5 class="tags-title">Tags</h5>
				<figure class="tags-spinner"></figure>
				<div class="tags-status"></div>
			</div>
			<!-- tags -->
			<div class="tags-footer"></div>
		`);

		delete_whitenodes(this.El);

		this.El.addEventListener(`:apply-tag-config`, ({detail : X}) => {
			this.apply_tag_type(X.Name, X.Type);
		}, true);

		window.addEventListener(`focus`, () => this.on_pref_update());
		window.addEventListener(`blur`, () => this.on_pref_update());

		this.Status = {Disp : `hide`};
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

	assoc(Descr) {
		/* maintain sorted order */
		if (![].some.call(this.Tags, (Tag) => {
			let Rel = Descr.Name.localeCompare(Tag.Ctrlr.TagDescr.Name);

			if (Rel === 0) {/* replace tag */
				Tag.Ctrlr.TagDescr = Descr;
				return true;

			} else if (Rel < 0) {/* insert new tag */
				Tag.insertAdjacentElement(`beforebegin`,
					(new TagCtrlrº(Descr)).El);
				return true;
			};

		})) {/* append new tag */
			this.q(`footer`).insertAdjacentElement(`beforebegin`,
				(new TagCtrlrº(Descr)).El);
		};

		this.El.dispatchEvent(new CustomEvent(`:mutated`, {}));
	};

	dissoc(Name) {
		/* remove a tag if it exists */
		for (let Tag of this.Tags) {
			if (Tag.Ctrlr.TagDescr.Name === Name) {
				Tag.remove();
			};
		};

		this.El.dispatchEvent(new CustomEvent(`:mutated`, {}));
	};

	apply_tag_type(Name, Type) {
		let X = new URLSearchParams(``);
		X.set(`commit`, `Save`);
		X.set(`tag`, Name);
		X.set(`type`, Type
			.replace(`general`, `tag`));

		this.http_request({
			Addr : `/index.php?page=tags&s=edit`,
			Method : `post`,
			Mime : `application/x-www-form-urlencoded`,
			Body : X,

		}).then((Resp) => {
			this.assoc({Name : Name, Type : Type,});
			this.Status = {
				Disp : `success`,
				Msg : `Tag type \u2192 '${Type}' for '${Name}'`,
			};

		}, (Xcep) => {
			this.Status = {
				Disp : `warn`,
				Msg : `Error setting tag type for '${Name}'`,
			};
		});
	};

	http_request({Addr, Method, Mime, Body,}) {
		/* ? */
		Method = Method.toUpperCase();

		let Pr = new Promise((resolve, reject) => {
			fetch(Addr, {
				method : Method,
				headers : new Headers({"Content-Type" : Mime,}),
				body : Body,
				mode : `same-origin`,
				credentials : `same-origin`, /* enable cookies */
				cache : `no-cache`,
				redirect : `manual`,
				referrer : `no-referrer`,
				referrerPolicy : `no-referrer`,

			}).then((Resp) => {
				enforce(Number.isSafeInteger(this.PendingRequCount) &&
					this.PendingRequCount > 0);

				--this.PendingRequCount;
				this.El.classList.toggle(
					`tags-requ-pending`, this.PendingRequCount);

				enforce(Resp.ok,
					`${Method} request failed with status ${Resp.status} `+
					`("${Addr}")`
				);

				resolve(Resp);

			}).catch((Xcep) => {
				console.error(Xcep);
				reject(Xcep);
			});
		});

		++this.PendingRequCount;
		this.El.classList.add(`tags-requ-pending`);

		return Pr;
	};

	set Status({Disp, Msg = ``,}) {
		enforce([`success`, `info`, `warn`, `none`, `hide`].includes(Disp));
		this.q(`status`).textContent = Msg;
		this.q(`status`).setAttribute(`disposition`, Disp);
	};
};

class ImageTagSetCtrlrº extends TagSetCtrlrº {
	constructor(ImageId) {
		super();

		this.El.classList.add(`tags-editable`);
		this.ImageId = ImageId;
		this.RemoteTags = null;

		this.q(`spinner`).insertAdjacentHTML(`afterend`, `
			<figure class="tags-refresh" title="Refresh tags"></figure>
			<figure class="tags-togglectrls"></figure>
			<button class="tags-apply" type="button">Apply</button>
			<button class="tags-discard" type="button">Cancel</button>
		`);

		this.q(`footer`).insertAdjacentHTML(`beforeend`, `
			<div class="tags-add-form">
				<figure class="tags-add-btn" title="Add tag"></figure>
				<input type="text"></input>
			</div>
		`);

		delete_whitenodes(this.El);

		this.El.addEventListener(`:mutated`, () => {
			//
		});

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

	mark_clean() {
		/* declare that the current tag set matches the remote set */
		this.RemoteTags = new Set(
			(for (X of this.Tags)
				if (X.Ctrlr.TagDescr)
				X.Ctrlr.TagDescr.Name));

		this.El.dispatchEvent(new CustomEvent(`:mutated`, {}));
	};
};

class GalleryTagSetCtrlrº extends TagSetCtrlrº {
	constructor(TagDescrs) {
		super();

		this.El.classList.add(`tags-extractrls`);
	};
};

class TagCtrlrº {
	constructor(TagDescr /* optional */) {
		this.El = document.createElement(`li`);
		this.El.Ctrlr = this;
		this.El.classList.add(`tag`);

		let TagTypeOptsSrcs =
			[`general`, `artist`, `character`, `copyright`]
			.map((X) => `
				<label>
					<input name="tag-type" value="${X}" type="radio"></input>
					<span>${X}</span>
				</label>
			`)
		;

		this.El.insertAdjacentHTML(`beforeend`, `
			<span class="tag-ctrls"></span>

			<a class="tag-link"></a>

			<span class="tag-count" title="Total usage count"></span>

			<form class="tag-config-form">
				<fieldset class="tag-type-options">
					<legend>Type</legend>
					${TagTypeOptsSrcs.join(``)}
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

		delete_whitenodes(this.El);

		this.q(`type-options`).addEventListener(`change`, (Ev) => {
			/* enable apply only when selected type differs from current type */
			this.q(`config-apply-btn`).disabled = Ev.currentTarget
				.querySelector(`input[value="${this.TagDescr.Type}"]`).checked;
		}, true);

		this.q(`config-form`).addEventListener(`submit`, (Ev) => {
			Ev.preventDefault();
			let X = {
				Name : this.TagDescr.Name,
				Type : (
					for (X of this.q(`type-options`)
						.querySelectorAll(`input`))
					if (X.checked)
					X.value
				).next().value,
			};
			this.El.dispatchEvent(
				new CustomEvent(`:apply-tag-config`, {
					bubbles : true,
					detail : X,
				})
			);
		});

		this.ConfigFormIsOpen = false;

		if (TagDescr) {
			this.TagDescr = TagDescr;
		};
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

	get TagDescr() {return this._TagDescr;};

	set TagDescr(X) {
		/* retain unspecified fields */
		X = Object.assign({}, this._TagDescr, X);
		this._TagDescr = X;

		this.El.setAttribute(`tag-type`, X.Type);
		[for (C of this.El.classList)
			if (C.startsWith(`tag-type-`))
			this.El.classList.remove(C)]
		this.El.classList.add(`tag-type-${X.Type}`);

		letx((A = this.q(`link`)) => {
			A.href = `/index.php?page=post&s=list&tags=${X.Name}`;
			A.textContent = X.Name.replace(/_/g, ` `);
		});

		this.q(`count`).textContent = X.Count;

		letx((O = this.q(`type-options`)) => {
			O.querySelector(`input[value="${X.Type}"]`)
				.checked = true;
			O.dispatchEvent(new Event(`change`, {bubbles : true}));
		});
	};

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
		this.El.dispatchEvent(
			new CustomEvent(`:search-tag-toggle`, {
				bubbles : true,
				detail : {
					Tag : this.TagDescr.Name,
					Mode : X.getAttribute(`state`) === `off` ? Mode : null,
				},
			})
		);
	};
};

let parse_tag_list = (TagList) => {
	/* returns an iterator yielding tag descriptors */
	enforce(TagList.tagName === `UL`);

	let descr_from = (X) => ({
		Name : X.querySelector(`a[href^="index.php?page=post&s=list&tags="]`)
			.textContent
			.trim()
			.replace(/ /g, `_`)
			.toLowerCase()
		,
		Type : [...X.classList]
			.find((C) => C.startsWith(`tag-type-`))
			.replace(/^tag-type-/, ``)
			.toLowerCase()
		,
		Count : parseInt(
			[...X.querySelectorAll(`span`)]
				.find((Y) => /^\d+$/.test(Y.textContent.trim()))
				.textContent
		),
	});

	let NameSet = new Set();

	let Xs = (for (X of TagList.children)
		if (X.tagName === `LI` && X.hasChildNodes())
		X.TagDescr ? X.TagDescr : descr_from(X) /* reuse if cached */
	);

	Xs = [for (X of Xs)
		if (!NameSet.has(X.Name)) /* remove duplicates */
		(NameSet.add(X.Name), X)
	];

	return Xs.sort((X, Y) =>
		X.Name < Y.Name ? -1 : X.Name > Y.Name ? 1 : 0);
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
		flex-shrink : 0;
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

	`.tagset.tags-requ-pending .tags-refresh,
		.tagset:not(.tags-requ-pending) .tags-spinner {
		/* replace refresh button with spinner while requesting */
		display : none;

	}`,
	`.tags-refresh, .tags-spinner, .tags-togglectrls {
		width : 16px;
		height : 16px;
		background-repeat : no-repeat;
		background-position : center;
	}`,

	`.tags-refresh {
		cursor : pointer;
		background-image : url("${IconTbl.RefreshArrow}");
		/*filter : hue-rotate(-75deg);*/ /* blue -> green */
	}`,

	`.tags-spinner {
		background-image : url("${IconTbl.SpinnerStatic}");
		animation-name : tags-spinner;
		animation-iteration-count : infinite;
		animation-duration : 0.36s;
		animation-timing-function: linear;
	}`,

	`@-moz-document regexp(".*") {
		.tags-spinner {
			background-image : url("${IconTbl.Spinner}");
			animation-name : none;
		}
	}`,

	`@keyframes tags-spinner {
		from {}
		to {transform : rotate(1.0turn);}
	}`,

	`.tags-togglectrls {
		cursor : pointer;
		background-image : url("${IconTbl.UiButtons}");
		filter : brightness(90%);
	}`,

	`.tagset:not(.tags-extractrls) .tags-togglectrls {
		opacity : 0.4;
	}`,

	`.tags-status {
		flex-shrink : 1;
		margin-left : 0.5em;
		min-height : 1em;
		padding : 1px 0.7em;
		border-radius : 5px;

		overflow : hidden;
		text-overflow : ellipsis;
		white-space : nowrap;

		font-family : var(--ff-narrow);
		background-color : rgba(0, 0, 0, 0.12);
		background-repeat : no-repeat;
		background-position-x : 0.3em;
		background-position-y : center;
	}`,

	`.tags-status:hover {
		position : fixed;
		overflow : visible;
		background-color : white;
	}`,

	`.tags-status[disposition="hide"] {
		display : none;
	}`,

	`.tags-status:not([disposition="none"]) {
		padding-left : calc(16px + 0.6em);
	}`,

	`.tags-status[disposition="success"] {
		background-image : url("${IconTbl.Tick}");
	}`,

	`.tags-status[disposition="info"] {
		background-image : url("${IconTbl.Info}");
	}`,

	`.tags-status[disposition="warn"] {
		background-image : url("${IconTbl.Warn}");
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
		padding : 0 0.2em;
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

	SpinnerStatic : `data:image/png;base64,
		iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1B
		AACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAZdEVYdFNvZnR3YXJlAHBhaW50Lm5l
		dCA0LjAuMTM0A1t6AAABqklEQVQ4T51STWvCQBQMHkqR/oRSeiweepD+iB5KkeIPiojHUIpC
		kCgJEUQPHqrEDzBCD1ERoZQiIoIhSKxFpfQoRbbvhV3ZtIq0gWGzm5nJvPdWELhntVoJuq6H
		q9VqutPpjPv9/hrRbrfH5XJZyWazV8jZ+RSLxWClUlGGw+FmuVwSIPqAZ4PBgJRKJTWTyZz4
		THK5XLBerz/N53OCxMlkQizLck3TNFqtlgFpprZte4az2YxAGkuW5eDWJJVKJV3XJYvFwhNq
		mnbX7XYDjACpAvl8/rbX603xB47jEEmSFO+7KIqhRCKxaTabxDAMV1XV891FCkKhUDiD/jiQ
		gMTj8Q1ow2jwACCIWCwW2Sdm58C7ZnxY02jwSg9cWLex9xkBBzU21Yxx80k3tUN/51I8Us2a
		N2j81+CFur39oQSHakaY4J5rSvRQCuDecHwZDS4AX1yKvWMEzilgSrk4xkt2FyTOFUuJ8uXg
		OyACwEl5IwfI27SwOQLUuI9IeAc0KNCUCXE1Ace+cqkJJmHl8AL2jrGTv8S8E+0JGj0DPgB4
		T3BS2OzQzyZ/A9LxiMu8X+lbAAAAAElFTkSuQmCC
	`.replace(/\s/g, ""),

	Spinner : /* animated png */ `data:image/png;base64,
		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
	`.replace(/\s/g, ""),

	/* ([^\s]{1,72}) => \1\n\t\t */
};

/* -------------------------------------------------------------------------- */

entrypoint();

/* -------------------------------------------------------------------------- */

/*

































*/

/* -------------------------------------------------------------------------- */
