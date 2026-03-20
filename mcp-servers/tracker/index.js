#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TrackerApi } from './api.js';

const api = new TrackerApi(
  process.env.YANDEX_OAUTH_TOKEN,
  process.env.YANDEX_ORG_ID
);

const TOOLS = [
  {
    name: 'list_queues',
    description: 'Список всех очередей в Яндекс Трекере',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_users',
    description: 'Список сотрудников организации. Примечание: возвращает старые аккаунты (directory). У большинства сотрудников есть два аккаунта — старый и новый.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'resolve_user',
    description: 'Найти все аккаунты сотрудника (старый архивный + новый активный). Используй перед get_employee_stats или get_worklogs если хочешь убедиться что нашёл правильного человека.',
    inputSchema: {
      type: 'object',
      required: ['loginOrName'],
      properties: {
        loginOrName: { type: 'string', description: 'Логин (например alexandersv1) или часть имени (например Свистунов)' },
      },
    },
  },
  {
    name: 'list_issues',
    description: 'Список задач с фильтрацией. Все параметры опциональны.',
    inputSchema: {
      type: 'object',
      properties: {
        queue: { type: 'string', description: 'Ключ очереди, например PROJ' },
        assignee: { type: 'string', description: 'Логин исполнителя' },
        status: { type: 'string', description: 'Статус задачи: open, inProgress, closed и т.д.' },
        createdFrom: { type: 'string', description: 'Дата создания от (ISO 8601)' },
        createdTo: { type: 'string', description: 'Дата создания до (ISO 8601)' },
        updatedFrom: { type: 'string', description: 'Дата обновления от (ISO 8601)' },
        updatedTo: { type: 'string', description: 'Дата обновления до (ISO 8601)' },
        resolution: { type: 'string', description: 'Резолюция: fixed, wontFix и т.д.' },
        perPage: { type: 'number', description: 'Задач на страницу (по умолчанию 50)' },
        page: { type: 'number', description: 'Номер страницы (по умолчанию 1)' },
      },
    },
  },
  {
    name: 'get_issue',
    description: 'Детали конкретной задачи',
    inputSchema: {
      type: 'object',
      required: ['issueKey'],
      properties: {
        issueKey: { type: 'string', description: 'Ключ задачи, например PROJ-123' },
      },
    },
  },
  {
    name: 'create_issue',
    description: 'Создать новую задачу',
    inputSchema: {
      type: 'object',
      required: ['queue', 'summary'],
      properties: {
        queue: { type: 'string', description: 'Ключ очереди' },
        summary: { type: 'string', description: 'Заголовок задачи' },
        description: { type: 'string', description: 'Описание задачи (markdown)' },
        assignee: { type: 'string', description: 'Логин или числовой ID исполнителя' },
        priority: { type: 'string', description: 'critical, blocker, major, normal, minor, trivial' },
        type: { type: 'string', description: 'bug, task, improvement и т.д.' },
        deadline: { type: 'string', description: 'Срок выполнения ISO 8601, например 2026-03-11' },
      },
    },
  },
  {
    name: 'update_issue',
    description: 'Обновить поля задачи',
    inputSchema: {
      type: 'object',
      required: ['issueKey'],
      properties: {
        issueKey: { type: 'string', description: 'Ключ задачи' },
        summary: { type: 'string' },
        description: { type: 'string' },
        assignee: { type: 'string', description: 'Логин или числовой ID исполнителя' },
        priority: { type: 'string' },
        deadline: { type: 'string', description: 'Срок выполнения ISO 8601, например 2026-03-11' },
      },
    },
  },
  {
    name: 'move_issue',
    description: 'Сменить статус задачи. Сначала вызови list_transitions чтобы узнать доступные переходы.',
    inputSchema: {
      type: 'object',
      required: ['issueKey', 'transitionId'],
      properties: {
        issueKey: { type: 'string', description: 'Ключ задачи' },
        transitionId: { type: 'string', description: 'ID перехода из list_transitions' },
        comment: { type: 'string', description: 'Комментарий при смене статуса' },
      },
    },
  },
  {
    name: 'list_transitions',
    description: 'Доступные переходы статуса для задачи',
    inputSchema: {
      type: 'object',
      required: ['issueKey'],
      properties: {
        issueKey: { type: 'string' },
      },
    },
  },
  {
    name: 'add_worklog',
    description: 'Залогировать время на задачу',
    inputSchema: {
      type: 'object',
      required: ['issueKey', 'duration'],
      properties: {
        issueKey: { type: 'string' },
        duration: { type: 'string', description: 'Например: PT2H30M (2 часа 30 минут), P1D (1 день)' },
        comment: { type: 'string' },
        start: { type: 'string', description: 'ISO 8601, по умолчанию сейчас' },
      },
    },
  },
  {
    name: 'search_issues',
    description: 'Поиск задач по тексту и/или сложным фильтрам. Поддерживает фильтр по дате: {"updatedAt": {"from": "2026-03-02T00:00:00", "to": "2026-03-08T23:59:59"}}',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Полнотекстовый поиск' },
        filter: { type: 'object', description: 'Объект фильтра. Пример: {"assignee": "login", "queue": "PROJ", "updatedAt": {"from": "...", "to": "..."}}' },
        perPage: { type: 'number' },
        page: { type: 'number' },
      },
    },
  },
  {
    name: 'get_employee_stats',
    description: 'Статистика сотрудника за период: задачи обновлённые/закрытые/в работе. Автоматически находит оба аккаунта (старый + новый).',
    inputSchema: {
      type: 'object',
      required: ['assignee'],
      properties: {
        assignee: { type: 'string', description: 'Логин или часть имени, например: alexandersv1 или Свистунов' },
        queue: { type: 'string', description: 'Ключ очереди (опционально)' },
        from: { type: 'string', description: 'Дата начала периода ISO 8601' },
        to: { type: 'string', description: 'Дата конца периода ISO 8601' },
      },
    },
  },
  {
    name: 'get_worklogs',
    description: 'Ворклоги сотрудника за период — что конкретно логировал и сколько часов. Автоматически находит оба аккаунта.',
    inputSchema: {
      type: 'object',
      required: ['assignee'],
      properties: {
        assignee: { type: 'string', description: 'Логин или часть имени, например: alexandersv1 или Свистунов' },
        from: { type: 'string', description: 'Дата начала ISO 8601' },
        to: { type: 'string', description: 'Дата конца ISO 8601' },
      },
    },
  },
  {
    name: 'get_team_stats',
    description: 'Сравнительная статистика по всем сотрудникам очереди за период',
    inputSchema: {
      type: 'object',
      required: ['queue'],
      properties: {
        queue: { type: 'string', description: 'Ключ очереди' },
        from: { type: 'string', description: 'Дата начала периода ISO 8601' },
        to: { type: 'string', description: 'Дата конца периода ISO 8601' },
      },
    },
  },
  {
    name: 'get_queue_stats',
    description: 'Сводка по очереди: распределение задач по статусам, среднее время закрытия',
    inputSchema: {
      type: 'object',
      required: ['queue'],
      properties: {
        queue: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
      },
    },
  },
];

// -- Handlers ------------------------------------------------------------------

async function handle(name, args) {
  switch (name) {
    case 'list_queues':
      return api.listQueues();

    case 'list_users':
      return api.listUsers();

    case 'resolve_user':
      return api.resolveUser(args.loginOrName);

    case 'list_issues':
      return api.listIssues(args);

    case 'get_issue':
      return api.getIssue(args.issueKey);

    case 'create_issue':
      return api.createIssue(args);

    case 'update_issue': {
      const { issueKey, ...fields } = args;
      if (fields.assignee) {
        fields.assignee = String(fields.assignee).match(/^\d+$/)
          ? { id: fields.assignee }
          : { login: fields.assignee };
      }
      if (fields.priority) fields.priority = { key: fields.priority };
      return api.updateIssue(issueKey, fields);
    }

    case 'list_transitions':
      return api.listTransitions(args.issueKey);

    case 'move_issue':
      return api.executeTransition(args.issueKey, args.transitionId, args.comment);

    case 'add_worklog':
      return api.addWorklog(args.issueKey, args);

    case 'search_issues':
      return api.searchIssues(args);

    case 'get_worklogs':
      return getWorklogsByUser(args);

    case 'get_employee_stats':
      return getEmployeeStats(args);

    case 'get_team_stats':
      return getTeamStats(args);

    case 'get_queue_stats':
      return getQueueStats(args);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// -- Analytics -----------------------------------------------------------------

async function fetchIssuesByUser(user, from, to, queue) {
  const allIssues = [];
  let page = 1;

  const filter = {};
  if (queue) filter.queue = queue;
  if (from || to) {
    filter.updatedAt = {};
    if (from) filter.updatedAt.from = `${from}T00:00:00`;
    if (to) filter.updatedAt.to = `${to}T23:59:59`;
  }

  while (true) {
    const result = await api.searchIssues({ filter, perPage: 100, page });
    const list = Array.isArray(result) ? result : [];
    if (list.length === 0) break;
    allIssues.push(...list);
    if (list.length < 100) break;
    page++;
  }

  const userIds = new Set(user.allIds);
  return allIssues.filter(i => {
    const a = i.assignee;
    if (!a) return false;
    return userIds.has(a.id) || userIds.has(a.display);
  });
}

async function getEmployeeStats({ assignee, queue, from, to }) {
  const user = await api.resolveUser(assignee);
  const issues = await fetchIssuesByUser(user, from, to, queue);

  const closed = issues.filter(i =>
    i.resolution?.id === 'fixed' || i.statusType?.key === 'done'
  );
  const inProgress = issues.filter(i =>
    i.status?.key === 'inProgress' || i.statusType?.key === 'inProgress'
  );

  const sample = issues.slice(0, 20);
  const worklogResults = await Promise.allSettled(
    sample.map(i => api.getWorklogs(i.id || i.key))
  );

  const userLogins = new Set([user.oldLogin, user.newLogin].filter(Boolean));
  let totalMinutes = 0;
  for (const r of worklogResults) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      for (const w of r.value) {
        if (userLogins.has(w.createdBy?.id) || userLogins.has(w.createdBy?.login)) {
          totalMinutes += parseDuration(w.duration);
        }
      }
    }
  }

  return {
    assignee: user.display,
    accounts: { old: user.oldLogin, new: user.newLogin || '(не найден)' },
    period: { from: from || 'all time', to: to || 'now' },
    queue: queue || 'all',
    total: issues.length,
    closed: closed.length,
    inProgress: inProgress.length,
    timeLoggedHours: +(totalMinutes / 60).toFixed(1),
    note: issues.length > 20 ? `Worklogs sampled from first 20 of ${issues.length} issues` : undefined,
  };
}

async function getWorklogsByUser({ assignee, from, to }) {
  const user = await api.resolveUser(assignee);
  const logins = [user.newLogin, user.oldLogin].filter(Boolean);
  const allWorklogs = [];

  for (const login of logins) {
    try {
      const result = await api.searchWorklogs({ createdBy: login, from, to });
      const list = Array.isArray(result) ? result : (result?.worklogs || []);
      allWorklogs.push(...list);
    } catch (_) {}
  }

  const seen = new Set();
  const worklogs = allWorklogs.filter(w => {
    if (seen.has(w.id)) return false;
    seen.add(w.id);
    return true;
  });

  let totalMinutes = 0;
  const byIssue = {};
  for (const w of worklogs) {
    const key = w.issue?.display || w.issue?.key || w.issue?.id || 'unknown';
    const mins = parseDuration(w.duration);
    totalMinutes += mins;
    if (!byIssue[key]) byIssue[key] = { totalMinutes: 0, entries: [] };
    byIssue[key].totalMinutes += mins;
    byIssue[key].entries.push({
      date: w.start?.slice(0, 10),
      duration: w.duration,
      comment: w.comment,
    });
  }

  return {
    assignee: user.display,
    accounts: { old: user.oldLogin, new: user.newLogin || '(не найден)' },
    period: { from: from || 'all time', to: to || 'now' },
    totalHours: +(totalMinutes / 60).toFixed(1),
    totalEntries: worklogs.length,
    byIssue: Object.entries(byIssue)
      .sort((a, b) => b[1].totalMinutes - a[1].totalMinutes)
      .map(([issue, v]) => ({
        issue,
        hours: +(v.totalMinutes / 60).toFixed(1),
        entries: v.entries,
      })),
  };
}

async function getTeamStats({ queue, from, to }) {
  const filter = { queue };
  if (from || to) {
    filter.updatedAt = {};
    if (from) filter.updatedAt.from = `${from}T00:00:00`;
    if (to) filter.updatedAt.to = `${to}T23:59:59`;
  }

  const issues = await api.searchIssues({ filter, perPage: 200 });
  const list = Array.isArray(issues) ? issues : [];

  const byAssignee = {};
  for (const issue of list) {
    const assignee = issue.assignee;
    if (!assignee) continue;
    const name = assignee.display || assignee.id;
    if (!byAssignee[name]) byAssignee[name] = { total: 0, closed: 0, inProgress: 0 };
    byAssignee[name].total++;
    if (issue.resolution?.id === 'fixed' || issue.statusType?.key === 'done') byAssignee[name].closed++;
    if (issue.status?.key === 'inProgress' || issue.statusType?.key === 'inProgress') byAssignee[name].inProgress++;
  }

  return {
    queue,
    period: { from: from || 'all time', to: to || 'now' },
    totalIssues: list.length,
    team: Object.entries(byAssignee)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([assignee, stats]) => ({ assignee, ...stats })),
  };
}

async function getQueueStats({ queue, from, to }) {
  const filter = { queue };
  if (from || to) {
    filter.updatedAt = {};
    if (from) filter.updatedAt.from = `${from}T00:00:00`;
    if (to) filter.updatedAt.to = `${to}T23:59:59`;
  }

  const issues = await api.searchIssues({ filter, perPage: 200 });
  const list = Array.isArray(issues) ? issues : [];

  const byStatus = {};
  let totalResolutionMs = 0;
  let resolvedCount = 0;

  for (const issue of list) {
    const status = issue.status?.display || issue.status?.key || 'unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;

    if (issue.resolvedAt && issue.createdAt) {
      totalResolutionMs += new Date(issue.resolvedAt) - new Date(issue.createdAt);
      resolvedCount++;
    }
  }

  return {
    queue,
    period: { from: from || 'all time', to: to || 'now' },
    total: list.length,
    byStatus,
    avgResolutionDays: resolvedCount
      ? +((totalResolutionMs / resolvedCount) / 86400000).toFixed(1)
      : null,
  };
}

// -- Utility -------------------------------------------------------------------

function parseDuration(iso) {
  if (!iso) return 0;
  const h = (iso.match(/(\d+)H/) || [])[1] || 0;
  const m = (iso.match(/(\d+)M/) || [])[1] || 0;
  const d = (iso.match(/(\d+)D/) || [])[1] || 0;
  return Number(d) * 480 + Number(h) * 60 + Number(m);
}

// -- MCP Server ----------------------------------------------------------------

const server = new Server(
  { name: 'tracker', version: '1.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await handle(name, args || {});
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return { content: [{ type: 'text', text: err.message }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
