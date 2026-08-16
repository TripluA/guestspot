// Request lifecycle: server-side status/ownership guards, owner matching
// by availability windows, custom confirm/cancel/complete routes + emails.
// NOTE: every handler is an isolated program and must require() its own helpers.

// --- create ---
onRecordCreateRequest((e) => {
  const h = require(__hooks + "/helpers.js")
  if (!e.hasSuperuserAuth()) {
    if (!e.auth) throw new ForbiddenError("Not authenticated")
    h.assertApproved(e.auth)
    e.record.set("requester", e.auth.id)
    e.record.set("status", "pending")
    e.record.set("spot", "")
    e.record.set("confirmer", "")
  }
  const from = e.record.getString("from")
  const to = e.record.getString("to")
  const err = h.rangeError(from, to)
  if (err) throw new BadRequestError(err)
  if (!h.isFutureEnough(from)) {
    throw new BadRequestError("The start time must be in the future.")
  }
  e.next()
}, "requests")

onRecordAfterCreateSuccess((e) => {
  const h = require(__hooks + "/helpers.js")
  const req = e.record
  const requester = h.loadUser(e.app, req.getString("requester"))
  const lang = requester ? requester.getString("language") || "en" : "en"
  const from = req.getString("from")
  const to = req.getString("to")

  if (requester) {
    h.sendMail(
      requester.getString("email"),
      h.t(lang, "mail.request_submitted.subject"),
      "<p>" + h.t(lang, "mail.request_submitted.body") + "</p>" +
      "<p><b>" + h.fmtRange(from, to) + "</b></p>" +
      "<p>" + h.t(lang, "mail.waiting_note") + "</p>"
    )
  }

  const owners = h.matchingOwners(e.app, from, to, requester ? requester.id : "")
  for (let i = 0; i < owners.length; i++) {
    const owner = h.loadUser(e.app, owners[i].id)
    if (!owner) continue
    const olang = owner.getString("language") || "en"
    h.notify(e.app, owner.id, "new_request", { request: req.id, from: from, to: to })
    h.sendMail(
      owner.getString("email"),
      h.t(olang, "mail.new_request.subject"),
      "<p>" + h.t(olang, "mail.new_request.body") + "</p>" +
      "<p><b>" + h.esc(requester ? requester.getString("name") : "") + "</b> — " +
      h.t(olang, "building") + " " + (requester ? requester.getString("building") : "") + "</p>" +
      "<p><b>" + h.fmtRange(from, to) + "</b></p>" +
      "<p>" + h.t(olang, "mail.your_spots") + ": <b>" + owners[i].spots.join(", ") + "</b></p>" +
      "<p><a href='" + h.appURL() + "/app/requests'>" + h.t(olang, "mail.open_app") + "</a></p>"
    )
  }
  e.next()
}, "requests")

// --- update: only the requester may cancel; everything else is guarded. ---
onRecordUpdateRequest((e) => {
  const h = require(__hooks + "/helpers.js")
  const prev = e.record.original()
  const status = e.record.getString("status")
  const prevStatus = prev.getString("status")

  if (!e.hasSuperuserAuth()) {
    h.assertApproved(e.auth)
    if (status !== prevStatus && status !== "cancelled") {
      throw new ForbiddenError("A request can only be changed to cancelled by its requester.")
    }
    if (prevStatus === "confirmed" || status === "confirmed") {
      if (
        e.record.getString("from") !== prev.getString("from") ||
        e.record.getString("to") !== prev.getString("to")
      ) {
        throw new BadRequestError("The time window of a confirmed request cannot be changed.")
      }
    }
    // Mirror the create hook: ownership/assignment fields can only be set by
    // the system (or a superuser). A requester must not be able to forge
    // requester/spot/confirmer on their pending request.
    e.record.set("requester", prev.getString("requester"))
    e.record.set("spot", prev.getString("spot"))
    e.record.set("confirmer", prev.getString("confirmer"))
    // A pending window cannot be pushed into the past (would let a request
    // expire without ever being offerable).
    if (prevStatus === "pending" && !h.isFutureEnough(e.record.getString("from"))) {
      throw new BadRequestError("The start time must be in the future.")
    }
  }

  const err = h.rangeError(e.record.getString("from"), e.record.getString("to"))
  if (err) throw new BadRequestError(err)
  e.next()
}, "requests")

// --- routes ---

// Owner offers their spot for a pending request.
routerAdd("POST", "/api/guestspot/requests/{id}/confirm", (e) => {
  return e.app.runInTransaction((tx) => {
    const h = require(__hooks + "/helpers.js")
    h.assertApproved(e.auth)
    const req = tx.findRecordById("requests", e.request.pathValue("id"))
    if (req.getString("status") !== "pending") throw new BadRequestError("This request is no longer pending.")

    const body = e.requestInfo().body
    const spotId = body && body["spot"]
    if (!spotId) throw new BadRequestError("Missing spot.")

    const spot = tx.findRecordById("spots", spotId)
    if (spot.getString("owner") !== e.auth.id) throw new ForbiddenError("You can only offer spots you own.")
    if (!spot.getBool("enabled")) throw new BadRequestError("This spot is disabled.")

    const from = req.getString("from")
    const to = req.getString("to")
    if (h.overlappingConfirmed(tx, spot.id, from, to).length > 0) {
      throw new BadRequestError("This spot is already assigned in the requested period.")
    }

    req.set("status", "confirmed")
    req.set("spot", spot.id)
    req.set("confirmer", e.auth.id)
    tx.save(req)

    const requester = h.loadUser(tx, req.getString("requester"))
    const owner = h.loadUser(tx, e.auth.id)
    if (requester) {
      const lang = requester.getString("language") || "en"
      h.notify(tx, requester.id, "confirmed", { request: req.id, spot: spot.getString("number"), from: from, to: to })
      h.sendMail(
        requester.getString("email"),
        h.t(lang, "mail.request_confirmed.subject"),
        "<p>" + h.t(lang, "mail.request_confirmed.body") + "</p>" +
        "<p><b>" + h.t(lang, "spot") + ":</b> " + h.esc(spot.getString("number")) +
        " (" + h.t(lang, "building") + " " + spot.getString("building") + ")</p>" +
        "<p><b>" + h.t(lang, "owner") + ":</b> " + h.esc(owner ? owner.getString("name") : "") + "</p>" +
        (owner && owner.getString("phone")
          ? "<p><b>" + h.t(lang, "mail.contact") + ":</b> " + h.esc(owner.getString("phone")) + "</p>"
          : "") +
        "<p><b>" + h.fmtRange(from, to) + "</b></p>" +
        "<p><a href='" + h.gcalURL(
          from, to,
          h.t(lang, "spot") + " " + spot.getString("number"),
          h.t(lang, "building") + " " + spot.getString("building")
        ) + "'>" + h.t(lang, "mail.add_to_calendar") + "</a></p>"
      )
    }
    if (owner) {
      const olang = owner.getString("language") || "en"
      h.sendMail(
        owner.getString("email"),
        h.t(olang, "mail.you_confirmed.subject"),
        "<p>" + h.t(olang, "mail.you_confirmed.body") + "</p>" +
        "<p><b>" + h.t(olang, "guest") + ":</b> " + h.esc(requester ? requester.getString("name") : "") + "</p>" +
        "<p><b>" + h.fmtRange(from, to) + "</b></p>"
      )
    }

    return e.json(200, { success: true, id: req.id, status: "confirmed" })
  })
}, $apis.requireAuth("users"))

// Requester cancels their pending/confirmed request.
routerAdd("POST", "/api/guestspot/requests/{id}/cancel", (e) => {
  const h = require(__hooks + "/helpers.js")
  h.assertApproved(e.auth)
  const req = e.app.findRecordById("requests", e.request.pathValue("id"))
  if (req.getString("requester") !== e.auth.id) throw new ForbiddenError("Only the requester can cancel this request.")

  const status = req.getString("status")
  if (status !== "pending" && status !== "confirmed") {
    throw new BadRequestError("This request cannot be cancelled anymore.")
  }
  req.set("status", "cancelled")
  e.app.save(req)

  if (req.getString("confirmer")) {
    const confirmer = h.loadUser(e.app, req.getString("confirmer"))
    if (confirmer) {
      const clang = confirmer.getString("language") || "en"
      h.notify(e.app, confirmer.id, "cancelled", {
        request: req.id,
        from: req.getString("from"),
        to: req.getString("to"),
      })
      h.sendMail(
        confirmer.getString("email"),
        h.t(clang, "mail.request_cancelled.subject"),
        "<p>" + h.t(clang, "mail.request_cancelled.body") + "</p>" +
        "<p><b>" + h.fmtRange(req.getString("from"), req.getString("to")) + "</b></p>"
      )
    }
  }

  return e.json(200, { success: true, id: req.id, status: "cancelled" })
}, $apis.requireAuth("users"))

// Requester or host marks a confirmed request as completed.
routerAdd("POST", "/api/guestspot/requests/{id}/complete", (e) => {
  const h = require(__hooks + "/helpers.js")
  h.assertApproved(e.auth)
  const req = e.app.findRecordById("requests", e.request.pathValue("id"))
  const isRequester = req.getString("requester") === e.auth.id
  const isConfirmer = req.getString("confirmer") === e.auth.id
  if (!isRequester && !isConfirmer) throw new ForbiddenError("Not allowed.")
  if (req.getString("status") !== "confirmed") {
    throw new BadRequestError("Only confirmed requests can be completed.")
  }
  req.set("status", "completed")
  e.app.save(req)
  return e.json(200, { success: true, id: req.id, status: "completed" })
}, $apis.requireAuth("users"))

// Host contact details for a confirmed request. Only the requester or the
// host (confirmer) may fetch them — the phone number is hidden from everyone
// else by the users enrich hook, so this is the controlled disclosure point.
routerAdd("GET", "/api/guestspot/requests/{id}/contact", (e) => {
  const h = require(__hooks + "/helpers.js")
  h.assertApproved(e.auth)
  const req = e.app.findRecordById("requests", e.request.pathValue("id"))
  const isRequester = req.getString("requester") === e.auth.id
  const isConfirmer = req.getString("confirmer") === e.auth.id
  if (!isRequester && !isConfirmer) throw new ForbiddenError("Not allowed.")
  if (req.getString("status") !== "confirmed") {
    throw new BadRequestError("Contact details are only available for confirmed requests.")
  }

  const owner = h.loadUser(e.app, req.getString("confirmer"))
  const spot = h.loadSpot(e.app, req.getString("spot"))
  return e.json(200, {
    host: owner ? owner.getString("name") : "",
    hostPhone: owner ? owner.getString("phone") : "",
    spot: spot ? spot.getString("number") : "",
    building: spot ? spot.getString("building") : "",
    from: req.getString("from"),
    to: req.getString("to"),
  })
}, $apis.requireAuth("users"))
