const BASE = 'https://api.tracker.yandex.net/v2';

export class TrackerApi {
  constructor(token, orgId) {
    this.token = token;
    this.orgId = orgId;
    this._userCache = null;
  }

  headers() {
    return {
      Authorization: `OAuth ${this.token}`,
      'X-Org-ID': this.orgId,
      'Content-Type': 'application/json',
    };
  }

  async request(method, path, body, params) {
    let url = `${BASE}${path}`;
    if (params) {
      const qs = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
      ).toString();
      if (qs) url += `?${qs}`;
    }
    const res = await fetch(url, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Tracker API ${res.status}: ${text}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  listQueues() {
    return this.request('GET', '/queues');
  }

  listUsers(params = {}) {
    return this.request('GET', '/users', null, params);
  }

  getUser(id) {
    return this.request('GET', `/users/${id}`);
  }

  /**
   * Resolve a user by login or name to get both old (archive) and new (active) accounts.
   * Returns { oldLogin, newLogin, newId, display, allIds }
   */
  async resolveUser(loginOrName) {
    const users = await this.listUsers();
    const found = users.find(u =>
      u.login === loginOrName ||
      u.display?.toLowerCase() === loginOrName.toLowerCase() ||
      u.display?.toLowerCase().includes(loginOrName.toLowerCase())
    );

    const displayName = found?.display || loginOrName;
    const oldLogin = found?.login || null;

    let oldId = null;
    if (oldLogin) {
      try {
        const oldUser = await this.getUser(oldLogin);
        oldId = oldUser.uid?.toString() || oldUser.id?.toString() || null;
      } catch (_) {}
    }

    const issues = await this.searchIssues({ filter: {}, perPage: 200 });
    const list = Array.isArray(issues) ? issues : [];

    const candidateIds = new Set();
    for (const i of list) {
      for (const field of ['assignee', 'createdBy', 'updatedBy']) {
        const u = i[field];
        if (u && u.display === displayName && u.id) candidateIds.add(u.id);
      }
      if (Array.isArray(i.followers)) {
        for (const u of i.followers) {
          if (u.display === displayName && u.id) candidateIds.add(u.id);
        }
      }
    }

    let newId = null;
    let newLogin = null;
    for (const id of candidateIds) {
      if (oldId && id === oldId) continue;
      try {
        const u = await this.getUser(id);
        const login = u.login;
        if (!login || login === oldLogin) continue;
        newId = id;
        newLogin = login;
        break;
      } catch (_) {}
    }

    return {
      display: displayName,
      oldLogin,
      newLogin,
      newId,
      allIds: [newId, newLogin, oldLogin].filter(Boolean),
    };
  }

  listIssues(filters = {}) {
    const {
      queue, assignee, status, createdFrom, createdTo,
      updatedFrom, updatedTo, resolution, perPage = 50, page = 1,
    } = filters;
    return this.request('GET', '/issues', null, {
      queue, assignee, status,
      createdAt_from: createdFrom, createdAt_to: createdTo,
      updatedAt_from: updatedFrom, updatedAt_to: updatedTo,
      resolution, perPage, page,
    });
  }

  getIssue(issueKey) {
    return this.request('GET', `/issues/${issueKey}`);
  }

  createIssue({ queue, summary, description, assignee, priority, type, deadline }) {
    return this.request('POST', '/issues', {
      queue: { key: queue },
      summary,
      description,
      assignee: assignee ? (String(assignee).match(/^\d+$/) ? { id: assignee } : { login: assignee }) : undefined,
      priority: priority ? { key: priority } : undefined,
      type: type ? { key: type } : undefined,
      deadline: deadline || undefined,
    });
  }

  updateIssue(issueKey, fields) {
    return this.request('PATCH', `/issues/${issueKey}`, fields);
  }

  listTransitions(issueKey) {
    return this.request('GET', `/issues/${issueKey}/transitions`);
  }

  executeTransition(issueKey, transitionId, comment) {
    return this.request(
      'POST',
      `/issues/${issueKey}/transitions/${transitionId}/_execute`,
      comment ? { comment } : {}
    );
  }

  getWorklogs(issueKey) {
    return this.request('GET', `/issues/${issueKey}/worklog`);
  }

  addWorklog(issueKey, { duration, comment, start }) {
    return this.request('POST', `/issues/${issueKey}/worklog`, {
      duration,
      comment,
      start: start || new Date().toISOString(),
    });
  }

  deleteWorklog(issueKey, worklogId) {
    return this.request('DELETE', `/issues/${issueKey}/worklog/${worklogId}`);
  }

  searchIssues({ text, filter = {}, perPage = 50, page = 1 } = {}) {
    return this.request('POST', '/issues/_search', { text, filter }, { perPage, page });
  }

  searchWorklogs({ createdBy, from, to, perPage = 200, page = 1 } = {}) {
    const body = {};
    if (createdBy || from || to) {
      body.filter = {};
      if (createdBy) body.filter.createdBy = createdBy;
      if (from) body.from = from;
      if (to) body.to = to;
    }
    return this.request('POST', '/worklogs/_search', body, { perPage, page });
  }
}
