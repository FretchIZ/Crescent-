import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  PawPrint,
  Plane,
  Shirt,
  Sparkles,
  Utensils,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "home-garden": Home,
  gifts: Gift,
  "classes-workshops": GraduationCap,
  "home-services": Briefcase,
  electronics: Laptop,
  "travel-experiences": Plane,
  "food-drink": Utensils,
  "wellness-fitness": HeartPulse,
  fashion: Shirt,
  "books-learning": BookOpen,
  pets: PawPrint,
  sparkles: Sparkles,
  tag: ArrowRight,
};

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon className={className} aria-hidden />;
}
