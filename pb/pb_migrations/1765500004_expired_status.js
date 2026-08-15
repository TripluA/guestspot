// Adds the "expired" status to requests (used by the guestspot-sweep cron job
// for pending requests whose window passed without a host).
migrate((app) => {
  const requests = app.findCollectionByNameOrId("requests")
  const status = requests.fields.getByName("status")
  if (status && status.values && status.values.indexOf("expired") === -1) {
    status.values = status.values.concat(["expired"])
  }
  app.save(requests)
}, (app) => {})
