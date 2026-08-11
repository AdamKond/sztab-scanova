"use client";

// Prosty confirm oparty o natywny <dialog> — bez zewnętrznej biblioteki modali.
import { useRef } from "react";

export default function ConfirmDialog({
  children,
  title,
  description,
  confirmLabel = "Potwierdź",
  cancelLabel = "Anuluj",
  action,
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Server action wpięty jako `action` formularza potwierdzenia. */
  action: (formData: FormData) => void | Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-surface px-4 text-[14px] font-medium text-ink hover:bg-canvas"
      >
        {children}
      </button>

      <dialog
        ref={ref}
        className="m-auto w-[min(420px,90vw)] rounded-xl border border-line bg-surface p-0 backdrop:bg-black/40"
        onClose={() => ref.current?.close()}
      >
        <div className="p-5">
          <h2 className="text-[16px] font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-1.5 text-[13px] text-ink-2">{description}</p> : null}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-surface px-4 text-[14px] font-medium text-ink hover:bg-canvas"
            >
              {cancelLabel}
            </button>
            <form
              action={async (formData) => {
                await action(formData);
                ref.current?.close();
              }}
            >
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 text-[14px] font-medium text-white hover:bg-accent-hover"
              >
                {confirmLabel}
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}
