// Availability windows: ownership enforcement + no overlapping windows per spot.
// NOTE: every handler is an isolated program and must require() its own helpers.

onRecordCreateRequest((e) => {
  const h = require(__hooks + "/helpers.js")
  if (!e.hasSuperuserAuth()) {
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
  const status = e.record.getString("status")
  const prevStatus = e.record.original().getString("status")
  if (prevStatus === "cancelled" && status !== prevStatus) {
    throw new BadRequestError("Cancelled availability cannot be reactivated.")
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
