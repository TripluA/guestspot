import PocketBase from 'pocketbase'

// Empty base URL = same origin. In dev, Vite proxies /api and /_ to PB.
export const pb = new PocketBase(import.meta.env.BASE_URL)
pb.autoCancellation(false)
