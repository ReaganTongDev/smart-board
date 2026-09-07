-- Smartboard D1 Schema — Migration 0002
-- Add due_date column to tasks table

ALTER TABLE tasks ADD COLUMN due_date TEXT;
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(user_id, due_date);
