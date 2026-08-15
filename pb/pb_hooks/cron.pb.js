// Sweep of requests past their window:
//   confirmed -> completed
//   pending   -> expired (+ "no host found" email to the requester)
//
// The cron runs every 30 minutes; the admin route exists so smoke tests (and
// humans) can trigger the exact same logic deterministically. Handlers run in
// isolated executor contexts, so they must require() the shared sweep from
// helpers.js (see runSweep there).

cronAdd("guestspot-sweep", "*/30 * * * *", () => {
  const h = require(__hooks + "/helpers.js")
  h.runSweep($app)
})

routerAdd("POST", "/api/guestspot/admin/sweep", (e) => {
  const h = require(__hooks + "/helpers.js")
  if (!e.hasSuperuserAuth()) throw new ForbiddenError("Admins only.")
  h.runSweep(e.app)
  return e.json(200, { success: true })
}, $apis.requireAuth("_superusers"))
