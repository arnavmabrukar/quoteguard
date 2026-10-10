"use client";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock3,
  Minus,
  ShieldCheck,
  X,
} from "lucide-react";
import type { LineStatus } from "@/domain/types";
export function Status({
  status,
  compact = false,
}: {
  status: LineStatus | string;
  compact?: boolean;
}) {
  const good = [
    "Ready for review",
    "Approved",
    "Supporting record present",
    "Reviewed",
    "Passed",
    "Connected",
  ].includes(status);
  const warn = [
    "Needs clarification",
    "Needs attention",
    "Supplier confirmation needed",
    "Awaiting supplier evidence",
    "Missing",
  ].includes(status);
  const bad = ["No catalog match", "Conflicting", "Failed", "Blocked"].includes(
    status,
  );
  const Icon = good
    ? CheckCircle2
    : warn
      ? AlertCircle
      : bad
        ? AlertCircle
        : status === "Excluded"
          ? Minus
          : Clock3;
  return (
    <span
      className={`status ${good ? "good" : warn ? "warn" : bad ? "bad" : "neutral"} ${compact ? "compact" : ""}`}
    >
      <Icon size={12} />
      {status}
    </span>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className={`modal ${wide ? "wide" : ""}`}>
          <div className="modal-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>
                {subtitle || "Review and confirm your changes."}
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Close dialog">
              <X size={19} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <ShieldCheck size={30} />
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <div className="error-message" role="alert">
      <AlertCircle size={16} />
      <span>{message}</span>
    </div>
  ) : null;
}
export function Checked({ children }: { children: React.ReactNode }) {
  return (
    <span className="check-copy">
      <Check size={14} />
      {children}
    </span>
  );
}
