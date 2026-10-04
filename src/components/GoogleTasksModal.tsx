import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  ListTodo,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import {
  fetchTaskLists,
  fetchTasks,
  createTask,
  updateTaskStatus,
  deleteTask,
  GoogleTaskList,
  GoogleTaskItem,
} from '../lib/google-tasks.ts';
import { signInWithGoogleTasks, logOutGoogle } from '../lib/firebase-auth.ts';

interface GoogleTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasksToken: string | null;
  onTokenChange: (token: string | null) => void;
  onSendToChat?: (prompt: string) => void;
}

export const GoogleTasksModal: React.FC<GoogleTasksModalProps> = ({
  isOpen,
  onClose,
  tasksToken,
  onTokenChange,
  onSendToChat,
}) => {
  const [lists, setLists] = useState<GoogleTaskList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [tasks, setTasks] = useState<GoogleTaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New task form state
  const [newTitle, setNewTitle] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newDue, setNewDue] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Confirmation dialog for destructive deletion
  const [taskToDelete, setTaskToDelete] = useState<GoogleTaskItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen && tasksToken) {
      loadTaskLists();
    }
  }, [isOpen, tasksToken]);

  useEffect(() => {
    if (selectedListId && tasksToken) {
      loadTasks(selectedListId);
    }
  }, [selectedListId]);

  const loadTaskLists = async () => {
    if (!tasksToken) return;
    setLoading(true);
    setError(null);
    try {
      const fetchedLists = await fetchTaskLists(tasksToken);
      setLists(fetchedLists);
      if (fetchedLists.length > 0 && !selectedListId) {
        setSelectedListId(fetchedLists[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load task lists');
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async (listId: string) => {
    if (!tasksToken) return;
    setLoading(true);
    setError(null);
    try {
      const items = await fetchTasks(tasksToken, listId);
      setTasks(items);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithGoogleTasks();
      if (result) {
        onTokenChange(result.accessToken);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect Google account');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await logOutGoogle();
    onTokenChange(null);
    setTasks([]);
    setLists([]);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !tasksToken || !selectedListId) return;

    setIsAdding(true);
    setError(null);
    try {
      const created = await createTask(tasksToken, selectedListId, {
        title: newTitle.trim(),
        notes: newNotes.trim() || undefined,
        due: newDue ? new Date(newDue).toISOString() : undefined,
      });
      setTasks((prev) => [created, ...prev]);
      setNewTitle('');
      setNewNotes('');
      setNewDue('');
    } catch (err: any) {
      setError(err.message || 'Failed to create task');
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleTaskStatus = async (task: GoogleTaskItem) => {
    if (!tasksToken || !selectedListId) return;
    const nextStatus = task.status === 'completed' ? 'needsAction' : 'completed';

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
    );

    try {
      await updateTaskStatus(tasksToken, selectedListId, task.id, nextStatus);
    } catch (err: any) {
      // Revert on failure
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
      );
      setError(err.message || 'Failed to update task status');
    }
  };

  // Mandatory confirmation for destructive operation
  const confirmDeleteTask = async () => {
    if (!taskToDelete || !tasksToken || !selectedListId) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteTask(tasksToken, selectedListId, taskToDelete.id);
      setTasks((prev) => prev.filter((t) => t.id !== taskToDelete.id));
      setTaskToDelete(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete task');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAskAIToPlan = () => {
    if (tasks.length === 0) return;
    const pendingTasks = tasks.filter((t) => t.status === 'needsAction');
    const taskSummary = pendingTasks.map((t) => `- ${t.title}${t.notes ? ` (${t.notes})` : ''}`).join('\n');
    const prompt = `Here are my pending Google Tasks:\n${taskSummary}\n\nPlease analyze and prioritize these tasks into an efficient schedule with recommendations for execution.`;
    if (onSendToChat) {
      onSendToChat(prompt);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ListTodo className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Google Tasks Integration
                </h2>
                <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                  Workspace
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Sync, plan, and manage your to-dos directly in hello
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-2 text-xs text-red-700 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!tasksToken ? (
            /* Sign in required state */
            <div className="text-center py-8 space-y-4 max-w-sm mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
                <ListTodo className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Connect Google Tasks
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Authorize hello to view, add, and organize your tasks using the official Google Tasks API with permission.
                </p>
              </div>

              {/* Official Google button style */}
              <button
                type="button"
                onClick={handleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700/80 rounded-xl text-xs font-semibold shadow-xs transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{loading ? 'Connecting...' : 'Sign in with Google'}</span>
              </button>
            </div>
          ) : (
            /* Connected view */
            <>
              {/* Task list picker & Action bar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-500">List:</span>
                  <select
                    value={selectedListId}
                    onChange={(e) => setSelectedListId(e.target.value)}
                    className="text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-700 outline-hidden"
                  >
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => loadTasks(selectedListId)}
                    disabled={loading}
                    className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    title="Refresh tasks"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {tasks.length > 0 && onSendToChat && (
                    <button
                      onClick={handleAskAIToPlan}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-900 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Plan with AI</span>
                    </button>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="text-xs text-zinc-400 hover:text-red-500 dark:hover:text-red-400 py-1 px-2 rounded transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </div>

              {/* Add New Task Form */}
              <form onSubmit={handleCreateTask} className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Add a new task..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:border-blue-500"
                  />
                  <input
                    type="date"
                    value={newDue}
                    onChange={(e) => setNewDue(e.target.value)}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-hidden focus:border-blue-500"
                    title="Due date"
                  />
                  <button
                    type="submit"
                    disabled={isAdding || !newTitle.trim()}
                    className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-xs font-semibold shadow-xs transition-colors shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isAdding ? 'Adding...' : 'Add'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Optional details or notes"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1 text-xs text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-hidden"
                />
              </form>

              {/* Tasks List */}
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {tasks.length === 0 ? (
                  <div className="text-center py-6 text-xs text-zinc-400">
                    No tasks found in this list. Create your first task above!
                  </div>
                ) : (
                  tasks.map((task) => {
                    const isCompleted = task.status === 'completed';
                    return (
                      <div
                        key={task.id}
                        className={`group p-2.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                          isCompleted
                            ? 'bg-zinc-50/50 dark:bg-zinc-900/30 border-zinc-100 dark:border-zinc-800/60 opacity-60'
                            : 'bg-white dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleTaskStatus(task)}
                            className="mt-0.5 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 shrink-0 transition-colors"
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-50 dark:fill-emerald-950" />
                            ) : (
                              <Circle className="w-4 h-4" />
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-xs font-medium leading-snug break-words ${
                                isCompleted
                                  ? 'line-through text-zinc-400 dark:text-zinc-500'
                                  : 'text-zinc-800 dark:text-zinc-200'
                              }`}
                            >
                              {task.title}
                            </p>
                            {task.notes && (
                              <p className="text-[11px] text-zinc-400 mt-0.5 break-words">
                                {task.notes}
                              </p>
                            )}
                            {task.due && (
                              <div className="flex items-center gap-1 text-[10px] text-zinc-400 mt-1">
                                <Calendar className="w-3 h-3" />
                                <span>Due {new Date(task.due).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Destructive delete button triggers confirmation modal */}
                        <button
                          type="button"
                          onClick={() => setTaskToDelete(task)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-all shrink-0"
                          title="Delete task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-950/80 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
          <span className="text-[11px]">Synced with your Google Workspace account</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>

        {/* Destructive Operation Confirmation Dialog (Mandatory) */}
        {taskToDelete && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 max-w-sm w-full space-y-3 shadow-2xl">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>Confirm Task Deletion</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                Are you sure you want to permanently delete the task{' '}
                <strong className="text-zinc-900 dark:text-zinc-100">
                  "{taskToDelete.title}"
                </strong>{' '}
                from your Google Tasks? This action cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTaskToDelete(null)}
                  disabled={isDeleting}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteTask}
                  disabled={isDeleting}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <span>{isDeleting ? 'Deleting...' : 'Delete Task'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
