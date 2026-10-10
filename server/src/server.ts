import { buildApp } from './app';

async function main() {
  const server = await buildApp({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  const port = Number(process.env.PORT) || 4000;
  const host = process.env.HOST || '0.0.0.0';

  try {
    await server.listen({ port, host });
    console.log(`DarkoBarber API server listening on http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
