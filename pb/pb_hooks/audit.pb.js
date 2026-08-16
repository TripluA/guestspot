// Audit log: records superuser-driven CRUD so the admin can trace who changed
// what. User-facing lifecycle events (confirm/cancel/complete, availability,
// sweeps) are intentionally NOT logged here — they run through custom routes /
// e.app.save() which bypass request hooks anyway, and they'd add noise.
//
// Superusers are not rows in the users collection, so the `actor` relation is
// left unset and the superuser email is recorded inside `details`.
//
// NOTE: every handler is an isolated program in its own JSVM executor and must
// require() its own helpers; module-scope functions in this file are NOT
// visible from the handlers (ReferenceError), so all logic lives in helpers.js.
// Audit is best-effort: failures are logged and never block the request.

// --- spots (admin creates/edits/deletes spots in the admin UI) ---
onRecordCreateRequest((e) => {
  const h = require(__hooks + "/helpers.js")
  try {
    if (e.hasSuperuserAuth()) {
      const info = h.auditActorInfo(e)
      h.audit(e.app, "", "spot.create", "spots", e.record.id, {
        actorEmail: info.actorEmail || null,
        actorId: info.actorId || null,
        number: e.record.getString("number"),
      })
    }
  } catch (err) {
    console.error("[audit] " + String(err && err.message ? err.message : err))
  }
  e.next()
}, "spots")

onRecordUpdateRequest((e) => {
  const h = require(__hooks + "/helpers.js")
  try {
    if (e.hasSuperuserAuth()) {
      const info = h.auditActorInfo(e)
      h.audit(e.app, "", "spot.update", "spots", e.record.id, {
        actorEmail: info.actorEmail || null,
        actorId: info.actorId || null,
        ...h.changedFields(e.record, e.record.original()),
      })
    }
  } catch (err) {
    console.error("[audit] " + String(err && err.message ? err.message : err))
  }
  e.next()
}, "spots")

onRecordDeleteRequest((e) => {
  const h = require(__hooks + "/helpers.js")
  try {
    if (e.hasSuperuserAuth()) {
      const info = h.auditActorInfo(e)
      h.audit(e.app, "", "spot.delete", "spots", e.record.id, {
        actorEmail: info.actorEmail || null,
        actorId: info.actorId || null,
        number: e.record.getString("number"),
      })
    }
  } catch (err) {
    console.error("[audit] " + String(err && err.message ? err.message : err))
  }
  e.next()
}, "spots")

// --- users (admin approve / edit / delete) ---
onRecordUpdateRequest((e) => {
  const h = require(__hooks + "/helpers.js")
  try {
    if (e.hasSuperuserAuth()) {
      const info = h.auditActorInfo(e)
      const prev = e.record.original()
      const wasApproved = prev.getBool("approved")
      const isApproved = e.record.getBool("approved")
      const action = !wasApproved && isApproved ? "user.approve" : "user.update"
      h.audit(e.app, "", action, "users", e.record.id, {
        actorEmail: info.actorEmail || null,
        actorId: info.actorId || null,
        ...h.changedFields(e.record, prev),
      })
    }
  } catch (err) {
    console.error("[audit] " + String(err && err.message ? err.message : err))
  }
  e.next()
}, "users")

onRecordDeleteRequest((e) => {
  const h = require(__hooks + "/helpers.js")
  try {
    if (e.hasSuperuserAuth()) {
      const info = h.auditActorInfo(e)
      h.audit(e.app, "", "user.delete", "users", e.record.id, {
        actorEmail: info.actorEmail || null,
        actorId: info.actorId || null,
        email: e.record.getString("email"),
        name: e.record.getString("name"),
      })
    }
  } catch (err) {
    console.error("[audit] " + String(err && err.message ? err.message : err))
  }
  e.next()
}, "users")

// --- requests (admin cancel/complete/delete on the admin Requests page) ---
onRecordUpdateRequest((e) => {
  const h = require(__hooks + "/helpers.js")
  try {
    if (e.hasSuperuserAuth()) {
      const info = h.auditActorInfo(e)
      const prev = e.record.original()
      h.audit(e.app, "", "request.update", "requests", e.record.id, {
        actorEmail: info.actorEmail || null,
        actorId: info.actorId || null,
        ...h.changedFields(e.record, prev),
      })
    }
  } catch (err) {
    console.error("[audit] " + String(err && err.message ? err.message : err))
  }
  e.next()
}, "requests")

onRecordDeleteRequest((e) => {
  const h = require(__hooks + "/helpers.js")
  try {
    if (e.hasSuperuserAuth()) {
      const info = h.auditActorInfo(e)
      h.audit(e.app, "", "request.delete", "requests", e.record.id, {
        actorEmail: info.actorEmail || null,
        actorId: info.actorId || null,
        status: e.record.getString("status"),
      })
    }
  } catch (err) {
    console.error("[audit] " + String(err && err.message ? err.message : err))
  }
  e.next()
}, "requests")
