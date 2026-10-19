import { Router, type Request, type Response } from 'express';
import { requireAuth, requireWorkspaceAccess } from '@bizflow/auth';
import type { RequestWithWorkspace } from '@bizflow/auth';
import { prisma } from '@bizflow/database';
import { createCustomerSchema, updateCustomerSchema, paginationSchema } from '@bizflow/validation';
import { logger } from '../logger';

export const customersRouter = Router({ mergeParams: true });

// ── CREATE customer ────────────────────────────────────────────────────────
customersRouter.post(
  '/',
  requireAuth,
  requireWorkspaceAccess('member'), // members can create
  async (req: Request, res: Response) => {
    const ctx = (req as RequestWithWorkspace).workspaceContext;
    const parsed = createCustomerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'validation_error',
        issues: parsed.error.flatten().fieldErrors,
      });
    }
    const { name, email, phone, notes } = parsed.data;
    try {
      const customer = await prisma.customer.create({
        data: {
          workspaceId: ctx.workspaceId,
          name,
          email: email ?? null,
          phone: phone ?? null,
          notes: notes ?? null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      logger.info({ workspaceId: ctx.workspaceId, customerId: customer.id }, 'Customer created');
      return res.status(201).json({ customer });
    } catch (err) {
      logger.error({ err }, 'Failed to create customer');
      return res
        .status(500)
        .json({ error: 'internal_server_error', message: 'Failed to create customer.' });
    }
  },
);

// ── LIST customers with pagination ───────────────────────────────────────
customersRouter.get(
  '/',
  requireAuth,
  requireWorkspaceAccess('viewer'), // any member can list
  async (req: Request, res: Response) => {
    const ctx = (req as unknown as RequestWithWorkspace).workspaceContext;
    const parsedQuery = paginationSchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({
        error: 'validation_error',
        issues: parsedQuery.error.flatten().fieldErrors,
      });
    }
    const { page, limit } = parsedQuery.data;
    const skip = (page - 1) * limit;
    try {
      const [customers, total] = await Promise.all([
        prisma.customer.findMany({
          where: { workspaceId: ctx.workspaceId, archived: false },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.customer.count({ where: { workspaceId: ctx.workspaceId, archived: false } }),
      ]);
      return res.json({
        customers,
        pagination: { page, limit, total },
      });
    } catch (err) {
      logger.error({ err }, 'Failed to list customers');
      return res
        .status(500)
        .json({ error: 'internal_server_error', message: 'Failed to list customers.' });
    }
  },
);

// ── GET single customer ─────────────────────────────────────────────────
customersRouter.get(
  '/:customerId',
  requireAuth,
  requireWorkspaceAccess('viewer'),
  async (req: Request, res: Response) => {
    const ctx = (req as unknown as RequestWithWorkspace).workspaceContext;
    const customerId = String(req.params['customerId']);
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId, workspaceId: ctx.workspaceId, archived: false },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!customer) {
        return res.status(404).json({ error: 'not_found', message: 'Customer not found.' });
      }
      return res.json({ customer });
    } catch (err) {
      logger.error({ err }, 'Failed to retrieve customer');
      return res
        .status(500)
        .json({ error: 'internal_server_error', message: 'Failed to retrieve customer.' });
    }
  },
);

// ── UPDATE customer ─────────────────────────────────────────────────────
customersRouter.patch(
  '/:customerId',
  requireAuth,
  requireWorkspaceAccess('admin'), // admin+ can update
  async (req: Request, res: Response) => {
    const ctx = (req as unknown as RequestWithWorkspace).workspaceContext;
    const customerId = String(req.params['customerId']);
    const parsed = updateCustomerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'validation_error',
        issues: parsed.error.flatten().fieldErrors,
      });
    }
    const { name, email, phone, notes } = parsed.data;

    // Build a data object that only includes fields present in the payload,
    // converting undefined (omitted) ➜ skip, present ➜ value | null.
    const data: Record<string, string | null> = {};
    if (name !== undefined) data['name'] = name;
    if (email !== undefined) data['email'] = email;
    if (phone !== undefined) data['phone'] = phone;
    if (notes !== undefined) data['notes'] = notes;

    try {
      const updated = await prisma.customer.updateMany({
        where: { id: customerId, workspaceId: ctx.workspaceId, archived: false },
        data,
      });
      if (updated.count === 0) {
        return res
          .status(404)
          .json({ error: 'not_found', message: 'Customer not found or cannot be updated.' });
      }
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return res.json({ customer });
    } catch (err) {
      logger.error({ err }, 'Failed to update customer');
      return res
        .status(500)
        .json({ error: 'internal_server_error', message: 'Failed to update customer.' });
    }
  },
);

// ── ARCHIVE (soft‑delete) customer ───────────────────────────────────────
customersRouter.delete(
  '/:customerId',
  requireAuth,
  requireWorkspaceAccess('admin'), // admin+ can archive
  async (req: Request, res: Response) => {
    const ctx = (req as unknown as RequestWithWorkspace).workspaceContext;
    const customerId = String(req.params['customerId']);
    try {
      const archived = await prisma.customer.updateMany({
        where: { id: customerId, workspaceId: ctx.workspaceId, archived: false },
        data: { archived: true },
      });
      if (archived.count === 0) {
        return res
          .status(404)
          .json({ error: 'not_found', message: 'Customer not found or already archived.' });
      }
      return res.status(204).send();
    } catch (err) {
      logger.error({ err }, 'Failed to archive customer');
      return res
        .status(500)
        .json({ error: 'internal_server_error', message: 'Failed to archive customer.' });
    }
  },
);
