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
  // System info state
  type SystemInfo = {
    cpu: string;
    memory: string;
    os: string;
    storage: { type: string; size: number; name: string }[];
  };

  type Certificate = {
    certificate_id: string;
    timestamp_utc: string;
    device_info: {
      model: string;
      type: string;
      capacity: string;
    };
    erase_method: string;
    post_wipe_status: string;
  };

  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [adminStatus, setAdminStatus] = useState<boolean>(false);
  const [dbStatus, setDbStatus] = useState<boolean>(false);

  useEffect(() => {
    // @ts-ignore
    window.api.getSystemInfo().then(setSysInfo);
    // @ts-ignore
    window.api.getCertificates().then(setCertificates);
    // @ts-ignore
    window.api.getAdminStatus().then(setAdminStatus);
    // @ts-ignore
    window.api.getDbStatus().then(setDbStatus);
  }, []);

  const recentActivity = certificates.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Welcome to DropDrive</h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Professional data wiping solution for secure data destruction and compliance
        </p>
      </div>

      {/* Application Overview */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-card-foreground">What DropDrive Does</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            DropDrive securely erases storage devices using industry-recognized data sanitization methods and generates local verification certificates. All operations are performed offline.
          </p>
        </CardContent>
      </Card>

      {/* Quick Actions & Status */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-card-foreground">Quick Action</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={onNavigateToWipe}
            >
              <Shield className="mr-2 h-4 w-4" />
              Start Secure Wipe
            </Button>
          </CardContent>
        </Card>

        {/* System Readiness - Replaces Status */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-card-foreground">System Readiness</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Admin Privileges:</span>
                <span className={adminStatus ? "text-green-500 font-medium" : "text-yellow-500 font-medium"}>
                  {adminStatus ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Database:</span>
                <span className={dbStatus ? "text-green-500 font-medium" : "text-red-500 font-medium"}>
                  {dbStatus ? "Connected" : "Disconnected"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Offline Mode:</span>
                <span className="text-green-500 font-medium">Enabled</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-card-foreground">Certificates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
                {certificates.length} Total
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Locally stored</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-card-foreground">Application Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <span className="text-sm text-card-foreground">Application Ready</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">DropDrive is ready for wipe operations.</p>
          </CardContent>
        </Card>
      </div>

      {/* System Information & Activity */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-card-foreground flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              System Information
            </CardTitle>
            <CardDescription>Local hardware details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-card-foreground">OS</span>
                </div>
                <span className="text-sm font-medium text-card-foreground">
                  {sysInfo?.os || "Loading..."}
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
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-card-foreground">Processor</span>
                </div>
                {/* Simplified CPU display */}
                <span className="text-sm font-medium text-card-foreground truncate max-w-[200px]" title={sysInfo?.cpu}>
                  {sysInfo?.cpu ? sysInfo.cpu.split(' @')[0] : "Loading..."}
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
            <CardDescription>Latest local operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {recentActivity.length > 0 ? (
                recentActivity.map((cert) => (
                  <div key={cert.certificate_id} className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-secondary mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm text-card-foreground">
                        {cert.post_wipe_status === 'simulated' ? 'Dry-run wipe completed' : 'Secure wipe completed'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {cert.device_info.model} - {cert.device_info.capacity} • {new Date(cert.timestamp_utc).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center p-4 text-muted-foreground text-sm">
                  No recent wipe activity found.
                </div>
              )}
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
          <div className="flex flex-col gap-1">
            <CardDescription>Available drives for secure wiping operations</CardDescription>
            <p className="text-xs text-amber-500 font-medium">
              ⚠️ Only non-system drives should be selected for wipe operations. Do not allow actions directly from the dashboard.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <VolumesGrid />
        </CardContent>
      </Card>
    </div>
  )
}
