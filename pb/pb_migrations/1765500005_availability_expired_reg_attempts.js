// Adds:
//  1. the "expired" status to availability (flipped by the guestspot-sweep
//     cron for windows whose `to` has passed),
//  2. a reg_attempts collection used to throttle anonymous self-registration
//     (see users.pb.js create hook).
migrate((app) => {
  const availability = app.findCollectionByNameOrId("availability")
  const status = availability.fields.getByName("status")
  if (status && status.values && status.values.indexOf("expired") === -1) {
    status.values = status.values.concat(["expired"])
  }
  app.save(availability)

  let attempts = null
  try {
    attempts = app.findCollectionByNameOrId("reg_attempts")
  } catch (_) {}
  if (!attempts) {
    attempts = new Collection({
      type: "base",
      name: "reg_attempts",
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: "ip", type: "text", required: true, max: 45 },
        { name: "createdAt", type: "autodate", onCreate: true },
        { name: "updatedAt", type: "autodate", onCreate: true, onUpdate: true },
      ],
    })
    app.save(attempts)
  }
}, (app) => {})
