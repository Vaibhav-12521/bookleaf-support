import { PRIORITIES, TICKET_STATUSES, type TicketOverviewDTO } from '@bookleaf/shared';
import { estimateCostUsd } from '../../ai/usage';
import { prisma } from '../../lib/prisma';

const UNRESOLVED = { status: { in: ['OPEN', 'IN_PROGRESS'] as ('OPEN' | 'IN_PROGRESS')[] } };

export async function getOverview(): Promise<TicketOverviewDTO> {
  const [byStatus, byPriority, unassigned, awaitingTeam, oldest, aiByModel] = await Promise.all([
    prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.ticket.groupBy({ by: ['priority'], where: UNRESOLVED, _count: { _all: true } }),
    prisma.ticket.count({ where: { ...UNRESOLVED, assigneeId: null } }),
    prisma.ticket.count({ where: { ...UNRESOLVED, awaitingTeam: true } }),
    prisma.ticket.findFirst({ where: UNRESOLVED, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    prisma.aiEvent.groupBy({
      by: ['model', 'success'],
      _count: { _all: true },
      _sum: { inputTokens: true, outputTokens: true, cacheReadTokens: true, cacheWriteTokens: true },
    }),
  ]);

  const ai = { calls: 0, failures: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 };
  for (const row of aiByModel) {
    const usage = {
      inputTokens: row._sum.inputTokens ?? 0,
      outputTokens: row._sum.outputTokens ?? 0,
      cacheReadTokens: row._sum.cacheReadTokens ?? 0,
      cacheWriteTokens: row._sum.cacheWriteTokens ?? 0,
    };
    ai.calls += row._count._all;
    if (!row.success) ai.failures += row._count._all;
    ai.inputTokens += usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
    ai.outputTokens += usage.outputTokens;
    ai.estimatedCostUsd += estimateCostUsd(row.model, usage);
  }

  return {
    byStatus: Object.fromEntries(
      TICKET_STATUSES.map((s) => [s, byStatus.find((r) => r.status === s)?._count._all ?? 0]),
    ) as TicketOverviewDTO['byStatus'],
    unresolvedByPriority: Object.fromEntries(
      PRIORITIES.map((p) => [p, byPriority.find((r) => r.priority === p)?._count._all ?? 0]),
    ) as TicketOverviewDTO['unresolvedByPriority'],
    unassigned,
    awaitingTeam,
    oldestUnresolvedAt: oldest?.createdAt.toISOString() ?? null,
    ai: { ...ai, estimatedCostUsd: Number(ai.estimatedCostUsd.toFixed(4)) },
  };
}
