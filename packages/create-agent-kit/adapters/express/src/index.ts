import { app } from './lib/agent';

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const server = app.listen(port, () => {
  console.log(`Starting agent server on port ${port}...`);
});

export default server;
