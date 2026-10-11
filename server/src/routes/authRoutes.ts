import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'User with this email already exists.' });
    }

    const tenantSlug = `tenant_${email.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}`;
    const tenant = await prisma.tenant.create({
      data: { name: `${name}'s Workspace`, slug: tenantSlug }
    });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        tenantId: tenant.id,
        role: 'CANDIDATE',
        subscription: {
          create: { plan: 'PRO', status: 'ACTIVE', maxDailyApplications: 25 }
        }
      }
    });

    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenantId, email: user.email, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN } as any
    );

    return res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, tenantId: user.tenantId, role: user.role }
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required.' });
    }

    // Demo user quick login bypass
    if (email === 'alex.rivera@example.com' || email === 'demo@careergraph.ai') {
      const token = jwt.sign(
        { userId: 'demo-user-1', tenantId: 'tenant-demo', email, role: 'CANDIDATE' },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN } as any
      );
      return res.json({
        token,
        user: { id: 'demo-user-1', name: 'Alex Rivera', email, tenantId: 'tenant-demo', role: 'CANDIDATE' }
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenantId, email: user.email, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN } as any
    );

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, tenantId: user.tenantId, role: user.role }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
