// Availability windows: ownership enforcement + no overlapping windows per spot.
// NOTE: every handler is an isolated program and must require() its own helpers.

onRecordCreateRequest((e) => {
  const h = require(__hooks + "/helpers.js")
  const isSuper = e.hasSuperuserAuth()
  if (!isSuper) {
    h.assertSpotOwner(e.app, e.record.getString("spot"), e.auth, false)
    e.record.set("owner", e.auth ? e.auth.id : "")
  }
  h.checkOverlap(
    e.app,
    e.record.getString("spot"),
    e.record.getString("from"),
    e.record.getString("to"),
    ""
  )
  e.next()
}, "availability")

onRecordUpdateRequest((e) => {
  const h = require(__hooks + "/helpers.js")
  if (!e.hasSuperuserAuth()) {
    h.assertSpotOwner(e.app, e.record.getString("spot"), e.auth, false)
    // The owner cannot reassign their availability row to another user.
    e.record.set("owner", e.auth.id)
  }
  const status = e.record.getString("status")
  const prevStatus = e.record.original().getString("status")
  // A cancelled OR expired row is terminal for a user: reactivating it would
  // let expired windows be re-offered (and resurrect cancelled ones).
  if (prevStatus !== "available" && status === "available") {
    throw new BadRequestError("Availability that is cancelled or expired cannot be reactivated.")
  }
  h.checkOverlap(
    e.app,
    e.record.getString("spot"),
    e.record.getString("from"),
    e.record.getString("to"),
    e.record.id
  )
  e.next()
}, "availability")
