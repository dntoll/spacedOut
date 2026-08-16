# Project Guide

- [req.md](./req.md) is the authoritative list of game requirements. Every requirement has a stable `REQ-*` identifier and must have at least one automated test carrying the same identifier. Only add things asked for by me, dont add derivates.
- [mvc.md](./mvc.md) defines the required architecture, ownership boundaries, naming conventions, and communication patterns. Follow it for every code change.
- Tests are colocated with the class or module responsible for the behavior and use `*.test.ts` filenames.
- Run `npm test` to verify requirements and `npm run build` to verify the production TypeScript/Vite bundle.
- When changing a requirement, update `req.md` and its corresponding tests together. Ask before changing a req.
- When changing architecture or ownership, update `mvc.md` if the governing rule changes. Ask before adding.
