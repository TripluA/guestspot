// Availability windows: owners only for their own spots + overlap checks.

onRecordCreateRequest((e) => {
  const h = require(__hooks + "/helpers.js")
  if (!e.hasSuperuserAuth()) {
    if (!e.auth) throw new ForbiddenError("Not authenticated")
    h.assertApproved(e.auth)
    const spotId = e.record.getString("spot")
    const spot = e.app.findRecordById("spots", spotId)
    if (spot.getString("owner") !== e.auth.id) {
      throw new ForbiddenError("You can only manage availability for spots you own.")
    }
    e.record.set("owner", e.auth.id)
    e.record.set("status", "available")
  }
  const err = h.rangeError(e.record.getString("from"), e.record.getString("to"))
  if (err) throw new BadRequestError(err)
  h.checkOverlap(e.app, e.record.getString("spot"), e.record.getString("from"), e.record.getString("to"), null)
  e.next()
}, "availability")

onRecordUpdateRequest((e) => {
  const h = require(__hooks + "/helpers.js")
  if (!e.hasSuperuserAuth() && e.auth) {
    h.assertApproved(e.auth)
    const spotId = e.record.getString("spot")
    const spot = e.app.findRecordById("spots", spotId)
    if (spot.getString("owner") !== e.auth.id) {
      throw new ForbiddenError("You can only manage availability for spots you own.")
    }
  }
  const err = h.rangeError(e.record.getString("from"), e.record.getString("to"))
  if (err) throw new BadRequestError(err)
  h.checkOverlap(e.app, e.record.getString("spot"), e.record.getString("from"), e.record.getString("to"), e.record.id)
  e.next()
}, "availability")
