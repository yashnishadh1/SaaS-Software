import { describe, it, expect } from 'vitest';
import { canCreateTask, canEditTask, canArchiveTask, type Task } from '../types/task';

describe('Task Frontend Role Permissions', () => {
  it('enforces creation permissions: owner, admin, and member can create; viewer cannot', () => {
    expect(canCreateTask('owner')).toBe(true);
    expect(canCreateTask('admin')).toBe(true);
    expect(canCreateTask('member')).toBe(true);
    expect(canCreateTask('viewer')).toBe(false);
  });

  it('enforces edit permissions: owner, admin, and member can edit; viewer cannot', () => {
    expect(canEditTask('owner')).toBe(true);
    expect(canEditTask('admin')).toBe(true);
    expect(canEditTask('member')).toBe(true);
    expect(canEditTask('viewer')).toBe(false);
  });

  it('enforces archive permissions: only owner and admin can archive; member and viewer cannot', () => {
    expect(canArchiveTask('owner')).toBe(true);
    expect(canArchiveTask('admin')).toBe(true);
    expect(canArchiveTask('member')).toBe(false);
    expect(canArchiveTask('viewer')).toBe(false);
  });
});

describe('Task Search and Filter Helpers', () => {
  const sampleTasks: Task[] = [
    {
      id: 't1',
      title: 'Fix authentication cookie bug',
      description: 'Fix issue where token was not transmitted',
      status: 'in_progress',
      priority: 'urgent',
      dueDate: '2026-11-01T00:00:00.000Z',
      assigneeId: 'user-alice',
      assignee: {
        id: 'user-alice',
        email: 'alice@example.com',
        displayName: 'Alice',
        avatarUrl: null,
      },
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 't2',
      title: 'Setup automated tests',
      description: 'Add integration testing suite for database',
      status: 'done',
      priority: 'high',
      dueDate: null,
      assigneeId: 'user-bob',
      assignee: { id: 'user-bob', email: 'bob@example.com', displayName: 'Bob', avatarUrl: null },
      createdAt: '2026-10-02T00:00:00.000Z',
      updatedAt: '2026-10-02T00:00:00.000Z',
    },
    {
      id: 't3',
      title: 'Design landing page mockup',
      description: null,
      status: 'todo',
      priority: 'low',
      dueDate: '2026-11-15T00:00:00.000Z',
      assigneeId: null,
      assignee: null,
      createdAt: '2026-10-03T00:00:00.000Z',
      updatedAt: '2026-10-03T00:00:00.000Z',
    },
  ];

  function filterTasks(
    list: Task[],
    query: string,
    status?: string,
    priority?: string,
    assigneeId?: string,
  ): Task[] {
    const q = query.trim().toLowerCase();
    return list.filter((task) => {
      if (q) {
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = task.description?.toLowerCase().includes(q) ?? false;
        if (!matchesTitle && !matchesDesc) return false;
      }
      if (status && task.status !== status) return false;
      if (priority && task.priority !== priority) return false;
      if (assigneeId && task.assigneeId !== assigneeId) return false;
      return true;
    });
  }

  it('filters tasks by text query across title and description', () => {
    expect(filterTasks(sampleTasks, 'cookie')).toHaveLength(1);
    expect(filterTasks(sampleTasks, 'cookie')[0]?.id).toBe('t1');

    expect(filterTasks(sampleTasks, 'database')).toHaveLength(1);
    expect(filterTasks(sampleTasks, 'database')[0]?.id).toBe('t2');

    expect(filterTasks(sampleTasks, 'mockup')).toHaveLength(1);
    expect(filterTasks(sampleTasks, 'mockup')[0]?.id).toBe('t3');
  });

  it('filters tasks by status', () => {
    expect(filterTasks(sampleTasks, '', 'in_progress')).toHaveLength(1);
    expect(filterTasks(sampleTasks, '', 'done')).toHaveLength(1);
    expect(filterTasks(sampleTasks, '', 'cancelled')).toHaveLength(0);
  });

  it('filters tasks by priority', () => {
    expect(filterTasks(sampleTasks, '', undefined, 'urgent')).toHaveLength(1);
    expect(filterTasks(sampleTasks, '', undefined, 'low')).toHaveLength(1);
    expect(filterTasks(sampleTasks, '', undefined, 'medium')).toHaveLength(0);
  });

  it('filters tasks by assigneeId', () => {
    expect(filterTasks(sampleTasks, '', undefined, undefined, 'user-alice')).toHaveLength(1);
    expect(filterTasks(sampleTasks, '', undefined, undefined, 'user-bob')).toHaveLength(1);
  });

  it('combines multiple filters correctly', () => {
    const result = filterTasks(
      sampleTasks,
      'authentication',
      'in_progress',
      'urgent',
      'user-alice',
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('t1');

    const noResult = filterTasks(sampleTasks, 'authentication', 'done');
    expect(noResult).toHaveLength(0);
  });
});
