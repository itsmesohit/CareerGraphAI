import { Request, Response, NextFunction } from 'express';
import { UsageService, UsageResourceType } from '../services/billing/usageService.js';

export function requireQuota(resource: UsageResourceType, cost: number = 1) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const quotaCheck = await UsageService.checkQuota(userId, resource, cost);

      if (!quotaCheck.allowed) {
        res.status(403).json({
          error: `Usage quota exceeded for ${resource}`,
          code: 'QUOTA_EXCEEDED',
          resource,
          limit: quotaCheck.limit,
          used: quotaCheck.used,
          remaining: quotaCheck.remaining,
          upgradeUrl: '/billing',
          message: `You have reached your limit (${quotaCheck.used}/${quotaCheck.limit}) for ${resource}. Please upgrade your plan to continue.`,
        });
        return;
      }

      next();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };
}

export function requireFeature(feature: 'mailboxTracking' | 'extensionAccess' | 'exportData') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const summary = await UsageService.getUsageSummary(userId);
      const isEnabled = summary.features[feature];

      if (!isEnabled) {
        res.status(403).json({
          error: `Feature "${feature}" is not available on your current plan`,
          code: 'FEATURE_LOCKED',
          feature,
          plan: summary.plan.name,
          upgradeUrl: '/billing',
          message: `This feature is locked on the ${summary.plan.name} tier. Upgrade to Pro or Premium to unlock.`,
        });
        return;
      }

      next();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };
}
