"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getNavBySection, sectionLabels, type NavItem, type NavSection } from "@/lib/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { NavIcon } from "@/components/layout/NavIcon";

function SidebarLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={[
        "group relative flex items-start gap-3 rounded-lg px-3 py-2.5 transition-all duration-200",
        active
          ? "bg-gold-500/15 text-gold-300"
          : "text-stone-400 hover:bg-white/5 hover:text-stone-200",
      ].join(" ")}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-gold-400" />
      )}
      <NavIcon
        name={item.icon}
        className={[
          "mt-0.5 size-4 shrink-0 transition-colors duration-200",
          active ? "text-gold-400" : "text-stone-500 group-hover:text-stone-300",
        ].join(" ")}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {item.step != null && (
            <span
              className={[
                "inline-flex size-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none transition-colors duration-200",
                active
                  ? "bg-gold-400/20 text-gold-300"
                  : "bg-white/8 text-stone-500 group-hover:bg-white/12 group-hover:text-stone-300",
              ].join(" ")}
            >
              {item.step}
            </span>
          )}
          <span className="truncate text-[13px] font-medium">{item.label}</span>
        </div>
        <p
          className={[
            "mt-0.5 truncate text-[11px] leading-tight transition-colors duration-200",
            active ? "text-gold-400/50" : "text-stone-600",
          ].join(" ")}
        >
          {item.description}
        </p>
      </div>
    </Link>
  );
}

function Section({ section, items, pathname, onNav }: { section: NavSection; items: NavItem[]; pathname: string; onNav: () => void }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-stone-600">
        {sectionLabels[section]}
      </div>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.href}>
            <SidebarLink
              item={item}
              active={pathname === item.href || pathname.startsWith(item.href + "/")}
              onClick={onNav}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Sidebar(props: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { role } = useAuth();
  const sections = getNavBySection(role);

  const SidebarContent = (
    <div className="flex h-full flex-col bg-stone-950">
      {/* Brand */}
      <Link
        href="/dashboard"
        className="flex h-14 shrink-0 items-center gap-3 border-b border-white/5 px-5 transition-colors hover:bg-white/5"
      >
        <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 text-[10px] font-bold tracking-wide text-gold-950 shadow-sm shadow-gold-500/25">
          Y
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold text-stone-100">YNM Safety</div>
          <div className="text-[11px] text-stone-500">Manufacturing ERP</div>
        </div>
      </Link>

      {/* Home link */}
      <div className="px-3 pt-3 pb-1">
        <Link
          href="/dashboard"
          onClick={props.onClose}
          className={[
            "relative flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200",
            pathname === "/dashboard"
              ? "bg-gold-500/15 text-gold-300"
              : "text-stone-400 hover:bg-white/5 hover:text-stone-200",
          ].join(" ")}
        >
          {pathname === "/dashboard" && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-gold-400" />
          )}
          <NavIcon
            name="home"
            className={[
              "size-4 shrink-0 transition-colors duration-200",
              pathname === "/dashboard" ? "text-gold-400" : "text-stone-500",
            ].join(" ")}
          />
          <span className="text-[13px] font-medium">Home</span>
        </Link>
      </div>

      {/* Navigation sections */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
        <Section section="setup" items={sections.setup} pathname={pathname} onNav={props.onClose} />
        <Section section="operations" items={sections.operations} pathname={pathname} onNav={props.onClose} />
        <Section section="admin" items={sections.admin} pathname={pathname} onNav={props.onClose} />
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-white/5 px-5 py-3">
        <div className="text-[11px] text-stone-600">YNM Safety Pvt. Ltd.</div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:w-[17rem] lg:flex-col">
        {SidebarContent}
      </aside>

      {/* Mobile overlay */}
      {props.open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-stone-950/50 backdrop-blur-sm"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) props.onClose();
            }}
          />
          <div className="absolute inset-y-0 left-0 w-[17rem] shadow-2xl shadow-black/30">
            {SidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
