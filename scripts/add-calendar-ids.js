// Gives every calendar item a short random `id` so the calendar can remember
// which items a student has checked off. Existing ids are never changed.
// An item that appears in several of the given files (same week, section and
// title) gets the same id in each, so copying weeks from the draft keeps them.
//
// Usage: bun scripts/add-calendar-ids.js f26/calendar.json f26/calendar-draft.json
// Run automatically by .githooks/pre-commit.

import { $ } from "bun";

const SECTIONS = ["async", "sync", "assessments"];

/** @typedef {{ id?: string, title: string }} Item */
/** @typedef {Record<string, Item[] | unknown>} Week */

/**
 * @param {Week[]} weeks
 * @param {(item: Item, key: string) => void} visit
 */
function eachItem(weeks, visit) {
	weeks.forEach((week, index) => {
		for (const section of SECTIONS) {
			const items = week[section];
			if (Array.isArray(items)) {
				for (const item of items) {
					visit(item, `${index}|${section}|${item.title}`);
				}
			}
		}
	});
}

function randomId() {
	const bytes = crypto.getRandomValues(new Uint8Array(4));
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const paths = process.argv.slice(2);
const files = await Promise.all(
	paths.map(async (path) => ({
		path,
		/** @type {Week[]} */
		weeks: await Bun.file(path).json(),
	})),
);

/** @type {Map<string, string>} */
const idByKey = new Map();
/** @type {Set<string>} */
const usedIds = new Set();
const duplicates = [];

for (const { path, weeks } of files) {
	/** @type {Set<string>} */
	const seen = new Set();
	eachItem(weeks, (item, key) => {
		if (!item.id) {
			return;
		}
		if (seen.has(item.id)) {
			duplicates.push(`${path}: "${item.title}" reuses id ${item.id}`);
		}
		seen.add(item.id);
		usedIds.add(item.id);
		if (!idByKey.has(key)) {
			idByKey.set(key, item.id);
		}
	});
}

if (duplicates.length > 0) {
	console.error(
		"Duplicate calendar ids (probably a copied item). Delete the id line from the copy and commit again:",
	);
	for (const line of duplicates) {
		console.error(`  ${line}`);
	}
	process.exit(1);
}

for (const { path, weeks } of files) {
	let added = 0;
	/** @type {Set<string>} */
	const idsInFile = new Set();
	eachItem(weeks, (item) => {
		if (item.id) {
			idsInFile.add(item.id);
		}
	});
	eachItem(weeks, (item, key) => {
		if (item.id) {
			return;
		}
		let id = idByKey.get(key);
		if (!id || idsInFile.has(id)) {
			do {
				id = randomId();
			} while (usedIds.has(id));
			usedIds.add(id);
			idByKey.set(key, id);
		}
		idsInFile.add(id);
		// Put the id first so it reads as the item's label in the JSON.
		const withId = { id, ...item };
		for (const k of Object.keys(item)) {
			delete item[/** @type {keyof Item} */ (k)];
		}
		Object.assign(item, withId);
		added++;
	});

	if (added > 0) {
		await Bun.write(path, `${JSON.stringify(weeks, null, "\t")}\n`);
		await $`biome format --write ${path}`.quiet();
		console.log(`${path}: added ${added} id(s)`);
	}
}
