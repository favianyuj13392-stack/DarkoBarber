import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { adminKeyMatches } from '../rewards/admin.routes';
import { getRewardsConfig } from '../rewards/rewards.config';
import { getMonthlyCutUsage, getPlanCutLimit } from '../cuts/cut-quota';

const updatePlanSchema = z.object({
  plan: z.enum(['GRATIS', 'PRO']),
});

const listBarbersQuerySchema = z.object({
  search: z.string().optional(),
  plan: z.enum(['GRATIS', 'PRO']).optional(),
});

export const superAdminRoutes: FastifyPluginAsync = async (fastify) => {
  // Fail-closed authentication guard via x-admin-key header
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const adminApiKey = process.env.ADMIN_API_KEY?.trim() || getRewardsConfig().adminApiKey;
    if (!adminApiKey) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Admin module disabled' });
    }

    const header = request.headers['x-admin-key'];
    const provided = Array.isArray(header) ? header[0] : header;
    if (!provided) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Admin key required' });
    }

    if (!adminKeyMatches(provided, adminApiKey)) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Invalid admin key' });
    }
  });

  // GET /admin/verify - Validates whether the admin key is correct
  fastify.get('/verify', async (_request, reply) => {
    return reply.status(200).send({ success: true, message: 'Admin authenticated' });
  });

  // GET /admin/barbers - List all registered barbers with plan, usage and contact info
  fastify.get('/barbers', async (request, reply) => {
    const parsed = listBarbersQuerySchema.safeParse(request.query);
    const search = parsed.success ? parsed.data.search?.toLowerCase().trim() : undefined;
    const planFilter = parsed.success ? parsed.data.plan : undefined;

    const whereClause: any = {};
    if (planFilter) {
      whereClause.plan = planFilter;
    }
    if (search) {
      whereClause.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const barbers = await fastify.prisma.barber.findMany({
      where: whereClause,
      include: {
        shop: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const now = new Date();
    const enrichedBarbers = await Promise.all(
      barbers.map(async (b) => {
        const usage = await getMonthlyCutUsage(fastify.prisma, b.id, b.plan, now);
        const maxCuts = getPlanCutLimit(b.plan);
        return {
          id: b.id,
          displayName: b.displayName,
          email: b.email,
          phone: b.phone,
          avatarUrl: b.avatarUrl,
          plan: b.plan,
          isActive: b.isActive,
          createdAt: b.createdAt.toISOString(),
          shopName: b.shop?.name || null,
          cutsCountThisMonth: usage.finished + usage.inProgress,
          maxCuts,
        };
      })
    );

    return reply.status(200).send({ barbers: enrichedBarbers });
  });

  // PUT /admin/barbers/:id/plan - Activate or change barber plan (manual payment verification)
  fastify.put('/barbers/:id/plan', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updatePlanSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Plan must be either GRATIS or PRO',
      });
    }

    const existing = await fastify.prisma.barber.findUnique({
      where: { id },
    });

    if (!existing) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: 'Barber not found',
      });
    }

    const updated = await fastify.prisma.barber.update({
      where: { id },
      data: { plan: parsed.data.plan },
      select: {
        id: true,
        displayName: true,
        email: true,
        phone: true,
        plan: true,
        updatedAt: true,
      },
    });

    return reply.status(200).send({
      success: true,
      barber: updated,
      message: `Plan actualizado correctamente a ${updated.plan} para ${updated.displayName}`,
    });
  });
};
