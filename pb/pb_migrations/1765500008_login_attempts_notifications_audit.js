// Round 4 collections:
//  1. login_attempts — per-IP login throttling (see users.pb.js auth hook),
//  2. notifications — in-app notifications created alongside the existing
//     transactional emails (bell + dropdown in Layout.tsx),
//  3. audit_logs — read-only record of admin actions (approve/edit/delete,
//     spot changes, admin request changes).
//
// All three are internal collections: locked rules (null) restrict access to
// superusers EXCEPT notifications, whose list/view/update rules let the
// recipient read and mark-read their own rows.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")

  let attempts = null
  try {
    attempts = app.findCollectionByNameOrId("login_attempts")
  } catch (_) {}
  if (!attempts) {
    attempts = new Collection({
      type: "base",
      name: "login_attempts",
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

  let notifications = null
  try {
    notifications = app.findCollectionByNameOrId("notifications")
  } catch (_) {}
  if (!notifications) {
    notifications = new Collection({
      type: "base",
      name: "notifications",
      listRule: "recipient = @request.auth.id",
      viewRule: "recipient = @request.auth.id",
      createRule: null,
      updateRule: "recipient = @request.auth.id",
      deleteRule: null,
      fields: [
        { name: "recipient", type: "relation", maxSelect: 1, collectionId: users.id, required: true, cascadeDelete: true },
        { name: "type", type: "select", values: ["submitted", "new_request", "confirmed", "cancelled", "expired", "host_removed", "completed", "reminder"], required: true, maxSelect: 1 },
        { name: "payload", type: "json", maxSize: 4000 },
        { name: "read", type: "bool" },
        { name: "createdAt", type: "autodate", onCreate: true },
        { name: "updatedAt", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE INDEX idx_notifications_recipient ON notifications (recipient)"],
    })
    app.save(notifications)
  }

  let logs = null
  try {
    logs = app.findCollectionByNameOrId("audit_logs")
  } catch (_) {}
  if (!logs) {
    logs = new Collection({
      type: "base",
      name: "audit_logs",
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: "actor", type: "relation", maxSelect: 1, collectionId: users.id, required: false, cascadeDelete: false },
        { name: "action", type: "text", required: true, max: 100 },
        { name: "targetType", type: "text", max: 50 },
        { name: "targetId", type: "text", max: 50 },
        { name: "details", type: "json", maxSize: 4000 },
        { name: "createdAt", type: "autodate", onCreate: true },
        { name: "updatedAt", type: "autodate", onCreate: true, onUpdate: true },
      ],
    })
    app.save(logs)
  }

  // Marker so the hourly reminder cron sends each "guest arrives soon" email
  // exactly once (the request window falls inside the reminder lookahead for
  // multiple consecutive cron runs).
  const requests = app.findCollectionByNameOrId("requests")
  if (!requests.fields.getByName("reminded")) {
    requests.fields.add(new BoolField({ name: "reminded" }))
    app.save(requests)
  }
}, (app) => {})
