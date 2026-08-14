// Seeds the default spot inventory: 8 buildings x 38 spots = 304 spots.
// Odd buildings are "Stairwell A", even buildings "Stairwell B".
migrate((app) => {
  const collection = app.findCollectionByNameOrId("spots")
  const perBuilding = 38
  for (let b = 1; b <= 8; b++) {
    const zone = b % 2 === 1 ? "Stairwell A" : "Stairwell B"
    for (let n = 1; n <= perBuilding; n++) {
      const padded = ("0" + n).slice(-2)
      const record = new Record(collection)
      record.set("number", "B" + b + "-" + padded)
      record.set("building", String(b))
      record.set("zone", zone)
      record.set("enabled", true)
      app.save(record)
    }
  }
}, (app) => {})
