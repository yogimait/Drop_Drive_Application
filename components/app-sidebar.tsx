"use client"

import { useState } from "react"
import { LayoutDashboard, Trash2, FileText, Settings, HelpCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"


interface AppSidebarProps {
  activeItem?: string
  onNavigate?: (itemId: string) => void
  isMobileOpen?: boolean
  onMobileToggle?: () => void
}

export function AppSidebar({
  activeItem = "dashboard",
  onNavigate,
  isMobileOpen = false,
  onMobileToggle,
}: AppSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const handleNavigation = (itemId: string) => {
    if (onNavigate) {
      onNavigate(itemId)
    }
    if (onMobileToggle && isMobileOpen) {
      onMobileToggle()
    }
  }

  // Navigation Items with updated order and icons
  const navigationItems = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      href: "/",
      id: "dashboard",
    },
    {
      title: "Wipe Process",
      icon: Trash2,
      href: "/wipe",
      id: "wipe",
    },
    {
      title: "Certificates",
      icon: FileText,
      href: "/certificates",
      id: "certificates",
    },
    // Separator logic will be handled in rendering
    {
      title: "Settings",
      icon: Settings,
      href: "/settings",
      id: "settings",
    },
    {
      title: "Help",
      icon: HelpCircle,
      href: "/help",
      id: "help",
    },
  ]

  return (
    <>
      {isMobileOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onMobileToggle} />}

      <Sidebar
        className={cn(
          "border-r border-sidebar-border bg-sidebar transition-transform duration-300 ease-in-out",
          "fixed left-0 top-0 z-50 h-full w-64 lg:relative lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <SidebarHeader className="border-b border-sidebar-border px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary shadow-sm hover:scale-105 transition-transform duration-200">
                <Trash2 className="h-5 w-5 text-sidebar-primary-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold text-sidebar-foreground tracking-tight">DropDrive</span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  v2.1.0 · Offline
                </span>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="lg:hidden" onClick={onMobileToggle}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SidebarHeader>

        <SidebarContent className="p-3">
          <SidebarMenu>
            {navigationItems.map((item, index) => (
              <div key={item.id}>
                {/* Optional Divider Logic: Add divider before Settings (index 3) */}
                {index === 3 && <div className="my-2 h-px bg-sidebar-border/50 mx-2" />}

                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => handleNavigation(item.id)}
                    className={cn(
                      "w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative",
                      // Base styles for all items
                      "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                      // Active state styling
                      activeItem === item.id && [
                        "bg-sidebar-accent text-sidebar-accent-foreground",
                        "font-semibold",
                        // Left accent bar
                        "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-2/3 before:w-1 before:rounded-r-full before:bg-primary"
                      ]
                    )}
                    aria-current={activeItem === item.id ? "page" : undefined}
                  >
                    <item.icon className={cn(
                      "h-4 w-4 transition-colors",
                      activeItem === item.id ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-foreground"
                    )} />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </div>
            ))}
          </SidebarMenu>
        </SidebarContent>

        {/* Footer Area */}
        <div className="mt-auto border-t border-sidebar-border p-4">
          <div className="flex flex-col gap-1 text-center">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest opacity-70">
              Local · Offline · Destructive
            </p>
          </div>
        </div>
      </Sidebar>
    </>
  )
}
