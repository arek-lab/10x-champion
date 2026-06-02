import { Clock, Package, Utensils, Waves, Wifi } from "lucide-react";

const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  food: Utensils,
  wellness: Waves,
  facilities: Wifi,
  convenience: Clock,
};

interface Props {
  imageUrl: string | null;
  category: string;
  name: string;
}

export default function ServiceImage({ imageUrl, category, name }: Props) {
  if (imageUrl) {
    return <img src={imageUrl} alt={name} className="h-12 w-12 shrink-0 rounded-lg object-cover" />;
  }

  const Icon = CATEGORY_ICONS[category] ?? Package;
  return (
    <div className="bg-muted flex h-12 w-12 shrink-0 items-center justify-center rounded-lg">
      <Icon size={24} className="text-muted-foreground" />
    </div>
  );
}
