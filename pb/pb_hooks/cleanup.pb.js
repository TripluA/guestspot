// Cleanup dangling references and cancel commitments when users/spots are
// removed. NOTE: every handler is an isolated program and must require() its
// own helpers (no file-level variables shared across .pb.js files, but helpers
// defined locally in this file are fine).

// Cancel a confirmed request (spot lost / host gone) and notify the requester.
function cancelConfirmed(req, h, e) {
  const requester = h.loadUser(e.app, req.getString("requester"))
  req.set("status", "cancelled")
  req.set("confirmer", "")
  req.set("spot", "")
  e.app.save(req)
  if (requester) {
    const lang = requester.getString("language") || "en"
    h.sendMail(
      requester.getString("email"),
      h.t(lang, "mail.host_removed.subject"),
      "<p>" + h.t(lang, "mail.host_removed.body") + "</p>" +
      "<p><b>" + h.fmtRange(req.getString("from"), req.getString("to")) + "</b></p>"
    )
  }
}

// When a user is deleted:
//  - detach their spots (owner -> "", availability rows cascade away);
//  - cancel + clear the requests they confirmed (their own spot, now unassigned).
onRecordAfterDeleteSuccess((e) => {
  const h = require(__hooks + "/helpers.js")
  const userId = e.record.id

  const spots = e.app.findRecordsByFilter("spots", "owner = {:owner}", "", 500, 0, { owner: userId })
  for (let i = 0; i < spots.length; i++) {
    spots[i].set("owner", "")
    e.app.save(spots[i])
  }

  const requests = e.app.findRecordsByFilter(
    "requests",
    "confirmer = {:confirmer}",
    "", 500, 0,
    { confirmer: userId }
  )
  for (let i = 0; i < requests.length; i++) {
    const req = requests[i]
    if (req.getString("status") === "confirmed") {
      cancelConfirmed(req, h, e)
    } else {
      req.set("confirmer", "")
      e.app.save(req)
    }
  }
  e.next()
}, "users")

// When a spot is deleted, clear the reference on inactive requests. HTTP
// deletion of a spot is blocked while active requests reference it (see the
// onRecordDeleteRequest guard below), but belt-and-suspenders: cancel any
// confirmed request that slipped through.
onRecordAfterDeleteSuccess((e) => {
  const h = require(__hooks + "/helpers.js")
  const spotId = e.record.id

  const requests = e.app.findRecordsByFilter("requests", "spot = {:spot}", "", 500, 0, { spot: spotId })
  for (let i = 0; i < requests.length; i++) {
    const req = requests[i]
    if (req.getString("status") === "confirmed") {
      cancelConfirmed(req, h, e)
    } else {
      req.set("spot", "")
      e.app.save(req)
    }
  }
  e.next()
}, "spots")

// Guard: don't let a spot be deleted while pending/confirmed requests depend on it.
onRecordDeleteRequest((e) => {
  const h = require(__hooks + "/helpers.js")
  const active = e.app.findRecordsByFilter(
    "requests",
    "spot = {:spot} && (status = 'pending' || status = 'confirmed')",
    "", 1, 0,
    { spot: e.record.id }
  )
  if (active.length > 0) {
    throw new BadRequestError("This spot cannot be deleted while pending or confirmed requests reference it.")
  }
  e.next()
}, "spots")
