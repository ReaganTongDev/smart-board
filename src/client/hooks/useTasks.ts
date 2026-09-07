import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Task, TaskStatus, TaskPriority } from "../types";

/**
 * Fetches all tasks for the current user.
 * KanbanBoard and ArchivePage filter client-side from the same dataset.
 */
export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.tasks.list();
      setTasks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  // ─── Optimistic CRUD helpers ────────────────────────────────────

  const createTask = useCallback(
    async (data: {
      title: string;
      description?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      tags?: string[];
      due_date?: string | null;
    }) => {
      const task = await api.tasks.create(data);
      setTasks((prev) => [task, ...prev]);
      return task;
    },
    []
  );

  const updateTask = useCallback(
    async (
      id: string,
      data: Partial<
        Pick<Task, "title" | "description" | "status" | "priority" | "tags" | "due_date">
      >
    ) => {
      const updated = await api.tasks.update(id, data);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      return updated;
    },
    []
  );

  const deleteTask = useCallback(async (id: string) => {
    await api.tasks.delete(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return {
    tasks,
    loading,
    error,
    refetch: fetchTasks,
    createTask,
    updateTask,
    deleteTask,
  };
}
