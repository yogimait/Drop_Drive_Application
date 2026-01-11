"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Download,
  Search,
  HardDrive,
  Shield,
  Eye,
  CheckCircle,
  Award,
  Copy,
  FileJson,
  File
} from "lucide-react"

interface FormattedCertificate {
  id: string
  date: string
  deviceName: string
  deviceType: string
  capacity: string
  wipeMethod: string
  standard: string
  duration: string
  status: "completed" | "verified" | "archived" | "failed" | "simulated"
  serialNumber: string
  jsonPath?: string
  pdfPath?: string
  original: any
}

export function Certificates() {
  const [certificates, setCertificates] = useState<FormattedCertificate[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [selectedCertificate, setSelectedCertificate] = useState<FormattedCertificate | null>(null)
  const [showCertificate, setShowCertificate] = useState(false)

  useEffect(() => {
    setIsLoading(true);
    // @ts-ignore
    if (typeof window !== 'undefined' && window.api && window.api.getCertificates) {
      // @ts-ignore
      window.api.getCertificates().then((certs) => {
        const formattedCerts = certs.map((c: any) => ({
          id: c.certificate_id,
          date: c.timestamp_utc,
          deviceName: c.device_info.model || "Unknown Device",
          deviceType: c.device_info.type || "Unknown",
          capacity: c.device_info.capacity || "N/A",
          wipeMethod: c.erase_method || "N/A",
          standard: c.nist_profile || "N/A",
          duration: "N/A",
          status: c.post_wipe_status === 'success' ? 'verified' : (c.simulated ? 'simulated' : 'failed'),
          serialNumber: c.device_info.serial_number || "N/A",
          jsonPath: c.file_paths?.json || "",
          pdfPath: c.file_paths?.pdf || "",
          original: c
        }));
        setCertificates(formattedCerts);
        setIsLoading(false);
      }).catch((err: any) => {
        console.error("Failed to load certificates:", err);
        setIsLoading(false);
      });
    } else {
      // Fallback for dev/browser without Electron
      setIsLoading(false);
    }
  }, []);

  const filteredCertificates = certificates.filter((cert) => {
    const matchesSearch =
      cert.deviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.id.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || cert.status === statusFilter
    const matchesType = typeFilter === "all" || cert.deviceType.toLowerCase() === typeFilter.toLowerCase()

    return matchesSearch && matchesStatus && matchesType
  })

  const viewCertificate = (cert: FormattedCertificate) => {
    setSelectedCertificate(cert)
    setShowCertificate(true)
  }

  const downloadCertificate = async (cert: FormattedCertificate) => {
    if (!cert) return;
    try {
      // @ts-ignore
      const result = await window.api.downloadCertificatePdf(cert.id);
      if (result.success) {
        const blob = new Blob([result.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `certificate_${cert.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        console.error("Failed to download certificate:", result.error);
        alert(`Error: Could not download PDF. ${result.error}`);
      }
    } catch (e) {
      console.error("Download failed", e);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header and key stats */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 border-b pb-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Certificates</h1>
          <p className="text-sm text-muted-foreground">Local registry of secure wipe certificates.</p>
        </div>
        <div className="flex gap-6 text-sm">
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground text-xs uppercase tracking-wider">Total</span>
            <span className="font-mono font-medium">{certificates.length}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground text-xs uppercase tracking-wider">Verified</span>
            <span className="font-mono font-medium text-green-500">
              {certificates.filter((c) => c.status === "verified").length}
            </span>
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search ID or device..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 bg-background/50 border-input"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-full sm:w-[140px] bg-background/50 border-input">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="simulated">Simulated</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-full sm:w-[140px] bg-background/50 border-input">
              <SelectValue placeholder="Device Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="ssd">SSD</SelectItem>
              <SelectItem value="hdd">HDD</SelectItem>
              <SelectItem value="usb">USB</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b-border">
              <TableHead className="w-[120px]">ID</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Status</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Loading certificates...
                </TableCell>
              </TableRow>
            ) : filteredCertificates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <div className="p-3 rounded-full bg-muted/30 mb-3">
                      <Shield className="h-6 w-6 opacity-50" />
                    </div>
                    <p className="font-medium">No certificates found</p>
                    <p className="text-xs max-w-xs mt-1">
                      Certificates are automatically generated and stored locally after a successful wipe.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredCertificates.map((cert) => (
                <TableRow key={cert.id} className="hover:bg-muted/50 border-b-border last:border-0">
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help underline decoration-dotted underline-offset-2">{cert.id.substring(0, 8)}...</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{cert.id}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="bg-muted p-1 rounded-sm">
                        <HardDrive className="h-3.5 w-3.5 text-foreground" />
                      </div>
                      <div>
                        <div className="font-medium text-sm flex items-center gap-1.5">
                          {cert.deviceName}
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground border border-border px-1 rounded bg-muted/20">Local</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{cert.capacity} • {cert.deviceType}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {cert.wipeMethod}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(cert.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary" className={`
                            font-normal text-xs px-2 py-0.5
                            ${cert.status === 'verified' ? 'text-green-600 bg-green-500/10 border-green-500/20' : ''}
                            ${cert.status === 'simulated' ? 'text-amber-600 bg-amber-500/10 border-amber-500/20' : ''}
                            ${cert.status === 'failed' ? 'text-red-600 bg-red-500/10 border-red-500/20' : ''}
                        `}>
                      {cert.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => viewCertificate(cert)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>View Details</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => downloadCertificate(cert)}>
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Download PDF</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-auto pt-6 border-t text-center">
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
          <Shield className="h-3 w-3" />
          Certificates are generated and stored locally on this system. DropDrive does not upload or sync certificates to external servers.
        </p>
      </div>

      <Dialog open={showCertificate} onOpenChange={setShowCertificate}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-card border-border sm:max-w-3xl">
          {selectedCertificate && (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="p-6 border-b border-border bg-muted/20">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                      <Shield className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-foreground tracking-tight">DATA SANITIZATION CERTIFICATE</h2>
                      <p className="text-sm text-muted-foreground mt-1 font-mono tracking-wide flex items-center gap-2">
                        ID: {selectedCertificate.id}
                        <Button size="icon" variant="ghost" className="h-4 w-4" onClick={() => copyToClipboard(selectedCertificate.id)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`
                        px-3 py-1 uppercase tracking-wider text-xs font-semibold
                        ${selectedCertificate.status === 'verified' ? 'border-green-500/30 text-green-600 bg-green-500/10' : ''}
                        ${selectedCertificate.status === 'simulated' ? 'border-amber-500/30 text-amber-600 bg-amber-500/10' : ''}
                        ${selectedCertificate.status === 'failed' ? 'border-red-500/30 text-red-600 bg-red-500/10' : ''}
                        `}>
                    {selectedCertificate.status === 'simulated' ? 'Valid (Simulation)' : selectedCertificate.status}
                  </Badge>
                </div>
              </div>

              {/* Body */}
              <div className="p-8 space-y-8 bg-card">

                <div className="grid grid-cols-2 gap-12">
                  {/* Device info block */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                      <HardDrive className="h-3 w-3" /> Device Information
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Model / Name</div>
                        <div className="text-sm font-medium text-foreground">{selectedCertificate.deviceName}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Type</div>
                          <div className="text-sm text-foreground">{selectedCertificate.deviceType}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Capacity</div>
                          <div className="text-sm text-foreground">{selectedCertificate.capacity}</div>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Serial Number</div>
                        <div className="text-sm font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded border border-border inline-block">
                          {selectedCertificate.serialNumber}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sanitization details block */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Award className="h-3 w-3" /> Sanitization Details
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Method Used</div>
                        <div className="text-sm font-medium text-foreground">{selectedCertificate.wipeMethod}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Standard</div>
                          <div className="text-sm text-foreground">{selectedCertificate.standard}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Duration</div>
                          <div className="text-sm text-foreground">{selectedCertificate.duration}</div>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Verification Result</div>
                        <div className="text-sm text-green-600 font-medium flex items-center gap-1.5">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Successful Verification
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-border" />

                {/* Certification Statement */}
                <div className="bg-muted/10 border border-border rounded-lg p-5 flex gap-4 items-start">
                  <div className="mt-1">
                    <Shield className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-foreground">Certification of Destruction</h4>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      This document certifies that the storage media described above has been sanitized in accordance with the
                      <span className="text-foreground font-medium"> NIST 800-88 Guidelines for Media Sanitization</span>.
                      All addressable locations have been overwritten and verified, rendering data irretrievable.
                    </p>
                  </div>
                </div>

                {/* Local File Paths */}
                <div className="border rounded-md border-border bg-muted/5 overflow-hidden">
                  <div className="px-4 py-2 bg-muted/20 border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Local Record Storage
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground flex items-center gap-2">
                        <File className="h-3.5 w-3.5 text-red-500" /> PDF Path (Local)
                      </label>
                      <div className="flex gap-2 items-center">
                        <code className="flex-1 bg-muted/30 border border-border rounded px-2 py-1.5 text-xs font-mono text-muted-foreground break-all">
                          {selectedCertificate.pdfPath || "Path not available"}
                        </code>
                        <Button size="icon" variant="outline" className="h-8 w-8 shrink-0 hover:bg-muted" onClick={() => copyToClipboard(selectedCertificate.pdfPath || "")} title="Copy Path">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground flex items-center gap-2">
                        <FileJson className="h-3.5 w-3.5 text-yellow-500" /> JSON Path (Local)
                      </label>
                      <div className="flex gap-2 items-center">
                        <code className="flex-1 bg-muted/30 border border-border rounded px-2 py-1.5 text-xs font-mono text-muted-foreground break-all">
                          {selectedCertificate.jsonPath || "Path not available"}
                        </code>
                        <Button size="icon" variant="outline" className="h-8 w-8 shrink-0 hover:bg-muted" onClick={() => copyToClipboard(selectedCertificate.jsonPath || "")} title="Copy Path">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Metadata Footer */}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono border-t border-border pt-4">
                  <div>
                    TIMESTAMP: {new Date(selectedCertificate.date).toISOString()}
                  </div>
                  <div className="flex items-center gap-2">
                    <span>DIGITAL SIGNATURE:</span>
                    <span className="truncate max-w-[150px] opacity-50">
                      {selectedCertificate.id.replace(/-/g, '').substring(0, 24)}...
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-border bg-muted/10 flex justify-between items-center rounded-b-lg">
                <div className="text-xs text-muted-foreground">
                  Generated by DropDrive Pro
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" size="sm" onClick={() => setShowCertificate(false)}>
                    Close
                  </Button>
                  <Button size="sm" onClick={() => downloadCertificate(selectedCertificate)}>
                    <Download className="h-3.5 w-3.5 mr-2" />
                    Download PDF
                  </Button>
                </div>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
