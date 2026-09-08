declare const Handlebars: {
	registerHelper(name: string, helper: (...args: never[]) => unknown): void;
	compile(source: string): (context: unknown) => string;
};
