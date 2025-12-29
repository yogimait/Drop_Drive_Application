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

  return (
    <>
      {isMobileOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onMobileToggle} />}

      <Sidebar
        className={cn(
          "border-r border-sidebar-border bg-sidebar transition-transform duration-300 ease-in-out",
          "fixed left-0 top-0 z-50 h-full w-64 lg:relative lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
        collapsible="icon"
      >
        <SidebarHeader className="border-b border-sidebar-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
                <Trash2 className="h-4 w-4 text-sidebar-primary-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-sidebar-foreground">DropDrive</span>
                <span className="text-xs text-muted-foreground">v2.1.0</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="lg:hidden" onClick={onMobileToggle}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SidebarHeader>

        <SidebarContent className="p-2">
          <SidebarMenu>
            {navigationItems.map((item) => (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  onClick={() => handleNavigation(item.id)}
                  className={cn(
                    "w-full justify-start gap-3 px-3 py-2.5 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    activeItem === item.id &&
                      "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
    </>
  )
}
