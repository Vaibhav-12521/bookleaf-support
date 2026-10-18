import { Router } from 'express';
import { getAiProvider } from '../../ai/index';
import { requireRole } from '../../middleware/authenticate';
import { getOverview } from './admin.service';

export const adminRouter = Router();
adminRouter.use(requireRole('ADMIN'));

adminRouter.get('/overview', async (_req, res) => {
  res.json({ overview: await getOverview(), aiEnabled: getAiProvider() !== null });
});
