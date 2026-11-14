// The only admin module that reads process.env. NEXT_PUBLIC_* values are inlined at
// build time and are public (Next's equivalent of Vite's VITE_*): never put secrets here.
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
