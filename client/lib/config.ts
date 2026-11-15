// The only user-app module that reads process.env. NEXT_PUBLIC_* values are inlined at build
// time and are public: never put secrets here. Each variable is read with a literal
// process.env.NAME access so Next can inline it.
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
