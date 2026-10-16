// Lets code outside of React components (like the axios interceptor) trigger
// a client-side route change instead of a hard window.location navigation.
// A hard navigation to a path like /login only works if the static host's
// catch-all SPA rewrite is correctly configured - if it isn't, the browser
// gets a literal 404 from the host instead of ever loading the React app.
// Routing through React Router's own navigate() has no such dependency,
// since it never leaves the already-loaded page.
let navigateRef = null;

export function setNavigate(fn) {
  navigateRef = fn;
}

export function goTo(path, options) {
  if (navigateRef) {
    navigateRef(path, options);
  } else {
    // Extremely unlikely fallback - the app hasn't mounted its router yet.
    window.location.assign(path);
  }
}
