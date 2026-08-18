// Applies environment-backed settings on every boot.
// Values are only applied when the matching env var is set, so admin panel
// edits made at runtime are never clobbered.
onBootstrap((e) => {
  e.next()

  const settings = e.app.settings()

  settings.meta.appName = "GuestSpot"

  const publicUrl = $os.getenv("PUBLIC_URL")
  if (publicUrl) settings.meta.appURL = publicUrl

  const mailFrom = $os.getenv("MAIL_FROM")
  if (mailFrom) {
    const m = String(mailFrom).match(/^\s*(.*?)\s*<([^>]+)>\s*$/)
    if (m) {
      settings.meta.senderAddress = m[2]
      settings.meta.senderName = m[1] || $os.getenv("MAIL_SENDER_NAME") || "GuestSpot"
    } else {
      settings.meta.senderAddress = mailFrom
      settings.meta.senderName = $os.getenv("MAIL_SENDER_NAME") || "GuestSpot"
    }
  }

  const smtpHost = $os.getenv("SMTP_HOST")
  if (smtpHost) {
    settings.smtp.enabled = true
    settings.smtp.host = smtpHost
    settings.smtp.port = parseInt($os.getenv("SMTP_PORT") || "587", 10)
    settings.smtp.username = $os.getenv("SMTP_USER") || ""
    settings.smtp.password = $os.getenv("SMTP_PASS") || ""
    settings.smtp.tls = ($os.getenv("SMTP_TLS") || "false").toLowerCase() === "true"
    settings.smtp.localName = $os.getenv("SMTP_LOCAL_NAME") || ""
    const authMethod = ($os.getenv("SMTP_AUTH_METHOD") || "PLAIN").toUpperCase()
    settings.smtp.authMethod = authMethod === "LOGIN" ? "LOGIN" : "PLAIN"
  }

  e.app.save(settings)

  // Optional email verification on registration (REQUIRE_EMAIL_VERIFICATION=true).
  // Must be set after app.save(settings) to avoid overwriting the collection.
  const requireVerification = ($os.getenv("REQUIRE_EMAIL_VERIFICATION") || "").toLowerCase() === "true"
  try {
    const users = app.findCollectionByNameOrId("users")
    if (users.requireVerification !== requireVerification) {
      users.requireVerification = requireVerification
      app.save(users)
    }
  } catch (_) {
    // collection may not exist yet on first boot
  }
})
