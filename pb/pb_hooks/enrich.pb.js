// Hides spot ownership from users who don't own the spot.
onRecordEnrich((e) => {
  const info = e.requestInfo
  const auth = info.auth
  if (e.record.collection().name === "spots") {
    const ownerId = e.record.getString("owner")
    const isSuper = auth && auth.isSuperuser()
    const isOwner = auth && ownerId && auth.id === ownerId
    if (!isSuper && !isOwner) {
      e.record.hide("owner")
    }
  }
  e.next()
})
