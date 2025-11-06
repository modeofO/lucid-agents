import { app } from "./agent";

const port = Number(process.env.PORT) || 3000;

console.log(`🚀 Starting agent server on port ${port}...`);

Bun.serve({
  fetch: app.fetch,
  port,
});

console.log(`✅ Agent running at http://localhost:${port}`);
console.log(`📋 Agent Card: http://localhost:${port}/.well-known/agent.json`);
console.log(`📊 Health: http://localhost:${port}/health`);
console.log(`📝 Entrypoints: http://localhost:${port}/entrypoints`);

