import { CheckCircle, Clock, Package, Utensils, Waves, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  food: Utensils,
  wellness: Waves,
  facilities: Wifi,
  convenience: Clock,
};

interface ServiceBase {
  id: string;
  name: string;
  description: string | null;
  category: string;
  imageUrl: string | null;
}

interface IncludedProps extends ServiceBase {
  variant: "included";
}

interface AddonProps extends ServiceBase {
  variant: "addon";
  price: number | null;
  orderStatus: "none" | "pending" | "fulfilled" | "cancelled";
  onOrder: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

type ServiceCardProps = IncludedProps | AddonProps;

function ImageSlot({ imageUrl, category, name }: { imageUrl: string | null; category: string; name: string }) {
  if (imageUrl) {
    return <img src={imageUrl} alt={name} className="h-32 w-full object-cover" />;
  }
  const Icon = CATEGORY_ICONS[category] ?? Package;
  return (
    <div className="from-secondary/20 to-primary/20 flex h-32 w-full items-center justify-center bg-gradient-to-br">
      <Icon size={32} className="text-muted-foreground" />
    </div>
  );
}

function IncludedBottomSlot() {
  return (
    <div className="border-border border-t px-3 py-2">
      <span className="text-secondary flex items-center gap-1.5 text-sm font-medium">
        <CheckCircle size={14} />
        Included in your package
      </span>
    </div>
  );
}

function AddonBottomSlot({
  price,
  orderStatus,
  onOrder,
  onCancel,
  isLoading,
}: Pick<AddonProps, "price" | "orderStatus" | "onOrder" | "onCancel" | "isLoading">) {
  return (
    <div className="border-border border-t px-3 py-2">
      {orderStatus === "none" && (
        <div className="flex flex-col gap-1">
          {price !== null && <span className="text-muted-foreground text-xs">{price} PLN</span>}
          <button
            onClick={onOrder}
            disabled={isLoading}
            className={cn(
              "bg-primary text-primary-foreground min-h-[44px] w-full rounded-lg text-sm font-medium",
              "hover:bg-primary/90 transition-shadow disabled:opacity-50",
            )}
          >
            {isLoading ? "Ordering…" : "Order"}
          </button>
        </div>
      )}
      {orderStatus === "pending" && (
        <div className="flex flex-col gap-1">
          <span className="bg-accent/20 text-accent-foreground inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
            ⏳ Awaiting
          </span>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className={cn(
              "bg-muted text-muted-foreground min-h-[44px] w-full rounded-lg text-sm font-medium",
              "hover:bg-muted/80 transition-shadow disabled:opacity-50",
            )}
          >
            {isLoading ? "Cancelling…" : "Cancel"}
          </button>
        </div>
      )}
      {orderStatus === "fulfilled" && (
        <span className="text-chart-4 bg-chart-4/20 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
          ✓ Fulfilled
        </span>
      )}
      {orderStatus === "cancelled" && (
        <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
          Cancelled
        </span>
      )}
    </div>
  );
}

export function ServiceCard(props: ServiceCardProps) {
  return (
    <article className="bg-card border-border flex flex-col overflow-hidden rounded-xl border">
      <ImageSlot imageUrl={props.imageUrl} category={props.category} name={props.name} />
      <div className="flex flex-1 flex-col p-3">
        <h3 className="text-foreground text-sm leading-snug font-medium">{props.name}</h3>
        {props.description && <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{props.description}</p>}
      </div>
      {props.variant === "included" ? (
        <IncludedBottomSlot />
      ) : (
        <AddonBottomSlot
          price={props.price}
          orderStatus={props.orderStatus}
          onOrder={props.onOrder}
          onCancel={props.onCancel}
          isLoading={props.isLoading}
        />
      )}
    </article>
  );
}
