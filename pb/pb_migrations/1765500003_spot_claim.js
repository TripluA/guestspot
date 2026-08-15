// Optional parking spot claimed at registration; the admin's approval creates
// the spots record automatically (see users.pb.js).
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  if (!users.fields.getByName("spotNumber")) {
    users.fields.add(new TextField({ name: "spotNumber", max: 20 }))
  }
  if (!users.fields.getByName("spotZone")) {
    users.fields.add(new TextField({ name: "spotZone", max: 100 }))
  }
  app.save(users)
}, (app) => {})
