// Shared helpers: localized transactional emails, datetime formatting and
// domain validation. Loaded with require(__hooks + "/helpers.js") INSIDE each
// handler (handlers are isolated programs and cannot see file-level variables).
module.exports = (function () {
  const translations = {
    en: {
      "building": "Building",
      "spot": "Spot",
      "owner": "Host",
      "guest": "Guest",
      "mail.approved.subject": "Welcome to GuestSpot — your account is approved",
      "mail.approved.body": "Your GuestSpot account has been approved by the administrator. You can now log in and request guest parking spots.",
      "mail.request_submitted.subject": "GuestSpot: your request was submitted",
      "mail.request_submitted.body": "Your guest parking request has been submitted and is waiting for a host.",
      "mail.new_request.subject": "GuestSpot: a parking request needs a host",
      "mail.new_request.body": "A neighbour is looking for a parking spot. If one of your spots is free in that period, you can offer it.",
      "mail.your_spots": "Your spots that are free in this window",
      "mail.open_app": "Open GuestSpot",
      "mail.request_confirmed.subject": "GuestSpot: your request is confirmed",
      "mail.request_confirmed.body": "Good news — a host confirmed your guest parking request.",
      "mail.you_confirmed.subject": "GuestSpot: you confirmed a parking request",
      "mail.you_confirmed.body": "You confirmed a guest parking request. Thank you for helping a neighbour.",
      "mail.request_cancelled.subject": "GuestSpot: a request was cancelled",
      "mail.request_cancelled.body": "A parking request involving your spot has been cancelled.",
      "mail.waiting_note": "You will receive an email as soon as a host confirms.",
      "mail.host_removed.subject": "GuestSpot: your request was cancelled",
      "mail.host_removed.body": "The host who confirmed your request is no longer in GuestSpot, so the request was cancelled.",
      "mail.expired.subject": "GuestSpot: no host found for your request",
      "mail.expired.body": "Nobody offered a parking spot for your request, so it expired. You can submit a new request with a different time window.",
      "mail.add_to_calendar": "Add to calendar",
    },
    ro: {
      "building": "Bloc",
      "spot": "Loc de parcare",
      "owner": "Gazdă",
      "guest": "Oaspete",
      "mail.approved.subject": "Bine ai venit pe GuestSpot — contul tău a fost aprobat",
      "mail.approved.body": "Contul tău GuestSpot a fost aprobat de administrator. Te poți conecta și solicita locuri de parcare pentru oaspeți.",
      "mail.request_submitted.subject": "GuestSpot: cererea ta a fost trimisă",
      "mail.request_submitted.body": "Cererea ta de parcare a fost trimisă și așteaptă o gazdă.",
      "mail.new_request.subject": "GuestSpot: o cerere de parcare are nevoie de o gazdă",
      "mail.new_request.body": "Un vecin caută un loc de parcare. Dacă unul dintre locurile tale este liber în perioada respectivă, îl poți oferi.",
      "mail.your_spots": "Locurile tale libere în această perioadă",
      "mail.open_app": "Deschide GuestSpot",
      "mail.request_confirmed.subject": "GuestSpot: cererea ta a fost confirmată",
      "mail.request_confirmed.body": "Vești bune — o gazdă ți-a confirmat cererea de parcare pentru oaspete.",
      "mail.you_confirmed.subject": "GuestSpot: ai confirmat o cerere de parcare",
      "mail.you_confirmed.body": "Ai confirmat o cerere de parcare. Mulțumim că ajuți vecinii.",
      "mail.request_cancelled.subject": "GuestSpot: o cerere a fost anulată",
      "mail.request_cancelled.body": "O cerere de parcare care implica locul tău a fost anulată.",
      "mail.waiting_note": "Veți primi un email imediat ce o gazdă confirmă.",
      "mail.host_removed.subject": "GuestSpot: cererea ta a fost anulată",
      "mail.host_removed.body": "Gazda care ți-a confirmat cererea nu mai este în GuestSpot, astfel încât cererea a fost anulată.",
      "mail.expired.subject": "GuestSpot: nu s-a găsit o gazdă pentru cererea ta",
      "mail.expired.body": "Nimeni nu a oferit un loc de parcare pentru cererea ta, astfel încât aceasta a expirat. Poți trimite o nouă cerere cu o altă perioadă de timp.",
      "mail.add_to_calendar": "Adaugă în calendar",
    },
  }

  function t(lang, key) {
    const dict = translations[lang === "ro" ? "ro" : "en"]
    return dict[key] || translations.en[key] || key
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  }

  function appURL() {
    return ($os.getenv("PUBLIC_URL") || "").replace(/\/+$/, "")
  }

  // PB stores datetimes as "2006-01-02 15:04:05.000Z"; make it JS-parsable.
  function parseDT(value) {
    const s = String(value).replace(" ", "T")
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d
  }
  // Serialize a JS Date back to PB's "2006-01-02 15:04:05.000Z" format. Filters
  // MUST compare PB datetimes with this format: passing a JS Date as a filter
  // param serializes to ISO "T" separators, which breaks string comparison
  // (e.g. "2026-08-15 11:30:05.000Z" >= "2026-08-15T10:30:56.000Z" is false
  // because " " < "T", even though 11:30 is later).
  function pbDateTime(date) {
    const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date()
    return (
      d.getUTCFullYear() + "-" +
      pad2(d.getUTCMonth() + 1) + "-" +
      pad2(d.getUTCDate()) + " " +
      pad2(d.getUTCHours()) + ":" +
      pad2(d.getUTCMinutes()) + ":" +
      pad2(d.getUTCSeconds()) + ".000Z"
    )
  }

  function pad2(n) {
    return ("0" + n).slice(-2)
  }

  // Format datetimes in the container's local timezone (the TZ env var,
  // e.g. Europe/Bucharest) instead of UTC — recipients see their local time.
  function fmtDT(value) {
    const d = parseDT(value)
    if (!d) return String(value)
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) +
      " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes())
  }

  function fmtRange(from, to) {
    return fmtDT(from) + " → " + fmtDT(to)
  }

  // Google Calendar "Add to calendar" link. Dates use UTC (Z suffix) so each
  // recipient sees the event at the correct absolute time in their own zone.
  function gcalURL(from, to, title, details) {
    const fmt = (value) => {
      const d = parseDT(value)
      if (!d) return ""
      return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
    }
    return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" +
      encodeURIComponent(title || "") + "&dates=" + fmt(from) + "/" + fmt(to) +
      "&details=" + encodeURIComponent(details || "")
  }

  function wrap(html) {
    return '<div style="font-family:Arial,Helvetica,sans-serif;color:#111827;max-width:560px;margin:0 auto">' +
      '<div style="background:#0d9488;color:#ffffff;padding:16px 24px;border-radius:8px 8px 0 0"><b style="font-size:18px">GuestSpot</b></div>' +
      '<div style="background:#ffffff;border:1px solid #e5e7eb;border-top:0;padding:24px;border-radius:0 0 8px 8px">' + html + "</div>" +
      '<p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:16px">GuestSpot</p></div>'
  }

  function sendMail(to, subject, html) {
    try {
      const settings = $app.settings()
      if (!settings.smtp.enabled) {
        console.log("[mail] SMTP not configured, skipping -> " + to + " | " + subject)
        return
      }
      const message = new MailerMessage({
        from: { address: settings.meta.senderAddress, name: settings.meta.senderName },
        to: [{ address: to }],
        subject: subject,
        html: wrap(html),
      })
      $app.newMailClient().send(message)
      console.log("[mail] sent -> " + to + " | " + subject)
    } catch (err) {
      console.error("[mail] send failed for " + to + ": " + String(err && err.message ? err.message : err))
    }
  }

  function adminNotifyEmails() {
    const result = []
    const main = $os.getenv("PB_ADMIN_EMAIL")
    if (main) result.push(main)
    const extra = ($os.getenv("ADMIN_NOTIFY_EMAILS") || "").split(",")
    for (let i = 0; i < extra.length; i++) {
      const v = extra[i].trim()
      if (v) result.push(v)
    }
    return result
  }

  function loadUser(app, id) {
    return id ? app.findRecordById("users", id) : null
  }

  function loadSpot(app, id) {
    return id ? app.findRecordById("spots", id) : null
  }

  // Throws if the authenticated user does not own the given spot (superusers
  // bypass). Used to keep availability rows tied to real spot owners.
  function assertSpotOwner(app, spotId, auth, isSuper) {
    const spot = loadSpot(app, spotId)
    if (!spot) throw new BadRequestError("This spot does not exist.")
    if (isSuper) return spot
    if (!auth || spot.getString("owner") !== auth.id) {
      throw new ForbiddenError("You can only declare availability for spots you own.")
    }
    return spot
  }

  function overlappingConfirmed(app, spotId, from, to) {
    return app.findRecordsByFilter(
      "requests",
      "spot = {:spot} && status = 'confirmed' && from < {:to} && to > {:from}",
      "", 1, 0,
      { spot: spotId, from: from, to: to }
    )
  }

  function isFutureEnough(iso) {
    const d = parseDT(iso)
    if (!d) return false
    return d.getTime() > Date.now() - 60 * 60 * 1000
  }

  // Owners whose declared availability overlaps the request window, plus the
  // specific spot numbers they could offer. Conflicted spots are excluded.
  function matchingOwners(app, from, to, excludeUserId) {
    const avail = app.findRecordsByFilter(
      "availability",
      "status = 'available' && from < {:to} && to > {:from}",
      "", 500, 0,
      { from: from, to: to }
    )
    const owners = {}
    for (let i = 0; i < avail.length; i++) {
      const a = avail[i]
      const spot = loadSpot(app, a.getString("spot"))
      if (!spot || !spot.getBool("enabled")) continue
      const ownerId = spot.getString("owner")
      if (!ownerId || ownerId === excludeUserId) continue
      if (overlappingConfirmed(app, spot.id, from, to).length > 0) continue
      const entry = owners[ownerId] || (owners[ownerId] = { spots: [] })
      entry.spots.push(spot.getString("number"))
    }
    return Object.keys(owners).map(function (id) { return { id: id, spots: owners[id].spots } })
  }

  // Throws BadRequestError if the range is invalid.
  function checkOverlap(app, spotId, from, to, excludeId) {
    const existing = app.findRecordsByFilter(
      "availability",
      "spot = {:spot} && status = 'available' && from < {:to} && to > {:from}",
      "", 100, 0,
      { spot: spotId, from: from, to: to }
    )
    for (let i = 0; i < existing.length; i++) {
      const a = existing[i]
      if (excludeId && a.id === excludeId) continue
      throw new BadRequestError("This spot already has availability in that period.")
    }
  }

  // Returns an error message string, or null when the range is valid.
  function rangeError(from, to) {
    const fromT = parseDT(from)
    const toT = parseDT(to)
    if (!fromT || !toT || fromT.getTime() >= toT.getTime()) return "Invalid time range."
    return null
  }

  // Throws if the authenticated user is not yet approved.
  function assertApproved(auth) {
    if (auth && !auth.getBool("approved")) {
      throw new ForbiddenError("Your account is pending admin approval.")
    }
  }

  // Sweeps requests past their window:
  //   confirmed -> completed
  //   pending   -> expired (+ "no host found" email to the requester).
  // Called by the cron job and the admin-only manual trigger (cron.pb.js).
  function runSweep(app) {
    const now = new Date()

    const completed = app.findRecordsByFilter(
      "requests",
      "status = 'confirmed' && to <= {:now}",
      "", 500, 0,
      { now: now }
    )
    for (let i = 0; i < completed.length; i++) {
      completed[i].set("status", "completed")
      app.save(completed[i])
    }

    const expired = app.findRecordsByFilter(
      "requests",
      "status = 'pending' && to <= {:now}",
      "", 500, 0,
      { now: now }
    )
    for (let i = 0; i < expired.length; i++) {
      const req = expired[i]
      const requester = loadUser(app, req.getString("requester"))
      req.set("status", "expired")
      app.save(req)
      if (requester) {
        const lang = requester.getString("language") || "en"
        sendMail(
          requester.getString("email"),
          t(lang, "mail.expired.subject"),
          "<p>" + t(lang, "mail.expired.body") + "</p>" +
          "<p><b>" + fmtRange(req.getString("from"), req.getString("to")) + "</b></p>"
        )
      }
    }

    // Availability windows that have fully passed are no longer offerable.
    const availExpired = app.findRecordsByFilter(
      "availability",
      "status = 'available' && to <= {:now}",
      "", 500, 0,
      { now: now }
    )
    for (let i = 0; i < availExpired.length; i++) {
      availExpired[i].set("status", "expired")
      app.save(availExpired[i])
    }
  }

  return {
    t: t,
    esc: esc,
    appURL: appURL,
    parseDT: parseDT,
    pbDateTime: pbDateTime,
    fmtRange: fmtRange,
    gcalURL: gcalURL,
    sendMail: sendMail,
    adminNotifyEmails: adminNotifyEmails,
    loadUser: loadUser,
    loadSpot: loadSpot,
    overlappingConfirmed: overlappingConfirmed,
    isFutureEnough: isFutureEnough,
    matchingOwners: matchingOwners,
    checkOverlap: checkOverlap,
    assertSpotOwner: assertSpotOwner,
    rangeError: rangeError,
    assertApproved: assertApproved,
    runSweep: runSweep,
  }
})()
