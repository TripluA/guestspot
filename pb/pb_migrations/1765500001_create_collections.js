// GuestSpot schema: extends users (approval/profile) and adds spots,
// availability and requests collections.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")

  // --- users rules ---
  users.listRule = "@request.auth.id != ''"
  users.viewRule = "@request.auth.id != ''"
  users.createRule = "@request.auth.id = ''"
  users.updateRule = "id = @request.auth.id"
  users.deleteRule = ""
  users.manageRule = null

  // --- users profile fields ---
  users.fields.add(new TextField({ name: "name", required: true, max: 100 }))
  users.fields.add(new SelectField({
    name: "building",
    values: ["1", "2", "3", "4", "5", "6", "7", "8"],
    required: true,
    maxSelect: 1,
  }))
  users.fields.add(new TextField({ name: "apartment", max: 20 }))
  users.fields.add(new TextField({ name: "phone", max: 30 }))
  users.fields.add(new BoolField({ name: "approved", required: false }))
  users.fields.add(new SelectField({
    name: "language",
    values: ["en", "ro"],
    required: true,
    maxSelect: 1,
  }))
  app.save(users)

  // --- spots ---
  const spots = new Collection({
    type: "base",
    name: "spots",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [
      { name: "number", type: "text", required: true, max: 20 },
      { name: "building", type: "select", values: ["1", "2", "3", "4", "5", "6", "7", "8"], required: true, maxSelect: 1 },
      { name: "zone", type: "text", max: 100 },
      { name: "owner", type: "relation", maxSelect: 1, collectionId: users.id, required: false, cascadeDelete: false },
      { name: "enabled", type: "bool", required: false },
      { name: "notes", type: "text", max: 500 },
      { name: "createdAt", type: "autodate", onCreate: true },
      { name: "updatedAt", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_spots_number ON spots (number)"],
  })
  app.save(spots)

  // --- availability ---
  const availability = new Collection({
    type: "base",
    name: "availability",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "owner = @request.auth.id",
    deleteRule: "owner = @request.auth.id",
    fields: [
      { name: "spot", type: "relation", maxSelect: 1, collectionId: spots.id, required: true, cascadeDelete: true },
      { name: "owner", type: "relation", maxSelect: 1, collectionId: users.id, required: true, cascadeDelete: true },
      { name: "from", type: "date", required: true },
      { name: "to", type: "date", required: true },
      { name: "reason", type: "text", max: 300 },
      { name: "status", type: "select", values: ["available", "cancelled"], required: true, maxSelect: 1 },
      { name: "createdAt", type: "autodate", onCreate: true },
      { name: "updatedAt", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_availability_spot ON availability (spot)"],
  })
  app.save(availability)

  // --- requests ---
  const requests = new Collection({
    type: "base",
    name: "requests",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "requester = @request.auth.id",
    deleteRule: "",
    fields: [
      { name: "requester", type: "relation", maxSelect: 1, collectionId: users.id, required: true, cascadeDelete: true },
      { name: "from", type: "date", required: true },
      { name: "to", type: "date", required: true },
      { name: "guests", type: "number", min: 1, max: 20 },
      { name: "note", type: "text", max: 1000 },
      { name: "status", type: "select", values: ["pending", "confirmed", "cancelled", "completed"], required: true, maxSelect: 1 },
      { name: "spot", type: "relation", maxSelect: 1, collectionId: spots.id, required: false, cascadeDelete: false },
      { name: "confirmer", type: "relation", maxSelect: 1, collectionId: users.id, required: false, cascadeDelete: false },
      { name: "createdAt", type: "autodate", onCreate: true },
      { name: "updatedAt", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_requests_status_from ON requests (status, from)"],
  })
  app.save(requests)
}, (app) => {})
