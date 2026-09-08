/** @typedef {{ time?: string, timing?: string }} TimedItem */

/** @type {Record<string, string>} */
const objectiveLookup = {};

Handlebars.registerHelper("lookupObjective", (/** @type {string} */ code) => {
	return objectiveLookup[code] || "";
});

Handlebars.registerHelper(
	"currentWeekId",
	(/** @type {string} */ syncLabel) => {
		if (!syncLabel) {
			return "";
		}

		const current = document.getElementById("current-week");
		if (current) {
			return "";
		}

		const today = new Date();
		const currentYear = today.getFullYear();

		// syncLabel is something like "May 29"
		const parsedDate = new Date(`${syncLabel}, ${currentYear}`);
		if (Number.isNaN(parsedDate.getTime())) {
			return "";
		}

		const todayOnly = new Date(
			today.getFullYear(),
			today.getMonth(),
			today.getDate(),
		);

		if (todayOnly <= parsedDate) {
			return "current-week";
		}
		return "";
	},
);

Handlebars.registerHelper(
	"eq",
	(/** @type {unknown} */ a, /** @type {unknown} */ b) => {
		return a === b;
	},
);

Handlebars.registerHelper(
	"formatDateRange",
	(
		/** @type {string} */ startDate,
		/** @type {string} */ endDate,
		/** @type {string} */ mode,
	) => {
		const start = parseLocalDate(startDate);
		const end = parseLocalDate(endDate);
		/** @type {Intl.DateTimeFormatOptions} */
		const options = { month: "short", day: "numeric" };

		if (mode === "async") {
			const adjusted = new Date(end);
			adjusted.setDate(end.getDate() - 1);

			return `${start.toLocaleDateString(
				"en-US",
				options,
			)}–${adjusted.toLocaleDateString("en-US", options)}`;
		}

		if (mode === "sync") {
			return `${end.toLocaleDateString("en-US", options)}`;
		}

		return "";
	},
);

/** @param {string} dateStr */
function parseLocalDate(dateStr) {
	const [year, month, day] = dateStr.split("-").map(Number);
	return new Date(year, month - 1, day); // month is 0-based
}

Handlebars.registerHelper(
	"formatDateRange",
	(
		/** @type {string} */ startDate,
		/** @type {string} */ endDate,
		/** @type {string} */ mode,
	) => {
		const start = parseLocalDate(startDate);
		const end = parseLocalDate(endDate);

		const sameMonth = start.getMonth() === end.getMonth();
		const shortMonth = (/** @type {Date} */ date) =>
			date.toLocaleDateString("en-US", { month: "short" });
		const day = (/** @type {Date} */ date) => date.getDate();

		if (mode === "async") {
			if (sameMonth) {
				return `${shortMonth(start)} ${day(start)}–${day(end)}`;
			} else {
				return `${shortMonth(start)} ${day(start)} – ${shortMonth(
					end,
				)} ${day(end)}`;
			}
		}

		if (mode === "sync") {
			return `Class – ${shortMonth(end)} ${day(end)}`;
		}

		return "";
	},
);

Handlebars.registerHelper(
	"sumTime",
	(
		/** @type {TimedItem[] | undefined} */ activities,
		/** @type {TimedItem[] | undefined} */ assessments,
		/** @type {string} */ timing,
	) => {
		let totalMinutes = 0;

		/** @param {TimedItem} item */
		function extractMinutes(item) {
			const timeStr = item.time || "";
			const regex = /(\d+(?:\.\d+)?)(h|m)/g;
			let totalMinutes = 0;
			let match = regex.exec(timeStr);

			while (match !== null) {
				const value = parseFloat(match[1]);
				const unit = match[2];
				totalMinutes += unit === "h" ? value * 60 : value;
				match = regex.exec(timeStr);
			}

			return totalMinutes;
		}

		if (Array.isArray(activities)) {
			activities.forEach((item) => {
				totalMinutes += extractMinutes(item);
			});
		}

		if (Array.isArray(assessments)) {
			assessments
				.filter((a) => a.timing === timing)
				.forEach((item) => {
					totalMinutes += extractMinutes(item);
				});
		}

		const hours = Math.round((totalMinutes / 60) * 10) / 10; // 1 decimal
		return `${hours}h`;
	},
);

async function loadCalendar() {
	const [calendarRes, objectivesRes] = await Promise.all([
		fetch("calendar.json"),
		fetch("objectives.json"),
	]);

	const calendarData = await calendarRes.json();
	/** @type {Record<string, { subobjectives: Record<string, string> }>} */
	const objectivesData = await objectivesRes.json();

	// Flatten all subobjectives into a flat key-value lookup
	for (const groupKey in objectivesData) {
		const sub = objectivesData[groupKey].subobjectives;
		for (const key in sub) {
			objectiveLookup[key] = sub[key];
		}
	}

	const templateElement = document.getElementById("calendar-template");
	const container = document.getElementById("calendar-container");
	if (!(templateElement && container)) {
		return;
	}

	const template = Handlebars.compile(templateElement.innerHTML);
	const calendarHTML = template(calendarData);

	container.innerHTML = calendarHTML;

	const current = document.getElementById("current-week");
	if (current) {
		current.scrollIntoView({ behavior: "auto", block: "center" });
	}
}

loadCalendar();
