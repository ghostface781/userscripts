// ==UserScript==
// @name        Pixiv: Animation Converter
// @description Convert Pixiv animation sequences to APNG files.
// @namespace   6930e44863619d3f19806f68f74dbf62
// @include     *pixiv.net/member_illust.php?*
// @domain      www.pixiv.net
// @version     2017-03-21
// @run-at      document-end
// @grant       none
// ==/UserScript==

/* places a 'Convert to APNG' button underneath every Pixiv animation player.
the conversion process is currently very slow, and may appear to completely
freeze your browser. give it at least two minutes before giving up. */

/*
PROTIP: convert APNG files to WebM using FFMPEG:
> ffmpeg -max_fps 60 -i source.png -vsync cfr -r 60 -lossless 1 output.webm

the "-r 60" flag sets the output frame rate; feel free to lower it.

to perform lossy encoding, replace "-lossless 1" with "-crf ## -b:v 0",
where "##" is a number from 0 to 63. lower numbers yield higher quality.
more info: https://trac.ffmpeg.org/wiki/Encode/VP9

the "-max_fps 60" flag affects the input decoder, is very important because the
default maximum is too low.

if FPS problems still occur, try prepending "-default_fps 60" as well.

if you don't specify "-vsync cfr", ffmpeg sometimes doesn't use the correct
delay on the last frame. I believe this is a bug.
*/

/* -------------------------------------------------------------------------- */

`use strict`;

let enforce = (X) => {
	console.assert(X);
	if (!X) {throw new Error(`enforce failed`)};
};

/* NOTE: DataView must be used for reading/writing PNG integers, because they
	are stored as big-endian! */
let ta_to_dv = (X) => new DataView(X.buffer, X.byteOffset, X.byteLength);

let arr_eq = (A, B) => {
	let L = A.length;
	if (L !== B.length) {return false;};
	for (let I = 0; I < L; ++I) {
		if (A[I] !== B[I]) {return false;};
	};
	return true;
};

let SpinnerUri = `data:image/gif;base64,
	R0lGODlhEAAQALMAAP8A/7CxtXBxdX1+gpaXm6OkqMnKzry+womLj7y9womKjwAAAAAAAAAAAAAA
	AAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQBCgAAACwAAAAAEAAQAAAESBDICUqhmFqbZwjVBhAE
	9n3hSJbeSa1sm5HUcXQTggC2jeu63q0D3PlwAB3FYMgMBhgmk/J8LqUAgQBQhV6z2q0VF94iJ9pO
	BAAh+QQBCgALACwAAAAAEAAQAAAES3DJuUKgmFqb5znVthQF9h1JOJKl96UT27oZSRlGNxHEguM6
	Hu+X6wh7QN2CRxEIMggExumkKKLSCfU5GCyu0Sm36w3ryF7lpNuJAAAh+QQBCgALACwAAAAAEAAQ
	AAAESHDJuc6hmFqbpzHVtgQB9n3hSJbeSa1sm5GUIHRTUSy2jeu63q0D3PlwCx1lMMgQCBgmk/J8
	LqULBGJRhV6z2q0VF94iJ9pOBAAh+QQBCgALACwAAAAAEAAQAAAESHDJuYyhmFqbpxDVthwH9n3h
	SJbeSa1sm5HUMHRTECy2jeu63q0D3PlwCx0FgcgUChgmk/J8LqULAmFRhV6z2q0VF94iJ9pOBAAh
	+QQBCgALACwAAAAAEAAQAAAESHDJuYSgmFqb5xjVthgG9n3hSJbeSa1sm5EUgnTTcSy2jeu63q0D
	3PlwCx2FQMgEAhgmk/J8LqWLQmFRhV6z2q0VF94iJ9pOBAAh+QQBCgALACwAAAAAEAAQAAAESHDJ
	ucagmFqbJ0LVtggC9n3hSJbeSa1sm5EUQXSTYSy2jeu63q0D3PlwCx2lUMgcDhgmk/J8LqWLQGBR
	hV6z2q0VF94iJ9pOBAAh+QQBCgALACwAAAAAEAAQAAAESHDJuRCimFqbJyHVtgwD9n3hSJbeSa1s
	m5FUUXSTICy2jeu63q0D3PlwCx0lEMgYDBgmk/J8LqWLw2FRhV6z2q0VF94iJ9pOBAAh+QQBCgAL
	ACwAAAAAEAAQAAAESHDJuQihmFqbZynVtiAI9n3hSJbeSa1sm5FUEHTTMCy2jeu63q0D3PlwCx3l
	cMgIBBgmk/J8LqULg2FRhV6z2q0VF94iJ9pOBAA7`;

let bloburl_to_blobobj = (Url) => new Promise((resolve, reject) => {
	enforce(typeof Url === `string`);

	let X = new XMLHttpRequest();

	X.addEventListener(`loadend`, () => {
		if (X.readyState !== 4 || X.status !== 200) {return reject();};
		resolve(X.response);
	});

	X.open(`GET`, Url, true);
	X.responseType = `blob`;
	X.send();
});

/* --- crc stuff --- */

/* https://www.w3.org/TR/PNG/#D-CRCAppendix */

/* table of CRCs of all 8-bit messages */
let CrcTable;

let make_crc_table = () => {
	/* make the table for a fast CRC */
	CrcTable = new Array(256);

	for (let N = 0; N < 256; ++N) {
		let C = N;
		for (let K = 0; K < 8; ++K) {
			if (C & 1) {
				C = 0xedb88320 ^ (C >>> 1);
			} else {
				C = C >>> 1;
			};
		};
		CrcTable[N] = C;
	};
};

let update_crc = (Crc, Buf) => {
	/* update a running CRC with the bytes buf[0..len-1] ; the CRC should be
	initialized to all 1's, and the transmitted value is the 1's complement of
	the final running CRC (see the crc() routine below) */
	if (!CrcTable) {make_crc_table();};

	for (let N = 0; N < Buf.length; ++N) {
		Crc = CrcTable[(Crc ^ Buf[N]) & 0xff] ^ (Crc >>> 8);
	};

	return Crc;
};

let crc = (Buf) => {
	/* return the CRC of the bytes buf[0..len-1] */
	return update_crc(0xffffffff, Buf) ^ 0xffffffff;
};

/* --- png stuff --- */

let PngSigBytes = [137, 80, 78, 71, 13, 10, 26, 10];

let unpack_png_chunk = (Bytes /* Uint8Array */) => {
	let Dv = ta_to_dv(Bytes);
	let DataLen = Dv.getUint32(0);
	let Type = Bytes.slice(4, 8)
		.reduce((Acc, X) => Acc+String.fromCharCode(X), ``);
	let DataBytes = Bytes.slice(8, 8 + DataLen);
	/* ignore CRC */
	return {Type : Type, Bytes : DataBytes};
};

let unpack_png = (Buf /* ArrayBuffer */) => {
	/* returns array of chunks [{Type : `????`, Bytes : <Uint8Array>}, ...] */

	let Bytes = new Uint8Array(Buf);

	/* validate signature */
	enforce(arr_eq(Bytes.slice(0, 8), PngSigBytes));
	Bytes = Bytes.slice(8);

	let Chunks = [];
	while (Bytes.length) {
		let Ch = unpack_png_chunk(Bytes);
		Bytes = Bytes.slice(12 + Ch.Bytes.length);
		Chunks.push(Ch);
	};

	enforce(Chunks[0].Type === `IHDR`);
	enforce(Chunks[0].Bytes.length === 13);
	enforce(Chunks[Chunks.length - 1].Type === `IEND`);
	enforce(Chunks[Chunks.length - 1].Bytes.length === 0);

	return Chunks;
};

let create_apng = (UnpackedPngs, FrameDelays /* array of ms durations */) => {
	/* returns array of chunks [{Type : `????`, Bytes : <Uint8Array>}, ...] */
	enforce(UnpackedPngs.length > 0);
	enforce(UnpackedPngs.length === FrameDelays.length);

	let FrameCount = UnpackedPngs.length;
	let IhdrChunk = UnpackedPngs[0][0];
	let Width = ta_to_dv(IhdrChunk.Bytes).getUint32(0);
	let Height = ta_to_dv(IhdrChunk.Bytes).getUint32(4);

	/* all frames should have the same header */
	for (let Chunks of UnpackedPngs.slice(1)) {
		enforce(arr_eq(IhdrChunk.Bytes, Chunks[0].Bytes));
	};

	let ActlChunk = {
		Type : `acTL`,
		Bytes : new Uint8Array(8),
	};
	ta_to_dv(ActlChunk.Bytes).setUint32(0, FrameCount);

	let make_fctl_chunk = (SeqNum, DelayMs) => {
		enforce(DelayMs < 0x10000 && !(DelayMs % 1));
		let Ch = {Type : `fcTL`, Bytes : new Uint8Array(26)};
		let Dv = ta_to_dv(Ch.Bytes);
		Dv.setUint32(0, SeqNum);
		Dv.setUint32(4, Width);
		Dv.setUint32(8, Height);
		Dv.setUint16(20, DelayMs);
		Dv.setUint16(22, 1000);
		return Ch;
	};

	let Chunks = [IhdrChunk, ActlChunk];

	/* insert first frame */
	Chunks.push(make_fctl_chunk(0, FrameDelays[0]));
	for (let Ch of UnpackedPngs[0]) {
		if (Ch.Type === `IDAT`) {Chunks.push(Ch);};
	};

	/* insert remaining frames */
	let CurrentSeqNum = 1;
	for (let Idx = 1; Idx < FrameCount; ++Idx) {
		/* insert FCTL chunk */
		Chunks.push(make_fctl_chunk(CurrentSeqNum++, FrameDelays[Idx]));
		/* insert FDAT chunks */
		for (let Ch of UnpackedPngs[Idx]) {
			if (Ch.Type !== `IDAT`) {continue;};
			/* make FDAT chunk */
			let Bytes = new Uint8Array(4 + Ch.Bytes.length);
			ta_to_dv(Bytes).setUint32(0, CurrentSeqNum++);
			Bytes.set(Ch.Bytes, 4); /* copy image data from IDAT */
			Chunks.push({Type : `fdAT`, Bytes : Bytes});
		};
	};

	Chunks.push({Type : `IEND`, Bytes : new Uint8Array(0)});
	return Chunks;
};

let pack_png = (Chunks) => {
	/* preallocate return buffer */
	let TotalSize = Chunks.reduce(
		(Acc, Ch) => Acc + 12 + Ch.Bytes.length, 8 /* sig */);
	let Out = new Uint8Array(TotalSize);
	let Dv = ta_to_dv(Out);
	let Offset = 0;

	Out.set(PngSigBytes, 0); /* write signature */
	Offset += 8;

	/* write chunks */
	for (let Ch of Chunks) {
		Dv.setUint32(Offset, Ch.Bytes.length);
		Offset += 4;

		enforce(Ch.Type.length === 4);
		Out.set(Ch.Type.split(``).map(X => X.charCodeAt(0)), Offset);
		Offset += 4;

		Out.set(Ch.Bytes, Offset);
		Offset += Ch.Bytes.length;

		let HashableBytes = Out.slice(Offset - Ch.Bytes.length - 4, Offset);
		Dv.setUint32(Offset, crc(HashableBytes));
		Offset += 4;
	};

	return Out;
};

/* --- pixiv stuff --- */

let get_frame_pngs = (Meta) => new Promise((resolve, reject) => {
	/* resolves to an array of PNG buffers */

	/* https://github.com/pixiv/zip_player/blob/master/zip_player.js */
	let Zip = new ZipImagePlayer({
		canvas : document.createElement(`canvas`),
		source : Meta.src,
		metadata : Meta,
		chunkSize : 300000,
		autoStart : false,
		autosize : false
	});

	let Pngs = Array(Meta.frames.length);
	let DoneCount = 0;

	let on_png = (Idx, P) => {
		Pngs[Idx] = P;
		++DoneCount;
		if (DoneCount === Pngs.length) {
			resolve(Pngs);
		};
	};

	let on_blob = (Idx, B) => {
		let R = new FileReader();
		R.addEventListener(`loadend`, () => on_png(Idx, R.result));
		R.readAsArrayBuffer(B);
	};

	jQuery(Zip).on(`loadingStateChanged`, () => {
		if (Zip.getLoadedFrames() !== Pngs.length) {return;};

		for (let Idx = 0; Idx < Pngs.length; ++Idx) {
			let Img = Zip._frameImages[Idx];
			let C = document.createElement(`canvas`);
			[C.width, C.height] = [Img.naturalWidth, Img.naturalHeight];
			C.getContext(`2d`).drawImage(Img, 0, 0);
			C.toBlob(B => on_blob(Idx, B), `image/png`);
			/* can't reuse a canvas for multiple frames because toBlob is
			asynchronous */
		};
	});
});

let convert = () => new Promise((resolve, reject) => {
	/* resolves to a Uint8Array of the APNG file */

	let Meta = pixiv.context.ugokuIllustFullscreenData ||
		pixiv.context.ugokuIllustData;
	delete Meta.size; /* size might be incorrect anyway */

	console.log(`retrieving frame images ...`);
	get_frame_pngs(Meta).then(Pngs => {
		console.log(`... done`);

		console.log(`assembling APNG file ...`);

		console.log(`... unpacking chunks ...`);
		let UnpackedPngs = Pngs.map(unpack_png);

		console.log(`... animating chunks ...`);
		let ApngChunks = create_apng(
			UnpackedPngs,
			Meta.frames.map(X => X.delay)
		);

		console.log(`... repacking chunks ...`);
		let ApngBytes = pack_png(ApngChunks);

		console.log(`... done`);
		resolve(ApngBytes);
	});
});

let create_convert_button = () => {
	/* ? */
	let ApngBlob; /* cached result */
	let IsProcessing = false;

	let open_blob = () => {
		let Id = (new URLSearchParams(location.search)).get(`illust_id`);
		let X = document.createElement(`a`);
		X.href = URL.createObjectURL(ApngBlob);
		X.download = `illust-${Id}-${pixiv.title.original || ""}.apng`;
		X.dispatchEvent(new MouseEvent("click"));

		// alternate method:
		// location.href = URL.createObjectURL(ApngBlob);
	};

	let Btn = document.createElement(`div`);
	Btn.textContent = `Convert to APNG`;
	Btn.classList.add(`_button`);
	Btn.style.margin = `3px`;

	let Spinner = document.createElement(`img`);
	Spinner.setAttribute(`src`, SpinnerUri);
	Spinner.style.marginLeft = `1em`;
	Btn.appendChild(Spinner);

	Btn.update = () => {
		Spinner.style.display = IsProcessing ? `` : `none`;
	};

	Btn.addEventListener(`click`, Ev => {
		Ev.stopPropagation();
		if (ApngBlob) {open_blob(); return;};
		if (IsProcessing) {return;};

		IsProcessing = true;
		Btn.update();
		convert().then((ApngBytes) => {
			ApngBlob = new Blob([ApngBytes], {type : `image/png`});
			IsProcessing = false;
			Btn.update();
			open_blob();
		});
	}, true);

	Btn.update();
	return Btn;
};

(function() {/* entrypoint */
	if (!pixiv.context || pixiv.context.type !== `illust` ||
		!pixiv.context.ugokuIllustData) {return;};

	enforce(ZipImagePlayer);
	enforce(pixiv);
	enforce(jQuery);

	let PlayerBox = document.querySelector(
		`._ugoku-illust-player-container .player`);
	if (!PlayerBox) {return;};
	PlayerBox.parentNode.insertBefore(
		create_convert_button(), PlayerBox.nextSibiling);
})();

/* -------------------------------------------------------------------------- */

/*







































*/

/* -------------------------------------------------------------------------- */
