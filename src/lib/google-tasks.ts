export interface GoogleTaskList {
  id: string;
  title: string;
  updated: string;
}

export interface GoogleTaskItem {
  id: string;
  title: string;
  updated: string;
  status: 'needsAction' | 'completed';
  due?: string;
  notes?: string;
  completed?: string;
}

const TASKS_API_BASE = 'https://tasks.googleapis.com/tasks/v1';

export async function fetchTaskLists(accessToken: string): Promise<GoogleTaskList[]> {
  const res = await fetch(`${TASKS_API_BASE}/users/@me/lists`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch task lists (${res.status}): ${errorText}`);
  }
  const data = await res.json();
  return data.items || [];
}

export async function fetchTasks(
  accessToken: string,
  tasklistId: string,
  showCompleted: boolean = true
): Promise<GoogleTaskItem[]> {
  const url = new URL(`${TASKS_API_BASE}/lists/${tasklistId}/tasks`);
  url.searchParams.set('showCompleted', String(showCompleted));
  url.searchParams.set('showHidden', 'true');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch tasks (${res.status}): ${errorText}`);
  }
  const data = await res.json();
  return data.items || [];
}

export async function createTask(
  accessToken: string,
  tasklistId: string,
  task: { title: string; notes?: string; due?: string }
): Promise<GoogleTaskItem> {
  const res = await fetch(`${TASKS_API_BASE}/lists/${tasklistId}/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(task),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to create task (${res.status}): ${errorText}`);
  }
  return res.json();
}

export async function updateTaskStatus(
  accessToken: string,
  tasklistId: string,
  taskId: string,
  status: 'needsAction' | 'completed'
): Promise<GoogleTaskItem> {
  const res = await fetch(`${TASKS_API_BASE}/lists/${tasklistId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status,
      completed: status === 'completed' ? new Date().toISOString() : null,
    }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to update task (${res.status}): ${errorText}`);
  }
  return res.json();
}

export async function deleteTask(
  accessToken: string,
  tasklistId: string,
  taskId: string
): Promise<void> {
  const res = await fetch(`${TASKS_API_BASE}/lists/${tasklistId}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to delete task (${res.status}): ${errorText}`);
  }
}
