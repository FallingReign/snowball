import * as React from "react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"

// ---------------------------------------------------------------------------
// AppShell props
// ---------------------------------------------------------------------------

export interface AppShellProps {
  /** Content rendered at the top of the sidebar panel (logo, project picker). */
  sidebarHeader?: React.ReactNode
  /** Scrollable navigation area inside the sidebar (file-tree, nav links, etc.). */
  sidebar?: React.ReactNode
  /** Content rendered at the bottom of the sidebar panel (user menu, settings). */
  sidebarFooter?: React.ReactNode
  /**
   * Top chrome of the main inset — perspective switcher, breadcrumb, or
   * action toolbar. Rendered above `children`.
   */
  toolbar?: React.ReactNode
  /** The active perspective area (kanban, editor, docs, …). */
  children?: React.ReactNode
  /** Optional footer strip at the very bottom of the main inset. */
  statusBar?: React.ReactNode
  /** Override the initial sidebar open state. Default: true (expanded). */
  defaultSidebarOpen?: boolean
  /** Additional className applied to the outermost wrapper div. */
  className?: string
}

// ---------------------------------------------------------------------------
// AppShell
// ---------------------------------------------------------------------------

/**
 * Top-level layout shell for Cascade (and future clients). All inner regions
 * are passed as slots; this component ships only structure.
 */
export function AppShell({
  sidebarHeader,
  sidebar,
  sidebarFooter,
  toolbar,
  children,
  statusBar,
  defaultSidebarOpen = true,
  className,
}: AppShellProps) {
  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen}>
      <div
        className={cn(
          "flex h-screen w-screen overflow-hidden bg-background text-foreground",
          className
        )}
      >
        {/* ── Left sidebar ─────────────────────────────────────────── */}
        <Sidebar collapsible="icon" className="border-r border-sidebar-border">
          {sidebarHeader && (
            <SidebarHeader className="px-3 py-2">{sidebarHeader}</SidebarHeader>
          )}

          <SidebarContent className="overflow-y-auto py-2">
            {sidebar}
          </SidebarContent>

          {sidebarFooter && (
            <SidebarFooter className="px-3 py-2">{sidebarFooter}</SidebarFooter>
          )}

          {/* Resize rail — click to collapse / expand */}
          <SidebarRail />
        </Sidebar>

        {/* ── Main inset ───────────────────────────────────────────── */}
        <SidebarInset className="flex flex-col overflow-hidden">
          {/* Toolbar / perspective-switcher chrome */}
          <AppShellToolbar>{toolbar}</AppShellToolbar>

          {/* Scrollable main content */}
          <main className="flex-1 overflow-auto bg-background">
            {children}
          </main>

          {/* Status bar */}
          {statusBar && (
            <>
              <Separator />
              <AppShellStatusBar>{statusBar}</AppShellStatusBar>
            </>
          )}
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}

// ---------------------------------------------------------------------------
// AppShellToolbar
// ---------------------------------------------------------------------------

/**
 * Sticky toolbar at the top of the main inset. Renders the sidebar toggle
 * on the left, then the consumer-provided toolbar content on the right.
 *
 * Consumers rarely use this directly — it is composed inside `AppShell`.
 */
export interface AppShellToolbarProps {
  children?: React.ReactNode
  className?: string
}

export function AppShellToolbar({ children, className }: AppShellToolbarProps) {
  return (
    <header
      className={cn(
        "flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3",
        className
      )}
    >
      {/* Sidebar toggle — wired to SidebarProvider via SidebarTrigger */}
      <SidebarTrigger
        className="size-7 rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        aria-label="Toggle sidebar"
      />
      <Separator orientation="vertical" className="h-5 mx-1" />
      {/* Consumer perspective-switcher / breadcrumb / actions */}
      <div className="flex flex-1 items-center gap-2 overflow-hidden">
        {children}
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------
// AppShellStatusBar
// ---------------------------------------------------------------------------

/**
 * Slim footer strip below the main content area. Ideal for showing
 * git branch, task counts, connection status, keyboard shortcuts, etc.
 *
 * Consumers rarely use this directly — it is composed inside `AppShell`.
 */
export interface AppShellStatusBarProps {
  children?: React.ReactNode
  className?: string
}

export function AppShellStatusBar({
  children,
  className,
}: AppShellStatusBarProps) {
  return (
    <footer
      className={cn(
        "flex h-6 shrink-0 items-center gap-3 bg-muted px-3 text-xs text-muted-foreground",
        className
      )}
    >
      {children}
    </footer>
  )
}

// ---------------------------------------------------------------------------
// AppShellPlaceholder  (preview / dev helper)
// ---------------------------------------------------------------------------

/**
 * Dashed placeholder box used during development and in the registry preview.
 * Drop it into any AppShell slot to visualise the region without building
 * the real content yet.
 */
export interface AppShellPlaceholderProps {
  label: string
  className?: string
}

export function AppShellPlaceholder({
  label,
  className,
}: AppShellPlaceholderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md border border-dashed border-border",
        "text-xs text-muted-foreground select-none",
        className
      )}
    >
      {label}
    </div>
  )
}
