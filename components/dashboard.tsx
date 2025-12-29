"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { HardDrive, Monitor, Cpu, MemoryStick, Shield, Clock, CheckCircle2, AlertTriangle } from "lucide-react"
import React, { useEffect, useState } from 'react';


// Utility for bytes to GB/MB
type Volume = {
  fs: string;      // e.g. 'C:' or 'D:'
  size: number;    // total bytes
  used: number;    // used bytes
  mount: string;   // mount path, should equal fs
  type: string;    // 'NTFS', 'FAT32', etc.
  label?: string;
};

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
export const VolumesGrid: React.FC = () => {
  const [volumes, setVolumes] = useState<Volume[]>([]);

  useEffect(() => {
    // @ts-ignore
    window.api.getVolumes().then(setVolumes);
  }, []);

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {volumes.map((vol, idx) => (
      <div
        key={idx}
        className="bg-black p-4 rounded-lg flex flex-col gap-2 border-1"
        style={{ borderColor: "#464747ff" }} // Tailwind green-500
      >
        <div className="flex items-center justify-between">
        <div className="font-medium">{vol.label || 'Drive ' + vol.mount}</div>
        <span className="px-2 py-1 rounded text-xs bg-muted">{vol.type}</span>
        </div>
        <div className="font-bold text-lg">{vol.fs}</div>
        <div className="text-xs text-muted-foreground">
        Used: {formatBytes(vol.used)} / {formatBytes(vol.size)}
        </div>
        <div className="w-full bg-muted rounded h-2 overflow-hidden">
        <div
          className="bg-primary h-2"
          style={{ width: `${Math.round((vol.used / vol.size) * 100)}%` }}
        />
        </div>
      </div>
      ))}
    </div>
  );
};



export function Dashboard({ onNavigateToWipe, }: { onNavigateToWipe: () => void }) {
  // Example system info state
  type SystemInfo = {
    cpu: string;
    memory: string;
    os: string;
    storage: { type: string; size: number; name: string }[];
  };

  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  

  useEffect(() => {
    // @ts-ignore
    window.api.getSystemInfo().then(setSysInfo);
  }, []);
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Welcome to DropDrive</h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Professional data wiping solution for secure data destruction and compliance
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-card-foreground">Quick Start</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Add onClick event to the button */}
            <Button 
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={onNavigateToWipe}
            >
              <Shield className="mr-2 h-4 w-4" />
              Start Secure Wipe
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-card-foreground">Last Wipe</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-secondary" />
              <span className="text-sm text-card-foreground">2 hours ago</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">SSD Drive - 512GB</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-card-foreground">Certificates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
                24 Total
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-card-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-secondary"></div>
              <span className="text-sm text-card-foreground">Ready</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">All systems operational</p>
          </CardContent>
        </Card>
      </div>

      {/* System Information */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-card-foreground flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              System Information
            </CardTitle>
            <CardDescription>Current system specifications and status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-card-foreground">Processor</span>
                </div>
                <span className="text-sm font-medium text-card-foreground">
                  {sysInfo?.cpu || "Loading..."}
                </span>
              </div>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <MemoryStick className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-card-foreground">Memory</span>
                </div>
                <span className="text-sm font-medium text-card-foreground">
                  {sysInfo?.memory || "Loading..."}
                </span>
              </div>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-card-foreground">Storage</span>
                </div>
                <span className="text-sm font-medium text-card-foreground">
                  {sysInfo?.storage
                    ? sysInfo.storage.map(d => `${d.name.split(' ')[0]} (${Math.round(d.size / 1024 ** 3)} GB)`).join(', ')
                    : "Loading..."}
                </span>
              </div>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-card-foreground">OS</span>
                </div>
                <span className="text-sm font-medium text-card-foreground">
                  {sysInfo?.os || "Loading..."}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-card-foreground flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest wipe operations and system events</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-secondary mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="text-sm text-card-foreground">Secure wipe completed</p>
                  <p className="text-xs text-muted-foreground">Samsung SSD 970 EVO - 512GB • 2 hours ago</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-secondary mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="text-sm text-card-foreground">Certificate generated</p>
                  <p className="text-xs text-muted-foreground">DOD 5220.22-M standard • 2 hours ago</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="text-sm text-card-foreground">System update available</p>
                  <p className="text-xs text-muted-foreground">SecureWipe Pro v2.1.1 • 1 day ago</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Storage Overview */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-card-foreground flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Connected Storage Devices
          </CardTitle>
          <CardDescription>Available drives for secure wiping operations</CardDescription>
        </CardHeader>
        <CardContent>
          <VolumesGrid />
        </CardContent>
      </Card>
    </div>
  )
}
