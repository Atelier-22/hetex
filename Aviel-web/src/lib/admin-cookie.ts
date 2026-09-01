/**
 * Name of the admin session cookie.
 *
 * Its own module because a Next.js route handler may only export HTTP methods
 * and a fixed set of config keys — exporting a constant from one is a build
 * error.
 */
export const ADMIN_COOKIE = "Aviel_admin";
