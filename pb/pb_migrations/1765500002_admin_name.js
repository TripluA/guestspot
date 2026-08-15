// Give superusers a display name so admins can edit their own profile in the UI.
migrate((app) => {
  const admins = app.findCollectionByNameOrId("_superusers")
  if (!admins.fields.getByName("name")) {
    admins.fields.add(new TextField({ name: "name", max: 100 }))
    app.save(admins)
  }
}, (app) => {})
