"use client"

import { useState } from "react"
import { Menu } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { Dashboard } from "@/components/dashboard"
import { WipeProcess } from "@/components/wipe-process"
import { Certificates } from "@/components/certificates"
import { Settings } from "@/components/settings"
import { Help } from "@/components/help"
import { SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"

export default function HomePage() {
  const [activeItem, setActiveItem] = useState("dashboard")
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  const renderContent = () => {
    switch (activeItem) {
      case "dashboard":
        return <Dashboard onNavigateToWipe={() => setActiveItem("wipe")} />
      case "wipe":
        return <WipeProcess onCertificateGenerated={() => setActiveItem("certificates")} />;
      case "certificates":
        return <Certificates />
      case "settings":
        return <Settings />
      case "help":
        return <Help />
      default:
        return <Dashboard onNavigateToWipe={() => setActiveItem("wipe")} />
    }
  }

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen)
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar
          activeItem={activeItem}
          onNavigate={setActiveItem}
          isMobileOpen={isMobileSidebarOpen}
          onMobileToggle={toggleMobileSidebar}
        />

        <main className="flex-1 overflow-auto lg:ml-0">
          <div className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 lg:hidden">
            <Button variant="ghost" size="sm" onClick={toggleMobileSidebar} className="shrink-0">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle sidebar</span>
            </Button>
            <h1 className="text-lg font-semibold">SecureWipe Pro</h1>
          </div>

          <div className="p-4 lg:p-6">{renderContent()}</div>
        </main>
      </div>
    </SidebarProvider>
  )
}
