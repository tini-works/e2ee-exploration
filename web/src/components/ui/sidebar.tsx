"use client";

import * as React from "react";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { PanelLeftIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_ICON = "3.25rem";
const STORAGE_KEY = "sidebar:state";

type SidebarContextValue = {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within a SidebarProvider.");
  return ctx;
}

export function SidebarProvider({
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = React.useState(false);
  const [open, _setOpen] = React.useState(true);

  React.useEffect(() => {
    const hydrate = () => {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved != null) _setOpen(saved === "true");
    };
    hydrate();
  }, []);

  const setOpen = React.useCallback((value: boolean) => {
    _setOpen(value);
    window.localStorage.setItem(STORAGE_KEY, String(value));
  }, []);

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile((v) => !v);
    } else {
      _setOpen((v) => {
        window.localStorage.setItem(STORAGE_KEY, String(!v));
        return !v;
      });
    }
  }, [isMobile]);

  // Close the mobile drawer whenever we leave the mobile breakpoint.
  React.useEffect(() => {
    const sync = () => {
      if (!isMobile) setOpenMobile(false);
    };
    sync();
  }, [isMobile]);

  const value = React.useMemo<SidebarContextValue>(
    () => ({
      state: open ? "expanded" : "collapsed",
      open,
      setOpen,
      openMobile,
      setOpenMobile,
      isMobile,
      toggleSidebar,
    }),
    [open, setOpen, openMobile, isMobile, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={value}>
      <div
        data-slot="sidebar-wrapper"
        style={
          {
            "--sidebar-width": SIDEBAR_WIDTH,
            "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
            ...style,
          } as React.CSSProperties
        }
        className={cn("flex min-h-svh w-full", className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export function Sidebar({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

  if (isMobile) {
    return (
      <>
        <div
          data-state={openMobile ? "open" : "closed"}
          onClick={() => setOpenMobile(false)}
          className={cn(
            "fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 supports-backdrop-filter:backdrop-blur-xs md:hidden",
            openMobile ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        />
        <div
          data-slot="sidebar"
          data-mobile="true"
          data-state="expanded"
          className={cn(
            "group fixed inset-y-0 left-0 z-50 flex w-(--sidebar-width) flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg transition-transform duration-200 ease-in-out md:hidden",
            openMobile ? "translate-x-0" : "-translate-x-full",
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </>
    );
  }

  return (
    <div
      className="group peer hidden text-sidebar-foreground md:block"
      data-slot="sidebar"
      data-state={state}
    >
      {/* Spacer that reserves layout width in the flow. */}
      <div
        className={cn(
          "relative h-svh bg-transparent transition-[width] duration-200 ease-in-out",
          state === "collapsed"
            ? "w-(--sidebar-width-icon)"
            : "w-(--sidebar-width)",
        )}
      />
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-10 hidden h-svh transition-[width] duration-200 ease-in-out md:flex",
          state === "collapsed"
            ? "w-(--sidebar-width-icon)"
            : "w-(--sidebar-width)",
        )}
      >
        <div
          data-sidebar="sidebar"
          className={cn(
            "flex h-full w-full flex-col border-r border-sidebar-border bg-sidebar",
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function SidebarInset({
  className,
  ...props
}: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn("relative flex min-h-svh min-w-0 flex-1 flex-col", className)}
      {...props}
    />
  );
}

export function SidebarHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  );
}

export function SidebarContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto p-2 group-data-[state=collapsed]:overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  );
}

export function SidebarGroupLabel({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-label"
      className={cn(
        "flex h-7 shrink-0 items-center px-2 text-xs font-medium text-sidebar-foreground/60 transition-[margin,opacity] duration-200 group-data-[state=collapsed]:-mt-8 group-data-[state=collapsed]:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      className={cn("flex w-full min-w-0 flex-col gap-1", className)}
      {...props}
    />
  );
}

export function SidebarMenuItem({
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      className={cn("relative", className)}
      {...props}
    />
  );
}

export function SidebarMenuButton({
  isActive = false,
  tooltip,
  className,
  render,
  ...props
}: useRender.ComponentProps<"button"> & {
  isActive?: boolean;
  tooltip?: string;
}) {
  const { state, isMobile } = useSidebar();

  const element = useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cn(
          "peer/menu-button flex h-9 w-full items-center gap-2 overflow-hidden rounded-md px-2 text-left text-sm outline-none ring-sidebar-ring transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:px-0 [&>svg]:size-4 [&>svg]:shrink-0 [&>span]:truncate group-data-[state=collapsed]:[&>span]:hidden",
          isActive &&
            "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
          className,
        ),
      },
      props,
    ),
    render,
  });

  if (!tooltip || state !== "collapsed" || isMobile) return element;

  return (
    <Tooltip>
      <TooltipTrigger render={element} />
      <TooltipContent side="right">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function SidebarTrigger({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar();
  return (
    <Button
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon-sm"
      className={cn(className)}
      onClick={(e) => {
        props.onClick?.(e);
        toggleSidebar();
      }}
      {...props}
    >
      <PanelLeftIcon />
      <span className="sr-only">Toggle sidebar</span>
    </Button>
  );
}
