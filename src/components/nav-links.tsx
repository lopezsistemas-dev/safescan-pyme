"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, FileStack, LayoutDashboard, SlidersHorizontal } from "lucide-react";

const LINKS = [
  { href: "/agente", label: "Agente", Icon: Bot },
  { href: "/safedocs", label: "SafeDocs", Icon: FileStack },
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/politicas", label: "Políticas", Icon: SlidersHorizontal },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {LINKS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-brand-50 text-brand-700"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
