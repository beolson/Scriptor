// VERSION is injected at build time via --define 'VERSION="x.y.z"'
// This declaration tells TypeScript about the global constant.
declare const VERSION: string;

export { VERSION };
