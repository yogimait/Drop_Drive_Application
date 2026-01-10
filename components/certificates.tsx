"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  FileText,
  Download,
  Search,
  Filter,
  Calendar,
  HardDrive,
  Shield,
  Eye,
  MoreHorizontal,
  CheckCircle,
  Award,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface FormattedCertificate {
  id: string
  date: string
  deviceName: string
  deviceType: string
  capacity: string
  wipeMethod: string
  standard: string
  duration: string
  status: "completed" | "verified" | "archived"
  serialNumber: string
}

// const mockCertificates: Certificate[] = [
//   {
//     id: "CERT-2024-001",
//     date: "2024-01-15",
//     deviceName: "Samsung SSD 970 EVO",
//     deviceType: "SSD",
//     capacity: "512 GB",
//     wipeMethod: "DoD 5220.22-M",
//     standard: "3-pass",
//     duration: "2h 15m",
//     status: "completed",
//     serialNumber: "S4EVNX0M123456",
//   },
//   {
//     id: "CERT-2024-002",
//     date: "2024-01-14",
//     deviceName: "WD Black HDD",
//     deviceType: "HDD",
//     capacity: "2 TB",
//     wipeMethod: "NIST 800-88",
//     standard: "1-pass",
//     duration: "4h 32m",
//     status: "verified",
//     serialNumber: "WD-WCC4N7654321",
//   },
//   {
//     id: "CERT-2024-003",
//     date: "2024-01-12",
//     deviceName: "Kingston USB Drive",
//     deviceType: "USB",
//     capacity: "64 GB",
//     wipeMethod: "Random Data",
//     standard: "1-pass",
//     duration: "12m",
//     status: "completed",
//     serialNumber: "KNG-USB-789012",
//   },
//   {
//     id: "CERT-2024-004",
//     date: "2024-01-10",
//     deviceName: "Seagate Backup Plus",
//     deviceType: "HDD",
//     capacity: "4 TB",
//     wipeMethod: "Gutmann",
//     standard: "35-pass",
//     duration: "18h 45m",
//     status: "archived",
//     serialNumber: "ST4000DM004-345",
//   },
//   {
//     id: "CERT-2024-005",
//     date: "2024-01-08",
//     deviceName: "Crucial MX500 SSD",
//     deviceType: "SSD",
//     capacity: "1 TB",
//     wipeMethod: "DoD 5220.22-M",
//     standard: "3-pass",
//     duration: "3h 28m",
//     status: "completed",
//     serialNumber: "CT1000MX500-567",
//   },
// ]

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
    window.api.getCertificates().then((certs) => {
      // 3. Format the data to match what the component expects
      const formattedCerts = certs.map((c: any) => ({
        id: c.certificate_id,
        date: c.timestamp_utc,
        deviceName: c.device_info.model,
        deviceType: c.device_info.type,
        capacity: c.device_info.capacity,
        wipeMethod: c.erase_method,
        standard: c.nist_profile,
        duration: "N/A", // This data is not in your JSON yet
        status: c.post_wipe_status === 'success' ? 'verified' : 'error',
        serialNumber: c.device_info.serial_number,
        // Keep original data for the detailed view
        original: c
      }));
      setCertificates(formattedCerts);
      setIsLoading(false);
    });
  }, []);

  const filteredCertificates = certificates.filter((cert) => {
    const matchesSearch =
      cert.deviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.id.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || cert.status === statusFilter
    const matchesType = typeFilter === "all" || cert.deviceType.toLowerCase() === typeFilter.toLowerCase()

    return matchesSearch && matchesStatus && matchesType
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-secondary text-secondary-foreground"
      case "verified":
        return "bg-primary text-primary-foreground"
      case "archived":
        return "bg-muted text-muted-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getDeviceIcon = (type: string) => {
    return <HardDrive className="h-4 w-4" />
  }

  const viewCertificate = (cert: FormattedCertificate) => {
    setSelectedCertificate(cert)
    setShowCertificate(true)
  }

  // const downloadCertificate = (cert: FormattedCertificate) => {
  //   const certificateWindow = window.open("", "_blank")
  //   if (certificateWindow) {
  //     certificateWindow.document.write(generateCertificateHTML(cert))
  //     certificateWindow.document.close()
  //     certificateWindow.print()
  //   }
  // }

  // This function replaces your old downloadCertificate function

  const downloadCertificate = async (cert: FormattedCertificate) => {
    if (!cert) return;

    // 1. Call the new backend function via the preload bridge
    // @ts-ignore
    const result = await window.api.downloadCertificatePdf(cert.id);

    if (result.success) {
      // 2. Create a Blob from the returned PDF data
      const blob = new Blob([result.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);

      // 3. Create a temporary link to trigger the download
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate_${cert.id}.pdf`; // The filename for the download
      document.body.appendChild(a);
      a.click();

      // 4. Clean up the temporary link and URL
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } else {
      console.error("Failed to download certificate:", result.error);
      // You can add a user-facing notification here (e.g., a toast message)
      alert(`Error: Could not download PDF. ${result.error}`);
    }
  };

  const generateCertificateHTML = (cert: FormattedCertificate) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>SecureWipe Pro Certificate - ${cert.id}</title>
        <style>
          body { 
            font-family: 'Arial', sans-serif; 
            margin: 0; 
            padding: 40px; 
            background: white;
            color: #1a1a1a;
          }
          .certificate {
            max-width: 800px;
            margin: 0 auto;
            border: 3px solid #2563eb;
            padding: 40px;
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
          }
          .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 20px;
          }
          .logo {
            font-size: 32px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
          }
          .title {
            font-size: 28px;
            font-weight: bold;
            color: #1a1a1a;
            margin: 20px 0;
          }
          .subtitle {
            font-size: 18px;
            color: #64748b;
          }
          .content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin: 30px 0;
          }
          .section {
            background: white;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
          }
          .section-title {
            font-size: 16px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 15px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 5px;
          }
          .field {
            margin-bottom: 10px;
          }
          .field-label {
            font-weight: bold;
            color: #374151;
            display: inline-block;
            width: 120px;
          }
          .field-value {
            color: #1a1a1a;
          }
          .verification {
            text-align: center;
            margin-top: 40px;
            padding: 20px;
            background: #10b981;
            color: white;
            border-radius: 8px;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            color: #64748b;
            font-size: 12px;
          }
          @media print {
            body { padding: 20px; }
            .certificate { border: 2px solid #2563eb; }
          }
        </style>
      </head>
      <body>
        <div class="certificate">
          <div class="header">
            <div class="logo">🛡️ SecureWipe Pro</div>
            <div class="title">DATA SANITIZATION CERTIFICATE</div>
            <div class="subtitle">Certificate of Secure Data Destruction</div>
          </div>
          
          <div class="content">
            <div class="section">
              <div class="section-title">Certificate Information</div>
              <div class="field">
                <span class="field-label">Certificate ID:</span>
                <span class="field-value">${cert.id}</span>
              </div>
              <div class="field">
                <span class="field-label">Issue Date:</span>
                <span class="field-value">${new Date(cert.date).toLocaleDateString()}</span>
              </div>
              <div class="field">
                <span class="field-label">Status:</span>
                <span class="field-value">${cert.status.toUpperCase()}</span>
              </div>
              <div class="field">
                <span class="field-label">Duration:</span>
                <span class="field-value">${cert.duration}</span>
              </div>
            </div>
            
            <div class="section">
              <div class="section-title">Device Information</div>
              <div class="field">
                <span class="field-label">Device Name:</span>
                <span class="field-value">${cert.deviceName}</span>
              </div>
              <div class="field">
                <span class="field-label">Device Type:</span>
                <span class="field-value">${cert.deviceType}</span>
              </div>
              <div class="field">
                <span class="field-label">Capacity:</span>
                <span class="field-value">${cert.capacity}</span>
              </div>
              <div class="field">
                <span class="field-label">Serial Number:</span>
                <span class="field-value">${cert.serialNumber}</span>
              </div>
            </div>
            
            <div class="section">
              <div class="section-title">Sanitization Method</div>
              <div class="field">
                <span class="field-label">Method:</span>
                <span class="field-value">${cert.wipeMethod}</span>
              </div>
              <div class="field">
                <span class="field-label">Standard:</span>
                <span class="field-value">${cert.standard}</span>
              </div>
              <div class="field">
                <span class="field-label">Verification:</span>
                <span class="field-value">Post-wipe verification completed</span>
              </div>
            </div>
            
            <div class="section">
              <div class="section-title">Compliance</div>
              <div class="field">
                <span class="field-label">Standards:</span>
                <span class="field-value">NIST 800-88, DoD 5220.22-M</span>
              </div>
              <div class="field">
                <span class="field-label">Regulation:</span>
                <span class="field-value">GDPR, HIPAA Compliant</span>
              </div>
              <div class="field">
                <span class="field-label">Audit Trail:</span>
                <span class="field-value">Complete</span>
              </div>
            </div>
          </div>
          
          <div class="verification">
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">
              ✓ VERIFICATION COMPLETE
            </div>
            <div>
              This certificate confirms that the above-mentioned storage device has been securely sanitized 
              according to industry standards and regulatory requirements. All data has been permanently destroyed 
              and is unrecoverable.
            </div>
          </div>
          
          <div class="footer">
            <div>Generated by SecureWipe Pro v2.1.0 | Certificate Hash: ${cert.id.replace("CERT-", "SHA256-")}</div>
            <div>This certificate is digitally signed and tamper-evident</div>
          </div>
        </div>
      </body>
      </html>
    `
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header and key stats combined */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 border-b pb-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Certificates</h1>
          <p className="text-sm text-muted-foreground">Manage your secure wipe records.</p>
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
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground text-xs uppercase tracking-wider">Capacity</span>
            <span className="font-mono font-medium">7.6 TB</span>
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
            className="pl-9 h-9 bg-muted/40 border-border"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-full sm:w-[140px] bg-muted/40 border-border">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-full sm:w-[140px] bg-muted/40 border-border">
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

      {/* Minimal Table */}
      <div className="rounded-md border bg-card/50">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b-border/50">
              <TableHead className="w-[180px]">ID</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCertificates.map((cert) => (
              <TableRow key={cert.id} className="hover:bg-muted/50 border-b-border/50">
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {cert.id}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-3.5 w-3.5 text-muted-foreground/70" />
                    <span className="font-medium text-sm">{cert.deviceName}</span>
                    <span className="text-xs text-muted-foreground ml-1">({cert.capacity})</span>
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
                        font-normal text-xs px-2 py-0 h-5
                        ${cert.status === 'verified' ? 'text-green-500 bg-green-500/10 hover:bg-green-500/20' : ''}
                        ${cert.status === 'completed' ? 'text-blue-500 bg-blue-500/10 hover:bg-blue-500/20' : ''}
                     `}>
                    {cert.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 hover:bg-muted"
                      onClick={() => viewCertificate(cert)}
                    >
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 hover:bg-muted"
                      onClick={() => downloadCertificate(cert)}
                    >
                      <Download className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredCertificates.length === 0 && (
        <div className="text-center py-12 border rounded-md border-dashed border-border/60">
          <p className="text-sm text-muted-foreground">No certificates found matching your filters.</p>
        </div>
      )}



      <Dialog open={showCertificate} onOpenChange={setShowCertificate}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-[#0f1115] border-[#2a2f3a]">
          {selectedCertificate && (
            <div className="flex flex-col h-full">
              {/* Professional Header */}
              <div className="p-6 border-b border-[#2a2f3a] bg-[#1a1d24]">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                      <Shield className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white tracking-tight">DATA SANITIZATION CERTIFICATE</h2>
                      <p className="text-sm text-muted-foreground mt-1 font-mono tracking-wide">
                        ID: {selectedCertificate.id}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`${selectedCertificate.status === 'verified'
                    ? 'border-green-500/30 text-green-500 bg-green-500/5'
                    : 'border-blue-500/30 text-blue-500 bg-blue-500/5'
                    } px-3 py-1 uppercase tracking-wider text-xs font-semibold`}>
                    {selectedCertificate.status}
                  </Badge>
                </div>
              </div>

              {/* Certificate Content - Grid Layout */}
              <div className="p-8 space-y-8 bg-[#0f1115]">

                {/* Section 1: Core Information */}
                <div className="grid grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                      <HardDrive className="h-3 w-3" /> Device Information
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Model / Name</div>
                        <div className="text-sm font-medium text-white">{selectedCertificate.deviceName}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Type</div>
                          <div className="text-sm text-gray-300">{selectedCertificate.deviceType}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Capacity</div>
                          <div className="text-sm text-gray-300">{selectedCertificate.capacity}</div>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Serial Number</div>
                        <div className="text-sm font-mono text-gray-400 bg-[#1a1d24] px-2 py-1 rounded border border-[#2a2f3a] inline-block">
                          {selectedCertificate.serialNumber || "N/A"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Award className="h-3 w-3" /> Sanitization Details
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Method Used</div>
                        <div className="text-sm font-medium text-white">{selectedCertificate.wipeMethod}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Standard</div>
                          <div className="text-sm text-gray-300">{selectedCertificate.standard}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Duration</div>
                          <div className="text-sm text-gray-300">{selectedCertificate.duration}</div>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Verification Result</div>
                        <div className="text-sm text-green-500 font-medium flex items-center gap-1.5">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Successful Verification
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-[#2a2f3a] to-transparent" />

                {/* Section 2: Certification Statement */}
                <div className="bg-[#1a1d24]/50 border border-[#2a2f3a] rounded-lg p-5 flex gap-4 items-start">
                  <div className="mt-1">
                    <Shield className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-white">Certification of Destruction</h4>
                    <p className="text-xs leading-relaxed text-gray-400">
                      This document certifies that the storage media described above has been sanitized in accordance with the
                      <span className="text-gray-300"> NIST 800-88 Guidelines for Media Sanitization</span>.
                      All addressable locations have been overwritten and verified, rendering data irretrievable.
                    </p>
                  </div>
                </div>

                {/* Section 3: Metadata Footer */}
                <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono border-t border-[#2a2f3a] pt-4">
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
              <div className="p-4 border-t border-[#2a2f3a] bg-[#1a1d24] flex justify-between items-center">
                <div className="text-xs text-muted-foreground">
                  Generated by DropDrive Pro v2.1.0
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" size="sm" onClick={() => setShowCertificate(false)} className="border-[#2a2f3a] hover:bg-[#2a2f3a] text-gray-300">
                    Close
                  </Button>
                  <Button size="sm" onClick={() => downloadCertificate(selectedCertificate)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20">
                    <Download className="h-3.5 w-3.5 mr-2" />
                    Download PDF
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div >
  )
}
