import { Router, type Request, type Response } from 'express';
import { requireAuth, requireWorkspaceAccess } from '@bizflow/auth';
import type { RequestWithWorkspace } from '@bizflow/auth';
import { prisma, type Prisma } from '@bizflow/database';
import { createTaskSchema, updateTaskSchema, taskQuerySchema } from '@bizflow/validation';
import { logger } from '../logger';

export const tasksRouter = Router({ mergeParams: true });

// ── CREATE task ──────────────────────────────────────────────────────────────
tasksRouter.post(
  '/',
  requireAuth,
  requireWorkspaceAccess('member'), // members+ can create tasks
  async (req: Request, res: Response) => {
    const ctx = (req as RequestWithWorkspace).workspaceContext;
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'validation_error',
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const { title, description, status, priority, dueDate, assigneeId } = parsed.data;

    // Validate assignee belongs to the SAME workspace
    if (assigneeId) {
      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: ctx.workspaceId,
            userId: assigneeId,
          },
        },
      });
      if (!membership) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Assignee must be an active member of this workspace.',
        });
      }
    }

    try {
      const task = await prisma.task.create({
        data: {
          workspaceId: ctx.workspaceId,
          assigneeId: assigneeId ?? null,
          title,
          description: description ?? null,
          status,
          priority,
          dueDate: dueDate ? new Date(dueDate) : null,
        },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueDate: true,
          assigneeId: true,
          assignee: {
            select: {
              id: true,
              email: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
      });

      logger.info({ workspaceId: ctx.workspaceId, taskId: task.id }, 'Task created');
      return res.status(201).json({ task });
    } catch (err) {
      logger.error({ err }, 'Failed to create task');
      return res
        .status(500)
        .json({ error: 'internal_server_error', message: 'Failed to create task.' });
    }
  },
);

// ── LIST tasks with pagination & filters ─────────────────────────────────────
tasksRouter.get(
  '/',
  requireAuth,
  requireWorkspaceAccess('viewer'), // viewers+ can list tasks
  async (req: Request, res: Response) => {
    const ctx = (req as unknown as RequestWithWorkspace).workspaceContext;
    const parsedQuery = taskQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({
        error: 'validation_error',
        issues: parsedQuery.error.flatten().fieldErrors,
      });
    }

    const { page, limit, status, priority, assigneeId, search } = parsedQuery.data;
    const skip = (page - 1) * limit;

    const where: Prisma.TaskWhereInput = {
      workspaceId: ctx.workspaceId,
      archived: false,
    };

    if (status) {
      where.status = status;
    }
    if (priority) {
      where.priority = priority;
    }
    if (assigneeId) {
      where.assigneeId = assigneeId;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    try {
      const [tasks, total] = await Promise.all([
        prisma.task.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            priority: true,
            dueDate: true,
            assigneeId: true,
            assignee: {
              select: {
                id: true,
                email: true,
                displayName: true,
                avatarUrl: true,
              },
            },
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.task.count({ where }),
      ]);

      return res.json({
        tasks,
        pagination: { page, limit, total },
      });
    } catch (err) {
      logger.error({ err }, 'Failed to list tasks');
      return res
        .status(500)
        .json({ error: 'internal_server_error', message: 'Failed to list tasks.' });
    }
  },
);

// ── GET single task ──────────────────────────────────────────────────────────
tasksRouter.get(
  '/:taskId',
  requireAuth,
  requireWorkspaceAccess('viewer'), // viewers+ can read task details
  async (req: Request, res: Response) => {
    const ctx = (req as unknown as RequestWithWorkspace).workspaceContext;
    const taskId = String(req.params['taskId']);

    try {
      const task = await prisma.task.findFirst({
        where: { id: taskId, workspaceId: ctx.workspaceId, archived: false },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueDate: true,
          assigneeId: true,
          assignee: {
            select: {
              id: true,
              email: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!task) {
        return res.status(404).json({ error: 'not_found', message: 'Task not found.' });
      }

      return res.json({ task });
    } catch (err) {
      logger.error({ err }, 'Failed to retrieve task');
      return res
        .status(500)
        .json({ error: 'internal_server_error', message: 'Failed to retrieve task.' });
    }
  },
);

// ── UPDATE task ──────────────────────────────────────────────────────────────
tasksRouter.patch(
  '/:taskId',
  requireAuth,
  requireWorkspaceAccess('member'), // members+ can update tasks
  async (req: Request, res: Response) => {
    const ctx = (req as unknown as RequestWithWorkspace).workspaceContext;
    const taskId = String(req.params['taskId']);
    const parsed = updateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'validation_error',
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const { title, description, status, priority, dueDate, assigneeId } = parsed.data;

    // Validate assignee belongs to the SAME workspace if reassigned
    if (assigneeId) {
      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: ctx.workspaceId,
            userId: assigneeId,
          },
        },
      });
      if (!membership) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Assignee must be an active member of this workspace.',
        });
      }
    }

    const data: Record<string, unknown> = {};
    if (title !== undefined) data['title'] = title;
    if (description !== undefined) data['description'] = description;
    if (status !== undefined) data['status'] = status;
    if (priority !== undefined) data['priority'] = priority;
    if (dueDate !== undefined) data['dueDate'] = dueDate ? new Date(dueDate) : null;
    if (assigneeId !== undefined) data['assigneeId'] = assigneeId;

    try {
      const updated = await prisma.task.updateMany({
        where: { id: taskId, workspaceId: ctx.workspaceId, archived: false },
        data,
      });

      if (updated.count === 0) {
        return res
          .status(404)
          .json({ error: 'not_found', message: 'Task not found or cannot be updated.' });
      }

      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueDate: true,
          assigneeId: true,
          assignee: {
            select: {
              id: true,
              email: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
      });

      logger.info({ workspaceId: ctx.workspaceId, taskId }, 'Task updated');
      return res.json({ task });
    } catch (err) {
      logger.error({ err }, 'Failed to update task');
      return res
        .status(500)
        .json({ error: 'internal_server_error', message: 'Failed to update task.' });
    }
  },
);

// ── ARCHIVE (soft-delete) task ───────────────────────────────────────────────
tasksRouter.delete(
  '/:taskId',
  requireAuth,
  requireWorkspaceAccess('admin'), // admin+ can archive tasks
  async (req: Request, res: Response) => {
    const ctx = (req as unknown as RequestWithWorkspace).workspaceContext;
    const taskId = String(req.params['taskId']);

    try {
      const archived = await prisma.task.updateMany({
        where: { id: taskId, workspaceId: ctx.workspaceId, archived: false },
        data: { archived: true },
      });

      if (archived.count === 0) {
        return res
          .status(404)
          .json({ error: 'not_found', message: 'Task not found or already archived.' });
      }

      logger.info({ workspaceId: ctx.workspaceId, taskId }, 'Task archived');
      return res.status(204).send();
    } catch (err) {
      logger.error({ err }, 'Failed to archive task');
      return res
        .status(500)
        .json({ error: 'internal_server_error', message: 'Failed to archive task.' });
    }
  },
);
