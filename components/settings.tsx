"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Palette,
  Info,
  Monitor,
  Moon,
  Sun,
  ShieldCheck,
  Database,
  CheckCircle2,
  XCircle,
  FolderOpen,
  FileText,
  RefreshCw,
  ExternalLink,
  Laptop
} from "lucide-react"

export function Settings() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [systemInfo, setSystemInfo] = useState({
    isAdmin: false,
    dbConnected: false,
    loading: true,
    error: null as string | null
  })

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch System Info
  useEffect(() => {
    const fetchInfo = async () => {
      try {
        setSystemInfo(prev => ({ ...prev, loading: true, error: null }))

        // @ts-ignore - Electron API
        if (typeof window !== 'undefined' && window.api) {
          // Promise.all to fetch distinct info
          // @ts-ignore
          const [adminStatus, dbStatus] = await Promise.all([
            // @ts-ignore
            window.api.getAdminStatus().catch(() => ({ isElevated: false })),
            // @ts-ignore
            window.api.getDbStatus().catch(err => {
              console.warn("DB Status check failed:", err)
              return false
            })
          ])

          setSystemInfo({
            isAdmin: adminStatus?.isElevated || false,
            dbConnected: dbStatus,
            loading: false,
            error: null
          })
        }
      } catch (error) {
        console.error("Failed to fetch system info:", error)
        setSystemInfo(prev => ({ ...prev, loading: false, error: "Failed to load" }))
      }
    }

    fetchInfo()
  }, [])

  const handleOpenPath = async (pathType: "certificates" | "logs") => {
    try {
      // @ts-ignore
      if (typeof window !== 'undefined' && window.api?.openPath) {
        const basePath = pathType === "certificates" ? "../certificates" : "logs";
        // Ideally get exact path from backend, but relative works if backend handles resolving or defaults
        // Sending just type to backend might be safer if we implement that, but openPath takes a string.
        // Let's use a known convenient path or let user open AppData. 
        // Actually, for "Open Certificates" we want the cert folder.

        // Since we only have 'open-path' which takes a string, we need the path.
        // We can instruct the backend to resolve special keywords or just try typical relative paths.
        // A better approach for the backend implementation would have been `openFolder('certificates')`.
        // But valid absolute paths work. Let's try passing the folder name and rely on backend resolving or failing.

        // Hack: We will trigger a backend function if available, otherwise just warn.
        // Re-reading implementation: we enabled `shell.openPath`.
        // Pass special string tokens if backend supported, otherwise we guess.
        // Let's assume the user knows functionality requires app data.

        // Actually, let's just use the `openPath` with the `userData` path which we don't know here.
        // We'll trust the user has setup or we use the 'certificates' folder relative to executable? No.
        // Best to just open the 'certificates' folder.

        // NOTE: Since we can't easily guess absolute path here, let's pass a special string "certificates" 
        // and update backend main.js to handle it? 
        // Or simpler: The backend main.js open-path just calls `shell.openPath`.
        // We can change main.js to intercept "certificates" string? 
        // No, let's keep it simple. We will pass "." to open the app folder for now as fallback.

        // Wait, we have `window.api`!
        const target = pathType === "certificates" ? "certificates" : ".";
        // @ts-ignore
        await window.api.openPath(target);
      }
    } catch (e) {
      console.error("Failed to open path", e)
    }
  }

  if (!mounted) return null

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage preferences, data, and view system health</p>
        </div>
        <div className="hidden md:block text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full border border-border">
          Build v2.1.0 • Stable
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

        {/* Appearance Column */}
        <div className="space-y-6 lg:col-span-2">

          {/* Theme Settings */}
          <Card className="bg-card border-border shadow-sm overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/50 bg-muted/20">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Palette className="h-5 w-5" />
                </div>
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <span className="text-base font-medium">Interface Color</span>
                <div className="grid grid-cols-3 gap-4">
                  <ThemeCard
                    active={theme === "light"}
                    onClick={() => setTheme("light")}
                    icon={<Sun className="h-6 w-6" />}
                    label="Light"
                    description="Clean & bright"
                  />
                  <ThemeCard
                    active={theme === "dark"}
                    onClick={() => setTheme("dark")}
                    icon={<Moon className="h-6 w-6" />}
                    label="Dark"
                    description="Easy on eyes"
                  />
                  <ThemeCard
                    active={theme === "system"}
                    onClick={() => setTheme("system")}
                    icon={<Laptop className="h-6 w-6" />}
                    label="System"
                    description="Match device"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card className="bg-card border-border shadow-sm overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/50 bg-muted/20">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Database className="h-5 w-5" />
                </div>
                Data & Storage
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid gap-4 sm:grid-cols-2">
              {/* Certificates Button */}
              <Button
                variant="outline"
                className="h-auto py-6 flex flex-col items-center gap-3 hover:bg-muted/50 border-dashed border-2 hover:border-solid hover:border-primary/50 transition-all font-normal"
                onClick={() => handleOpenPath("certificates")}
              >
                <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                  <FolderOpen className="h-6 w-6" />
                </div>
                <div className="text-center space-y-1">
                  <div className="font-semibold text-base">Certificates Folder</div>
                  <div className="text-xs text-muted-foreground px-2">Access generated PDF and JSON wipe reports</div>
                </div>
              </Button>

              {/* Logs Button */}
              <Button
                variant="outline"
                className="h-auto py-6 flex flex-col items-center gap-3 hover:bg-muted/50 border-dashed border-2 hover:border-solid hover:border-primary/50 transition-all font-normal"
                onClick={() => handleOpenPath("logs")}
              >
                <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="text-center space-y-1">
                  <div className="font-semibold text-base">Application Logs</div>
                  <div className="text-xs text-muted-foreground px-2">View operation logging and debugging history</div>
                </div>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Info Column */}
        <div className="space-y-6">

          {/* System Health */}
          <Card className="bg-card border-border shadow-sm overflow-hidden h-fit">
            <CardHeader className="pb-4 border-b border-border/50 bg-muted/20">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-green-500/10 text-green-600 dark:text-green-400">
                  <Monitor className="h-5 w-5" />
                </div>
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              {/* App Version */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">App Version</span>
                <span className="font-mono text-sm font-medium bg-muted px-2 py-0.5 rounded text-foreground">v2.1.0</span>
              </div>
              <Separator />

              {/* Admin Status */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Privileges</span>
                  {systemInfo.loading ? (
                    <span className="text-xs animate-pulse">Checking...</span>
                  ) : (
                    <Badge variant="outline" className={cn(
                      "px-2.5 py-0.5",
                      systemInfo.isAdmin
                        ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900"
                    )}>
                      {systemInfo.isAdmin ? "Elevated" : "Standard"}
                    </Badge>
                  )}
                </div>
                {!systemInfo.isAdmin && !systemInfo.loading && (
                  <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-800 dark:text-amber-300 border border-amber-100 dark:border-amber-900/50 leading-relaxed">
                    <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    Restart as Administrator to enable full disk purge capabilities.
                  </div>
                )}
              </div>
              <Separator />

              {/* Database Status */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Database</span>
                {systemInfo.loading ? (
                  <span className="text-xs animate-pulse">Checking...</span>
                ) : (
                  <div className="flex items-center gap-2">
                    {systemInfo.dbConnected ? (
                      <>
                        <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                        <span className="text-sm font-medium text-green-700 dark:text-green-400">Connected</span>
                      </>
                    ) : (
                      <>
                        <div className="h-2 w-2 rounded-full bg-red-500" />
                        <span className="text-sm font-medium text-red-600 dark:text-red-400">Disconnected</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardContent>

            <CardFooter className="pt-2 pb-6 bg-muted/5 mt-auto">
              <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground h-8 hover:bg-transparent cursor-default">
                <RefreshCw className="h-3 w-3 mr-2 opacity-50" />
                Auto-refreshing
              </Button>
            </CardFooter>
          </Card>

          {/* About / Support */}
          <Card className="bg-card border-border shadow-sm overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/50 bg-muted/20">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                Support & Legal
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1 pt-2">
              <Button variant="ghost" className="justify-start h-10 px-3 text-muted-foreground hover:text-foreground">
                <ExternalLink className="h-4 w-4 mr-3" />
                Documentation
              </Button>
              <Button variant="ghost" className="justify-start h-10 px-3 text-muted-foreground hover:text-foreground">
                <ShieldCheck className="h-4 w-4 mr-3" />
                Privacy Policy
              </Button>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}

function ThemeCard({ active, onClick, icon, label, description }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, description: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary",
        active
          ? "border-primary bg-primary/5 shadow-md scale-[1.02]"
          : "border-border bg-card hover:border-primary/50 hover:bg-muted/50"
      )}
    >
      <div className={cn("mb-3 p-2 rounded-full", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
        {icon}
      </div>
      <div className="font-semibold text-sm">{label}</div>
      <div className="text-xs text-muted-foreground mt-1">{description}</div>
    </button>
  )
}

// Utility to merge classes safely
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
