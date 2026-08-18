// Admin self-service profile update (name / email / password).
//
// Uses a custom route instead of PATCH /api/collections/_superusers/records
// because PB's built-in auth update form requires a new password whenever
// oldPassword is present, making "change email, verified by the current
// password, without resetting the password" impossible — and it would silently
// ignore oldPassword for superusers anyway. See updateAdminSettings in
// helpers.js for the verification + save logic.
//
// Handlers run in isolated executor contexts, so this handler can only call
// helpers via require(); the logic lives in helpers.js.

routerAdd("POST", "/api/guestspot/admin/settings", (e) => {
  const h = require(__hooks + "/helpers.js")
  const record = h.updateAdminSettings(e.app, e.auth, e.requestInfo().body)
  return e.json(200, { record: record })
}, $apis.requireAuth("_superusers"))

// Public settings endpoint — returns app-level flags the frontend needs
// (e.g. whether email verification is required on registration).
routerAdd("GET", "/api/guestspot/settings", (e) => {
  const requireEmailVerification = ($os.getenv("REQUIRE_EMAIL_VERIFICATION") || "").toLowerCase() === "true"
  return e.json(200, { requireEmailVerification })
})
