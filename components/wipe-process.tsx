"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Play,
  Pause,
  Square,
  HardDrive,
  Shield,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Settings,
  FileText,
  TestTube
} from "lucide-react"

type WipeStatus = "idle" | "running" | "paused" | "completed" | "error" | "cancelled"

interface WipeLog {
  message: string;
  timestamp: string;
}

interface DriveInfo {
  device: string;
  description: string;
  size: number;
  busType: string;
  isRemovable: boolean;
  mountpoints: Array<{ path: string; total?: number; free?: number; }>;
  serial?: string;
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function WipeProcess({ onCertificateGenerated }: { onCertificateGenerated?: () => void }) {
  const [wipeStatus, setWipeStatus] = useState<WipeStatus>("idle")
  const [progress, setProgress] = useState(0)
  const [currentStageText, setCurrentStageText] = useState("")
  const [wipeMethod, setWipeMethod] = useState("nist-800")
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [loadingDrives, setLoadingDrives] = useState(true);
  const [selectedDrive, setSelectedDrive] = useState<string | null>(null);
  const [currentWipeId, setCurrentWipeId] = useState<string | null>(null);
  const [wipeLogs, setWipeLogs] = useState<WipeLog[]>([]);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number>(0);
  
  // Track cleanup functions for IPC listeners
  const cleanupFunctions = useRef<Array<() => void>>([]);

  // Test native addon
  const handleTestAddon = async () => {
    try {
      // @ts-ignore
      const result = await window.api.testAddon();
      console.log('Native addon test result:', result);
      alert(`Native Addon Test:\nSuccess: ${result.success}\nResult: ${result.result || result.error}`);
    } catch (error) {
      console.error('Failed to test addon:', error);
      alert(`Native Addon Test Failed: ${error}`);
    }
  };

  const wipeMethods = [
    { id: "nist-800", name: "NIST 800-88 (1 pass)", description: "NIST purge method for SSDs" },
    { id: "dod-5220", name: "DoD 5220.22-M (3 passes)", description: "US Department of Defense standard" },
    { id: "random", name: "Random Data (1 pass)", description: "Fast single pass with random data" },
    { id: "zero", name: "Zero Fill (1 pass)", description: "Simple zero overwrite method" },
  ]

  // Load drives on component mount
  useEffect(() => {
    const loadDrives = async () => {
      try {
        // @ts-ignore
        const result = await window.api.getDrives();
        setDrives(result);
      } catch (error) {
        console.error('Failed to load drives:', error);
      } finally {
        setLoadingDrives(false);
      }
    };

    loadDrives();
  }, []);

  // Set up IPC listeners for wipe events
  useEffect(() => {
    if (typeof window !== 'undefined' && window.api) {
      // @ts-ignore
      const cleanup1 = window.api.onWipeProgress?.((data) => {
        console.log('Wipe progress:', data);
        setProgress(data.progress || 0);
        setCurrentStageText(data.stage || '');
        
        if (data.logs) {
          setWipeLogs(data.logs.map((log: string) => ({
            message: log,
            timestamp: new Date().toLocaleTimeString()
          })));
        }

        // Calculate estimated time remaining (rough estimate)
        if (data.progress > 0) {
          const timeElapsed = Date.now() - (Date.now() - (data.progress * 1000)); // Rough calculation
          const estimatedTotal = (timeElapsed / data.progress) * 100;
          const remaining = Math.max(0, Math.ceil((estimatedTotal - timeElapsed) / (1000 * 60))); // minutes
          setEstimatedTimeRemaining(remaining);
        }
      });

      // @ts-ignore
      const cleanup2 = window.api.onWipeStarted?.((data) => {
        console.log('Wipe started:', data);
        setCurrentWipeId(data.wipeId);
        setWipeStatus('running');
        setProgress(0);
        setWipeLogs([{
          message: `Wipe started for ${data.device} using ${data.method}`,
          timestamp: new Date().toLocaleTimeString()
        }]);
      });

      // @ts-ignore
      const cleanup3 = window.api.onWipeCompleted?.((data) => {
        console.log('Wipe completed:', data);
        setWipeStatus('completed');
        setProgress(100);
        setCurrentStageText('Wipe completed successfully!');
        setEstimatedTimeRemaining(0);
        setWipeLogs(prev => [...prev, {
          message: 'Wipe operation completed successfully',
          timestamp: new Date().toLocaleTimeString()
        }]);
      });

      // @ts-ignore
      const cleanup4 = window.api.onWipeError?.((data) => {
        console.log('Wipe error:', data);
        setWipeStatus('error');
        setCurrentStageText(`Error: ${data.error}`);
        setEstimatedTimeRemaining(0);
        setWipeLogs(prev => [...prev, {
          message: `Error: ${data.error}`,
          timestamp: new Date().toLocaleTimeString()
        }]);
      });

      // @ts-ignore
      const cleanup5 = window.api.onWipeCancelled?.((data) => {
        console.log('Wipe cancelled:', data);
        setWipeStatus('cancelled');
        setCurrentStageText('Wipe operation cancelled');
        setEstimatedTimeRemaining(0);
        setWipeLogs(prev => [...prev, {
          message: 'Wipe operation was cancelled',
          timestamp: new Date().toLocaleTimeString()
        }]);
      });

      // Store cleanup functions
      cleanupFunctions.current = [cleanup1, cleanup2, cleanup3, cleanup4, cleanup5].filter(Boolean);

      return () => {
        // Clean up all listeners on unmount
        cleanupFunctions.current.forEach(cleanup => cleanup?.());
      };
    }
  }, []);

  const handleStartWipe = async () => {
    if (!selectedDrive) {
      alert('Please select a drive to wipe');
      return;
    }

    // Find the selected drive info
    const selectedDriveInfo = drives.find(drive => 
      drive.mountpoints.some(mp => mp.path === selectedDrive)
    );

    if (!selectedDriveInfo) {
      alert('Selected drive information not found');
      return;
    }

    // Confirm the operation
    const confirmMessage = `Are you sure you want to wipe ${selectedDriveInfo.description}?\n\nThis will PERMANENTLY delete all data on the device.\nThis action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setWipeStatus('running');
      setProgress(0);
      setWipeLogs([]);
      
      const wipeParams = {
        device: selectedDriveInfo.device, // Use the actual device path
        method: wipeMethod,
        label: selectedDriveInfo.description,
        deviceInfo: {
          serial: selectedDriveInfo.serial || 'Unknown',
          model: selectedDriveInfo.description,
          type: selectedDriveInfo.busType,
          capacity: formatBytes(selectedDriveInfo.size)
        }
      };

      console.log('Starting wipe with params:', wipeParams);
      
      // @ts-ignore
      const result = await window.api.startWipe(wipeParams);
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error occurred');
      }
      
      console.log('Wipe started successfully:', result);
      
    } catch (error) {
      console.error('Failed to start wipe:', error);
      setWipeStatus('error');
      setCurrentStageText(`Failed to start: ${error}`);
      alert(`Failed to start wipe: ${error}`);
    }
  };

  const handleStopWipe = async () => {
    if (!currentWipeId) return;

    try {
      // @ts-ignore
      const result = await window.api.stopWipe(currentWipeId);
      if (result.success) {
        setWipeStatus('cancelled');
        setCurrentStageText('Wipe operation stopped');
      } else {
        console.error('Failed to stop wipe:', result.error);
      }
    } catch (error) {
      console.error('Failed to stop wipe:', error);
    }
  };

  const handleGenerateCertificate = async () => {
    const driveInfo = drives.find(d => d.mountpoints.some(mp => mp.path === selectedDrive));

    if (!driveInfo) {
      console.error("Selected drive information not found.");
      return;
    }

    const certificateData = {
      deviceInfo: {
        serial: driveInfo.serial || 'Unknown',
        model: driveInfo.description,
        type: driveInfo.busType,
        capacity: formatBytes(driveInfo.size)
      },
      eraseMethod: wipeMethods.find((m) => m.id === wipeMethod)?.name || 'Unknown',
      nistProfile: 'Purge',
      postWipeStatus: 'success',
      logs: wipeLogs.map(log => log.message),
      toolVersion: "2.1.0"
    };
    
    try {
      // @ts-ignore
      const result = await window.api.generateCertificate(certificateData);

      if (result.success) {
        console.log('Certificate generated:', result.certPath);
        onCertificateGenerated?.();
      } else {
        console.error('Failed to generate certificate:', result.error);
        alert('Failed to generate certificate: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to generate certificate:', error);
      alert('Failed to generate certificate: ' + error);
    }
  };

  const getStatusColor = () => {
    switch (wipeStatus) {
      case "idle": return "text-muted-foreground"
      case "running": return "text-primary"
      case "paused": return "text-yellow-500"
      case "completed": return "text-green-600"
      case "error": return "text-destructive"
      case "cancelled": return "text-orange-500"
      default: return "text-muted-foreground"
    }
  }

  const getStatusIcon = () => {
    switch (wipeStatus) {
      case "idle": return <Clock className="h-4 w-4" />
      case "running": return <Settings className="h-4 w-4 animate-spin" />
      case "paused": return <Pause className="h-4 w-4" />
      case "completed": return <CheckCircle2 className="h-4 w-4" />
      case "error": return <AlertTriangle className="h-4 w-4" />
      case "cancelled": return <Square className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const getStatusText = () => {
    switch (wipeStatus) {
      case "idle": return "Ready to start"
      case "running": return currentStageText || "Wipe in progress..."
      case "paused": return "Wipe paused"
      case "completed": return "Wipe completed successfully"
      case "error": return currentStageText || "Error occurred during wipe"
      case "cancelled": return "Wipe operation cancelled"
      default: return "Unknown status"
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Secure Wipe Process</h1>
            <p className="text-muted-foreground text-sm md:text-base">
              Configure and execute secure data wiping operations with industry-standard methods
            </p>
          </div>
          <Button onClick={handleTestAddon} variant="outline" size="sm">
            <TestTube className="mr-2 h-4 w-4" />
            Test Addon
          </Button>
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="grid gap-6 grid-cols-1 xl:grid-cols-3">
        {/* Drive Selection */}
        <div className="xl:col-span-2 space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Drive Selection
              </CardTitle>
              <CardDescription>Choose the storage device to securely wipe</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={selectedDrive || undefined}
                onValueChange={setSelectedDrive}
                disabled={wipeStatus === 'running'}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a drive to wipe" />
                </SelectTrigger>
                <SelectContent>
                  {loadingDrives ? (
                    <div className="p-2">Loading drives...</div>
                  ) : (
                    drives.map((drive) =>
                      drive.mountpoints.map((mp) => (
                        <SelectItem key={drive.device + mp.path} value={mp.path}>
                          <div className="flex items-center gap-2 w-full">
                            <span className="flex-1 truncate">
                              {drive.description || drive.device} [{mp.path}]
                            </span>
                            <Badge variant="outline" className="ml-auto flex-shrink-0">
                              {formatBytes(mp.total || drive.size)} total
                            </Badge>
                            {mp.free !== undefined && (
                              <Badge variant="outline" className="ml-2 flex-shrink-0">
                                {formatBytes(mp.free)} free
                              </Badge>
                            )}
                            <Badge variant="outline" className="ml-2 flex-shrink-0">
                              {drive.busType}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))
                    )
                  )}
                </SelectContent>
              </Select>

              {selectedDrive && (
                <div className="p-4 rounded-lg border border-border bg-card/50">
                  {(() => {
                    const drive = drives.find(d => d.mountpoints.some(mp => mp.path === selectedDrive));
                    return drive ? (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-card-foreground">{drive.description}</p>
                          <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
                            Ready
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div><strong>Device:</strong> {drive.device}</div>
                          <div><strong>Size:</strong> {formatBytes(drive.size)}</div>
                          <div><strong>Type:</strong> {drive.busType}{drive.isRemovable ? ' (Removable)' : ''}</div>
                          <div><strong>Serial:</strong> {drive.serial || 'Unknown'}</div>
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Wipe Method */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Wipe Method
              </CardTitle>
              <CardDescription>Select the security standard for data destruction</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={wipeMethod} onValueChange={setWipeMethod} disabled={wipeStatus === "running"}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {wipeMethods.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{method.name}</span>
                        <span className="text-xs text-muted-foreground">{method.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {wipeMethod && (
                <div className="p-4 rounded-lg border border-border bg-card/50">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium text-card-foreground">
                        {wipeMethods.find((m) => m.id === wipeMethod)?.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {wipeMethods.find((m) => m.id === wipeMethod)?.description}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Progress Section */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Wipe Progress
              </CardTitle>
              <CardDescription>Real-time status and progress of the wipe operation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className={`flex items-center gap-2 ${getStatusColor()}`}>
                  {getStatusIcon()}
                  <span className="font-medium text-sm md:text-base">{getStatusText()}</span>
                </div>
                <Badge
                  variant={wipeStatus === "completed" ? "default" : "secondary"}
                  className={wipeStatus === "completed" ? "bg-green-100 text-green-800" : ""}
                >
                  {wipeStatus.charAt(0).toUpperCase() + wipeStatus.slice(1)}
                </Badge>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium text-card-foreground">{progress}%</span>
                </div>
                <Progress value={progress} className="h-3" />
              </div>

              {/* Estimated Time */}
              {wipeStatus === "running" && estimatedTimeRemaining > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Estimated time remaining</span>
                  <span className="font-medium text-card-foreground">{estimatedTimeRemaining} minutes</span>
                </div>
              )}

              <Separator />

              {/* Control Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleStartWipe}
                  disabled={!selectedDrive || wipeStatus === "running"}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Start Wipe
                </Button>

                {wipeStatus === "running" && (
                  <Button onClick={handleStopWipe} variant="destructive" className="flex-1">
                    <Square className="mr-2 h-4 w-4" />
                    Stop Wipe
                  </Button>
                )}
              </div>

              {/* Logs */}
              {wipeLogs.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Operation Logs:</h4>
                  <div className="max-h-32 overflow-y-auto bg-gray-50 p-2 rounded text-xs font-mono">
                    {wipeLogs.map((log, index) => (
                      <div key={index} className="mb-1">
                        <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Status Panel */}
        <div className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-card-foreground">Operation Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-sm text-muted-foreground">Selected Drive</span>
                  <span className="text-sm font-medium text-card-foreground text-right">
                    {selectedDrive ? 
                      drives.find(d => d.mountpoints.some(mp => mp.path === selectedDrive))?.description || selectedDrive
                      : "None"}
                  </span>
                </div>

                <div className="flex justify-between items-start gap-2">
                  <span className="text-sm text-muted-foreground">Wipe Method</span>
                  <span className="text-sm font-medium text-card-foreground text-right">
                    {wipeMethods.find((m) => m.id === wipeMethod)?.name.split(" ")[0] || "NIST"}
                  </span>
                </div>

                <div className="flex justify-between items-start gap-2">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className={`text-sm font-medium ${getStatusColor()}`}>{getStatusText()}</span>
                </div>

                {currentWipeId && (
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-sm text-muted-foreground">Operation ID</span>
                    <span className="text-sm font-medium text-card-foreground text-right font-mono">
                      {currentWipeId.substring(0, 12)}...
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {wipeStatus === "completed" && (
            <Card className="bg-card border-border border-green-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Wipe Complete
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  The secure wipe operation has been completed successfully. Generate a certificate to document this operation.
                </p>
                <Button
                  onClick={handleGenerateCertificate}
                  className="w-full bg-green-600 text-white hover:bg-green-700"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Certificate
                </Button>
              </CardContent>
            </Card>
          )}

          {wipeStatus === "error" && (
            <Card className="bg-card border-border border-red-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Wipe Error
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  An error occurred during the wipe operation. Check the logs for details and try again.
                </p>
                <Button
                  onClick={() => {
                    setWipeStatus('idle');
                    setProgress(0);
                    setCurrentStageText('');
                    setWipeLogs([]);
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Reset Operation
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}