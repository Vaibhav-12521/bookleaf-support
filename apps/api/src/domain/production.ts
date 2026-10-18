import { PRODUCTION_STAGES, type ProductionStage } from '@bookleaf/shared';

const PUBLISHED: ProductionStage = 'Published & Live';

export function parseProductionStage(status: string): ProductionStage {
  const normalized = status.trim().toLowerCase();
  if (normalized === PUBLISHED.toLowerCase()) return PUBLISHED;

  const stagePart = normalized.includes('-') ? normalized.split('-').slice(1).join('-').trim() : normalized;
  const match = PRODUCTION_STAGES.find((s) => s.toLowerCase() === stagePart);
  return match ?? 'Manuscript Received';
}

export function isPublished(status: string): boolean {
  return parseProductionStage(status) === PUBLISHED;
}
