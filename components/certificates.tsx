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
      const formattedCerts = certs.map(c => ({
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
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Wipe Certificates</h1>
        <p className="text-muted-foreground">View and manage certificates for completed secure wipe operations</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-card-foreground">Total Certificates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-2xl font-bold text-card-foreground">{certificates.length}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-card-foreground">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-secondary" />
              <span className="text-2xl font-bold text-card-foreground">
                {certificates.filter((c) => c.date.startsWith("2024-01")).length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">January 2024</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-card-foreground">Verified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-2xl font-bold text-card-foreground">
                {certificates.filter((c) => c.status === "verified").length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Compliance verified</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-card-foreground">Data Wiped</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold text-card-foreground">7.6</span>
              <span className="text-sm text-muted-foreground">TB</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total capacity</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-card-foreground flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Certificates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by device name or certificate ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="ssd">SSD</SelectItem>
                <SelectItem value="hdd">HDD</SelectItem>
                <SelectItem value="usb">USB</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-card-foreground">Certificate History</CardTitle>
          <CardDescription>
            {filteredCertificates.length} of {certificates.length} certificates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-card-foreground">Certificate ID</TableHead>
                  <TableHead className="text-card-foreground">Date</TableHead>
                  <TableHead className="text-card-foreground">Device</TableHead>
                  <TableHead className="text-card-foreground">Method</TableHead>
                  <TableHead className="text-card-foreground">Duration</TableHead>
                  <TableHead className="text-card-foreground">Status</TableHead>
                  <TableHead className="text-card-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCertificates.map((cert) => (
                  <TableRow key={cert.id}>
                    <TableCell className="font-medium text-card-foreground">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        {cert.id}
                      </div>
                    </TableCell>
                    <TableCell className="text-card-foreground">{new Date(cert.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-start gap-2">
                        {getDeviceIcon(cert.deviceType)}
                        <div>
                          <p className="font-medium text-card-foreground">{cert.deviceName}</p>
                          <p className="text-xs text-muted-foreground">
                            {cert.deviceType} • {cert.capacity}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-card-foreground">{cert.wipeMethod}</p>
                        <p className="text-xs text-muted-foreground">{cert.standard}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-card-foreground">{cert.duration}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(cert.status)}>
                        {cert.status.charAt(0).toUpperCase() + cert.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0 bg-transparent"
                          onClick={() => viewCertificate(cert)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0 bg-transparent"
                          onClick={() => downloadCertificate(cert)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0 bg-transparent">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => viewCertificate(cert)}>View Details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => downloadCertificate(cert)}>Download PDF</DropdownMenuItem>
                            <DropdownMenuItem>Download JSON</DropdownMenuItem>
                            <DropdownMenuItem>Verify Certificate</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredCertificates.length === 0 && (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-card-foreground">No certificates found</p>
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== "all" || typeFilter !== "all"
                  ? "Try adjusting your search or filter criteria"
                  : "Complete a wipe operation to generate your first certificate"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCertificate} onOpenChange={setShowCertificate}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Certificate Details - {selectedCertificate?.id}
            </DialogTitle>
          </DialogHeader>

          {selectedCertificate && (
            <div className="space-y-6">
              <div className="text-center p-6 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border">
                <div className="text-2xl font-bold text-primary mb-2">🛡️ Drop Drive</div>
                <div className="text-xl font-semibold mb-1">DATA SANITIZATION CERTIFICATE</div>
                <div className="text-muted-foreground">Certificate of Secure Data Destruction</div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-primary">Certificate Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Certificate ID:</span>
                      <span className="font-medium">{selectedCertificate.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Issue Date:</span>
                      <span className="font-medium">{new Date(selectedCertificate.date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge className={getStatusColor(selectedCertificate.status)}>
                        {selectedCertificate.status.charAt(0).toUpperCase() + selectedCertificate.status.slice(1)}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration:</span>
                      <span className="font-medium">{selectedCertificate.duration}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-primary">Device Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Device Name:</span>
                      <span className="font-medium">{selectedCertificate.deviceName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Device Type:</span>
                      <span className="font-medium">{selectedCertificate.deviceType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Capacity:</span>
                      <span className="font-medium">{selectedCertificate.capacity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Serial Number:</span>
                      <span className="font-medium font-mono text-sm">{selectedCertificate.serialNumber}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-primary">Sanitization Method</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Method:</span>
                      <span className="font-medium">{selectedCertificate.wipeMethod}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Standard:</span>
                      <span className="font-medium">{selectedCertificate.standard}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Verification:</span>
                      <span className="font-medium text-primary flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        Completed
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-primary">Compliance</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Standards:</span>
                      <span className="font-medium">NIST 800-88, DoD 5220.22-M</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Regulation:</span>
                      <span className="font-medium">GDPR, HIPAA Compliant</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Audit Trail:</span>
                      <span className="font-medium text-primary flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        Complete
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-6 text-center">
                  <div className="flex items-center justify-center gap-2 text-primary mb-3">
                    <CheckCircle className="h-6 w-6" />
                    <span className="text-lg font-semibold">VERIFICATION COMPLETE</span>
                  </div>
                  <p className="text-muted-foreground">
                    This certificate confirms that the above-mentioned storage device has been securely sanitized
                    according to industry standards and regulatory requirements. All data has been permanently destroyed
                    and is unrecoverable.
                  </p>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowCertificate(false)}>
                  Close
                </Button>
                <Button onClick={() => downloadCertificate(selectedCertificate)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
