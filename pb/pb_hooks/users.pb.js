// Registration approval flow + login gating + profile field protection.
// NOTE: every handler is an isolated program and must require() its own helpers.

// Force sane values on self-registration (guests cannot approve themselves).
onRecordCreateRequest((e) => {
  const h = require(__hooks + "/helpers.js")
  if (!e.hasSuperuserAuth()) {
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

// Approval can only be changed by a superuser.
onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const prev = e.record.original()
    if (prev.getBool("approved") !== e.record.getBool("approved")) {
      throw new ForbiddenError("Approval can only be changed by an admin.")
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
