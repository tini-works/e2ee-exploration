"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  Fragment,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { matrixReact } from "matrix-client/react";
import { isClinicUser } from "@/lib/config";
import { SignIn } from "@/features/auth/sign-in";
import { SystemStatus } from "./system-status";
import { AccountControl } from "./account-control";
import { RecoveryKeyProvider } from "./recovery-key-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { FullPageLoader } from "@/components/ui/full-page-loader";
import { Separator } from "@/components/ui/separator";
import {
  UsersIcon,
  UserRoundIcon,
  Building2Icon,
  BuildingIcon,
  ChevronRightIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const NAV = [
  { href: "/", label: "Account", icon: UserRoundIcon },
  { href: "/patients", label: "Patients", icon: UsersIcon, role: "clinic" },
  { href: "/clinics", label: "Clinics", icon: Building2Icon, role: "patient" },
  { href: "/directory", label: "Directory", icon: BuildingIcon },
] as const;

type Crumb = { label: string; href?: string };

function truncateId(id: string): string {
  return id.length > 24 ? `${id.slice(0, 24)}…` : id;
}

function buildCrumbs(pathname: string, pageLabel: string | null): Crumb[] {
  if (pathname === "/") return [{ label: "Account" }];
  if (pathname.startsWith("/patients/")) {
    const id = decodeURIComponent(pathname.slice("/patients/".length));
    return [
      { label: "Patients", href: "/patients" },
      { label: pageLabel ?? truncateId(id) },
    ];
  }
  if (pathname.startsWith("/patients")) return [{ label: "Patients" }];
  if (pathname.startsWith("/clinics/")) {
    const id = decodeURIComponent(pathname.slice("/clinics/".length));
    return [
      { label: "Clinics", href: "/clinics" },
      { label: pageLabel ?? truncateId(id) },
    ];
  }
  if (pathname.startsWith("/clinics")) return [{ label: "Clinics" }];
  if (pathname.startsWith("/directory")) return [{ label: "Directory" }];
  return [{ label: "Patient Records" }];
}

const PageLabelContext = createContext<((label: string | null) => void) | null>(
  null,
);

/**
 * Lets a page feed the trailing breadcrumb label (e.g. a patient's name) into
 * the top bar. Clears it on unmount.
 */
export function usePageLabel(label: string | null) {
  const setLabel = useContext(PageLabelContext);
  useEffect(() => {
    setLabel?.(label);
    return () => setLabel?.(null);
  }, [setLabel, label]);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status, session, error, pendingBackup } = matrixReact.useMatrix();
  const pathname = usePathname();
  const [pageLabel, setPageLabel] = useState<string | null>(null);

  useEffect(() => {
    if (pendingBackup <= 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [pendingBackup]);

  if (status === "initializing") {
    return <FullPageLoader />;
  }

  if (status === "connecting") {
    return <FullPageLoader label="Connecting to Matrix…" />;
  }

  if (status === "error") {
    return (
      <div className="flex min-h-svh flex-1 flex-col items-center justify-center gap-4 p-8">
        <div className="text-destructive font-medium">
          Couldn&apos;t connect to Matrix
        </div>
        <div className="text-sm text-muted-foreground max-w-md text-center break-words">
          {error ?? "Unknown error."}
        </div>
        <SignIn />
      </div>
    );
  }

  if (!session || status !== "ready") {
    return <SignIn />;
  }

  const isClinic = isClinicUser(session.userId);
  const navItems = NAV.filter(
    (item) =>
      !("role" in item) ||
      (item.role === "clinic" ? isClinic : !isClinic),
  );

  const crumbs = buildCrumbs(pathname, pageLabel);

  return (
    <RecoveryKeyProvider>
    <PageLabelContext.Provider value={setPageLabel}>
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <AccountControl />
        </SidebarHeader>
        <Separator className="bg-sidebar-border" />
        <SidebarContent>
          <div>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarMenu>
              {navItems.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.label}
                      render={
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </div>
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 supports-backdrop-filter:backdrop-blur-md">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-1 !h-5" />
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-1.5 text-sm"
          >
            {crumbs.map((crumb, i) => {
              const isLast = i === crumbs.length - 1;
              return (
                <Fragment key={`${crumb.label}-${i}`}>
                  {i > 0 && (
                    <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground/50" />
                  )}
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="font-heading font-semibold text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="font-heading max-w-[48ch] truncate font-semibold">
                      {crumb.label}
                    </span>
                  )}
                </Fragment>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <SystemStatus />
            <ThemeToggle />
          </div>
        </header>
        <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
    </PageLabelContext.Provider>
    </RecoveryKeyProvider>
  );
}
