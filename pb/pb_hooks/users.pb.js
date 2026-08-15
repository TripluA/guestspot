// Registration approval flow + login gating + profile field protection.
// NOTE: every handler is an isolated program and must require() its own helpers.

// Force sane values on self-registration (guests cannot approve themselves)
// and throttle anonymous registration attempts per IP.
onRecordCreateRequest((e) => {
  const h = require(__hooks + "/helpers.js")
  if (!e.hasSuperuserAuth()) {
    // Rate limit: REG_MAX_PER_HOUR attempts per IP per rolling hour. The app
    // sits behind the web nginx proxy, so PB's remoteAddr is the proxy IP for
    // everyone; read the real client IP from X-Forwarded-For instead (the last
    // entry is appended by nginx and is the actual TCP peer).
    const info = e.requestInfo()
    const hdrs = info && info.headers ? info.headers : {}
    const xff = hdrs["x_forwarded_for"] || ""
    let ip = ""
    if (Array.isArray(xff)) {
      const parts = String(xff[xff.length - 1] || "").split(",").map((s) => s.trim()).filter(Boolean)
      ip = parts.length ? parts[parts.length - 1] : ""
    } else if (typeof xff === "string") {
      const parts = xff.split(",").map((s) => s.trim()).filter(Boolean)
      ip = parts.length ? parts[parts.length - 1] : ""
    }
    if (ip) {
      const maxPerHour = parseInt($os.getenv("REG_MAX_PER_HOUR") || "10", 10) || 10
      const cutoff = h.pbDateTime(new Date(Date.now() - 60 * 60 * 1000))
      const attempts = e.app.findRecordsByFilter(
        "reg_attempts",
        "ip = {:ip} && createdAt >= {:cutoff}",
        "", maxPerHour, 0,
        { ip: ip, cutoff: cutoff }
      )
      if (attempts.length >= maxPerHour) {
        throw new ForbiddenError("Too many registration attempts. Please try again later.")
      }
      const attempt = new Record(e.app.findCollectionByNameOrId("reg_attempts"))
      attempt.set("ip", ip)
      e.app.save(attempt)
    }
    e.record.set("approved", false)
    if (!e.record.getString("language")) e.record.set("language", "en")
  }
  e.next()
}, "users")

// Notify admins that a new registration awaits approval.
onRecordAfterCreateSuccess((e) => {
  const h = require(__hooks + "/helpers.js")
  const u = e.record
  const recipients = h.adminNotifyEmails()
  if (recipients.length === 0) return e.next()
  const html =
    "<p>A new user registered and is waiting for approval:</p>" +
    "<p><b>Name:</b> " + h.esc(u.getString("name")) + "<br/>" +
    "<b>Email:</b> " + h.esc(u.getString("email")) + "<br/>" +
    "<b>Building:</b> " + u.getString("building") + "<br/>" +
    "<b>Apartment:</b> " + h.esc(u.getString("apartment") || "—") + "<br/>" +
    "<b>Phone:</b> " + h.esc(u.getString("phone") || "—") + "</p>" +
    "<p>Approve them from the admin panel.</p>"
  for (let i = 0; i < recipients.length; i++) {
    h.sendMail(recipients[i], "[GuestSpot] New registration pending approval", html)
  }
  e.next()
}, "users")

// When an admin flips a user to approved, welcome them.
onRecordAfterUpdateSuccess((e) => {
  const h = require(__hooks + "/helpers.js")
  const u = e.record
  const prev = u.original()
  if (u.getBool("approved") && !prev.getBool("approved")) {
    const lang = u.getString("language") || "en"
    h.sendMail(
      u.getString("email"),
      h.t(lang, "mail.approved.subject"),
      "<p>" + h.t(lang, "mail.approved.body") + "</p>"
    )
  }
}, "users")

// Block login / token refresh while a user is not approved.
onRecordAuthWithPasswordRequest((e) => {
  if (e.record && !e.record.getBool("approved")) {
    throw new ForbiddenError("Your account is pending admin approval.")
  }
  e.next()
}, "users")

onRecordAuthRefreshRequest((e) => {
  if (e.record && !e.record.getBool("approved")) {
    throw new ForbiddenError("Your account is pending admin approval.")
  }
  e.next()
}, "users")

// Approval can only be changed by a superuser; an approved user can never be
// flipped back to pending. Approving a user who claimed a spot at registration
// creates that spots record atomically (fails with a clear error on conflict).
onRecordUpdateRequest((e) => {
  const h = require(__hooks + "/helpers.js")
  const prev = e.record.original()
  const wasApproved = prev.getBool("approved")
  const isApproved = e.record.getBool("approved")

  if (!e.hasSuperuserAuth()) {
    if (wasApproved !== isApproved) {
      throw new ForbiddenError("Approval can only be changed by an admin.")
    }
  }

  if (wasApproved && !isApproved) {
    throw new ForbiddenError("Approved users cannot be set back to pending.")
  }

  // Only on the pending -> approved transition: materialize the claimed spot.
  if (!wasApproved && isApproved) {
    const number = e.record.getString("spotNumber")
    if (number) {
      const existing = e.app.findRecordsByFilter(
        "spots",
        "number = {:number}",
        "", 1, 0,
        { number: number.trim() }
      )
      if (existing.length) {
        throw new BadRequestError(
          "A spot with this number already exists. Resolve the conflict before approving.",
          { spotNumber: { code: "validation_not_unique", message: "A spot with this number already exists." } }
        )
      }
      const spot = new Record(e.app.findCollectionByNameOrId("spots"))
      spot.set("number", number.trim())
      spot.set("building", e.record.getString("building"))
      spot.set("zone", e.record.getString("spotZone") || null)
      spot.set("owner", e.record.id)
      spot.set("enabled", true)
      e.app.save(spot)
    }
  }

  e.next()
}, "users")

// Hide phone numbers from other users (PB already redacts emails).
onRecordEnrich((e) => {
  const info = e.requestInfo
  const auth = info.auth
  const coll = e.record.collection().name
  if (coll === "users") {
    const isSuper = auth && auth.isSuperuser()
    const isSelf = auth && e.record.id === auth.id
    if (!isSuper && !isSelf) {
      e.record.hide("phone")
    }
  }
  e.next()
})
