"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { SettingsIcon, Shield, FileText, Bell, Save, RotateCcw, Download, Upload } from "lucide-react"

export function Settings() {
  const [wipeMethod, setWipeMethod] = useState("dod-5220")
  const [generateJsonReport, setGenerateJsonReport] = useState(true)
  const [darkMode, setDarkMode] = useState(true)
  const [autoVerify, setAutoVerify] = useState(false)
  const [notifications, setNotifications] = useState(true)
  const [autoBackup, setAutoBackup] = useState(false)
  const [maxRetries, setMaxRetries] = useState("3")
  const [logLevel, setLogLevel] = useState("info")

  const wipeMethodOptions = [
    { id: "dod-5220", name: "DoD 5220.22-M", description: "3-pass overwrite (Default)" },
    { id: "nist-800", name: "NIST 800-88", description: "Single pass for SSDs" },
    { id: "gutmann", name: "Gutmann Method", description: "35-pass overwrite (Most secure)" },
    { id: "random", name: "Random Data", description: "Single pass random data" },
    { id: "zero", name: "Zero Fill", description: "Single pass with zeros" },
  ]

  const handleSaveSettings = () => {
    // In a real app, this would save to backend/local storage
    console.log("Settings saved")
  }

  const handleResetSettings = () => {
    setWipeMethod("dod-5220")
    setGenerateJsonReport(true)
    setDarkMode(true)
    setAutoVerify(false)
    setNotifications(true)
    setAutoBackup(false)
    setMaxRetries("3")
    setLogLevel("info")
  }

  const handleExportSettings = () => {
    const settings = {
      wipeMethod,
      generateJsonReport,
      darkMode,
      autoVerify,
      notifications,
      autoBackup,
      maxRetries,
      logLevel,
    }
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "securewipe-settings.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Configure SecureWipe Pro preferences and security options</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Wipe Configuration */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Wipe Configuration
              </CardTitle>
              <CardDescription>Default settings for secure wipe operations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="wipe-method" className="text-sm font-medium text-card-foreground">
                  Default Wipe Method
                </Label>
                <Select value={wipeMethod} onValueChange={setWipeMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {wipeMethodOptions.map((method) => (
                      <SelectItem key={method.id} value={method.id}>
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{method.name}</span>
                          <span className="text-xs text-muted-foreground">{method.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label htmlFor="max-retries" className="text-sm font-medium text-card-foreground">
                  Maximum Retry Attempts
                </Label>
                <Select value={maxRetries} onValueChange={setMaxRetries}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 retry</SelectItem>
                    <SelectItem value="3">3 retries (Recommended)</SelectItem>
                    <SelectItem value="5">5 retries</SelectItem>
                    <SelectItem value="10">10 retries</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-card-foreground">Auto-verify after wipe</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically verify wipe completion using read-back verification
                  </p>
                </div>
                <Switch checked={autoVerify} onCheckedChange={setAutoVerify} />
              </div>
            </CardContent>
          </Card>

          {/* Report Settings */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Report Settings
              </CardTitle>
              <CardDescription>Configure certificate and report generation options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-card-foreground">Generate JSON reports</Label>
                  <p className="text-xs text-muted-foreground">
                    Create machine-readable JSON reports alongside PDF certificates
                  </p>
                </div>
                <Switch checked={generateJsonReport} onCheckedChange={setGenerateJsonReport} />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-card-foreground">Auto-backup certificates</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically backup certificates to a secure location
                  </p>
                </div>
                <Switch checked={autoBackup} onCheckedChange={setAutoBackup} />
              </div>

              {autoBackup && (
                <div className="space-y-3 pl-4 border-l-2 border-border">
                  <Label htmlFor="backup-path" className="text-sm font-medium text-card-foreground">
                    Backup Location
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="backup-path"
                      placeholder="C:\SecureWipe\Backups"
                      className="flex-1"
                      defaultValue="C:\SecureWipe\Backups"
                    />
                    <Button variant="outline" size="sm" className="bg-transparent">
                      Browse
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Application Settings */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                Application Settings
              </CardTitle>
              <CardDescription>General application preferences and behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-card-foreground">Dark theme</Label>
                  <p className="text-xs text-muted-foreground">Use dark mode interface (recommended)</p>
                </div>
                <Switch checked={darkMode} onCheckedChange={setDarkMode} />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-card-foreground">Desktop notifications</Label>
                  <p className="text-xs text-muted-foreground">Show system notifications for wipe completion</p>
                </div>
                <Switch checked={notifications} onCheckedChange={setNotifications} />
              </div>

              <div className="space-y-3">
                <Label htmlFor="log-level" className="text-sm font-medium text-card-foreground">
                  Logging Level
                </Label>
                <Select value={logLevel} onValueChange={setLogLevel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="error">Error only</SelectItem>
                    <SelectItem value="warn">Warning and above</SelectItem>
                    <SelectItem value="info">Info and above (Recommended)</SelectItem>
                    <SelectItem value="debug">Debug (Verbose)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Settings Summary & Actions */}
        <div className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-card-foreground">Current Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Wipe Method</span>
                  <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
                    {wipeMethodOptions.find((m) => m.id === wipeMethod)?.name.split(" ")[0]}
                  </Badge>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">JSON Reports</span>
                  <Badge
                    variant={generateJsonReport ? "default" : "outline"}
                    className={generateJsonReport ? "bg-secondary text-secondary-foreground" : ""}
                  >
                    {generateJsonReport ? "Enabled" : "Disabled"}
                  </Badge>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Theme</span>
                  <Badge variant="outline">{darkMode ? "Dark" : "Light"}</Badge>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Auto-verify</span>
                  <Badge
                    variant={autoVerify ? "default" : "outline"}
                    className={autoVerify ? "bg-secondary text-secondary-foreground" : ""}
                  >
                    {autoVerify ? "On" : "Off"}
                  </Badge>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Notifications</span>
                  <Badge
                    variant={notifications ? "default" : "outline"}
                    className={notifications ? "bg-secondary text-secondary-foreground" : ""}
                  >
                    {notifications ? "On" : "Off"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-card-foreground">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={handleSaveSettings}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </Button>

              <Button onClick={handleResetSettings} variant="outline" className="w-full bg-transparent">
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset to Defaults
              </Button>

              <Separator />

              <Button onClick={handleExportSettings} variant="outline" className="w-full bg-transparent">
                <Download className="mr-2 h-4 w-4" />
                Export Settings
              </Button>

              <Button variant="outline" className="w-full bg-transparent">
                <Upload className="mr-2 h-4 w-4" />
                Import Settings
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card border-border border-yellow-500/20">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                <Bell className="h-5 w-5 text-yellow-500" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">License</span>
                <Badge className="bg-secondary text-secondary-foreground">Professional</Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Version</span>
                <span className="text-sm font-medium text-card-foreground">v2.1.0</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Updates</span>
                <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                  Available
                </Badge>
              </div>

              <Button variant="outline" size="sm" className="w-full mt-3 bg-transparent">
                Check for Updates
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
