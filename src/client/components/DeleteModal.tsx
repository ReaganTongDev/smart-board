import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

interface DeleteModalProps {
  open: boolean;
  taskTitle: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/**
 * Double-confirm delete modal:
 * First click shows a warning; second click executes the deletion.
 * This prevents accidental deletes.
 */
export function DeleteModal({
  open,
  taskTitle,
  onConfirm,
  onClose,
}: DeleteModalProps) {
  const [stage, setStage] = useState<"warn" | "confirm">("warn");
  const [deleting, setDeleting] = useState(false);

  // Reset stage when the modal is opened/closed
  useEffect(() => {
    if (open) setStage("warn");
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handlePrimary = async () => {
    if (stage === "warn") {
      setStage("confirm");
      return;
    }
    // stage === "confirm"
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
      setStage("warn");
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Delete task"
    >
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-sm shadow-2xl shadow-black/60 animate-slide-up">
        <div className="p-6">
          {/* Icon + content */}
          <div className="flex items-start gap-4 mb-5">
            <div
              className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                stage === "confirm"
                  ? "bg-rose-500/20"
                  : "bg-amber-500/15"
              }`}
            >
              <AlertTriangle
                className={`w-5 h-5 ${
                  stage === "confirm" ? "text-rose-400" : "text-amber-400"
                }`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-100 mb-1">
                {stage === "confirm"
                  ? "Are you absolutely sure?"
                  : "Delete task?"}
              </h3>
              <p className="text-sm text-slate-400 break-words">
                {stage === "confirm" ? (
                  <>
                    This will permanently delete{" "}
                    <span className="font-medium text-slate-300">
                      "{taskTitle}"
                    </span>
                    . This action{" "}
                    <span className="text-rose-400 font-medium">
                      cannot be undone
                    </span>
                    .
                  </>
                ) : (
                  <>
                    You're about to delete{" "}
                    <span className="font-medium text-slate-300">
                      "{taskTitle}"
                    </span>
                    . Consider archiving it instead.
                  </>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition-all text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => void handlePrimary()}
              disabled={deleting}
              className={`flex-1 py-2 font-semibold rounded-xl transition-all text-sm disabled:opacity-50 ${
                stage === "confirm"
                  ? "bg-rose-600 hover:bg-rose-500 text-white"
                  : "bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25"
              }`}
            >
              {deleting
                ? "Deleting…"
                : stage === "confirm"
                ? "Yes, delete permanently"
                : "Delete task"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
