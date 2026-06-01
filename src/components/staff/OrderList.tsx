import { useState, useEffect, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface StaffOrder {
  id: string;
  guest_name: string;
  room_number: string;
  service_name: string;
  created_at: string;
}

interface ConfirmTarget {
  orderId: string;
  action: "fulfilled" | "cancelled";
}

interface Props {
  initialOrders: StaffOrder[];
}

function elapsedLabel(created_at: string): string {
  const diffMs = Date.now() - new Date(created_at).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffH = Math.floor(diffMin / 60);
  return `${diffH} h ago`;
}

export default function OrderList({ initialOrders }: Props) {
  const [orders, setOrders] = useState<StaffOrder[]>(initialOrders);
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/staff/orders");
      if (!res.ok) return;
      const data = (await res.json()) as StaffOrder[];
      setOrders(data);
    } catch {
      // silently ignore network errors during polling
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      void fetchOrders();
    }, 10_000);
    return () => {
      clearInterval(id);
    };
  }, [fetchOrders]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("pending-count-update", { detail: orders.length }));
  }, [orders]);

  async function handleConfirm() {
    if (!confirmTarget) return;
    const { orderId, action } = confirmTarget;
    setLoading((prev) => new Set(prev).add(orderId));
    try {
      const res = await fetch(`/api/staff/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action }),
      });
      if (res.ok) {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
      }
    } catch {
      // silently ignore; next poll will sync state
    } finally {
      setLoading((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="mb-2 text-4xl text-green-500">✓</span>
        <p className="text-lg text-gray-600">All clear. All guests are happy!</p>
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {orders.map((order) => {
          const isLoading = loading.has(order.id);
          return (
            <li key={order.id} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{order.guest_name}</p>
                  <p className="text-sm text-gray-500">
                    Room {order.room_number} · {order.service_name}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">{elapsedLabel(order.created_at)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => {
                      setConfirmTarget({ orderId: order.id, action: "fulfilled" });
                    }}
                    disabled={isLoading}
                    className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Fulfill
                  </button>
                  <button
                    onClick={() => {
                      setConfirmTarget({ orderId: order.id, action: "cancelled" });
                    }}
                    disabled={isLoading}
                    className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <AlertDialog
        open={!!confirmTarget}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmTarget?.action === "fulfilled" ? "Fulfill this order?" : "Cancel this order?"}
            </AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleConfirm();
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
