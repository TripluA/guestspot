// Backfills the datetime fields on reg_attempts for databases that already ran
// the initial 1765500005 migration (which created the collection without them).
// Base collections do not auto-add createdAt/updatedAt in this PB version, so
// the throttle window check needs them explicitly.
migrate((app) => {
  const attempts = app.findCollectionByNameOrId("reg_attempts")
  let changed = false
  if (!attempts.fields.getByName("createdAt")) {
    attempts.fields.add(new AutodateField({ name: "createdAt", onCreate: true }))
    changed = true
  }
  if (!attempts.fields.getByName("updatedAt")) {
    attempts.fields.add(new AutodateField({ name: "updatedAt", onCreate: true, onUpdate: true }))
    changed = true
  }
  if (changed) app.save(attempts)
}, (app) => {})
