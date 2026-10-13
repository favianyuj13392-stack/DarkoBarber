import fp from 'fastify-plugin';
import fastifyWebsocket from '@fastify/websocket';
import { FastifyPluginAsync } from 'fastify';

const websocketPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyWebsocket, {
    options: {
      maxPayload: 1048576,
    },
  });
};

export default fp(websocketPlugin, {
  name: 'websocket-plugin',
});
