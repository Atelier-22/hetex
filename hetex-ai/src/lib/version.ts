import pkg from "../../package.json";

/**
 * Read from package.json at build time so the version shown in Settings is the
 * version that was actually deployed, rather than a string someone has to
 * remember to bump in two places.
 */
export const APP_VERSION: string = pkg.version;
