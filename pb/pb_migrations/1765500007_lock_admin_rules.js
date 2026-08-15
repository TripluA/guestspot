// SECURITY FIX: lock the admin-only CRUD rules.
//
// In PocketBase, an EMPTY STRING rule allows access to EVERYONE (public),
// while a `null` (locked) rule restricts access to superusers only. Several
// collections were created with "" intending "superuser-only":
//
//   - spots   create/update/delete  -> anyone could create/edit/delete spots
//   - users   delete                -> anyone could delete any user
//   - requests delete               -> anyone could delete any request
//   - reg_attempts (all)            -> internal throttle bookkeeping
//
// Superusers bypass rules entirely, so locking these does not affect the admin
// UI. Only the admin-only rules above are touched (value-sniffing for "" is
// unreliable in the JSVM — empty-string rules are exposed as null there).
migrate((app) => {
  const spots = app.findCollectionByNameOrId("spots")
  spots.createRule = null
  spots.updateRule = null
  spots.deleteRule = null
  app.save(spots)

  const users = app.findCollectionByNameOrId("users")
  users.deleteRule = null
  app.save(users)

  const requests = app.findCollectionByNameOrId("requests")
  requests.deleteRule = null
  app.save(requests)

  const attempts = app.findCollectionByNameOrId("reg_attempts")
  attempts.listRule = null
  attempts.viewRule = null
  attempts.createRule = null
  attempts.updateRule = null
  attempts.deleteRule = null
  app.save(attempts)
}, (app) => {})
