"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import {
  HelpCircle,
  Search,
  ChevronDown,
  ChevronRight,
  Info,
  Shield,
  Book,
  FileText,
  AlertTriangle,
  WifiOff,
  Database,
  ShieldAlert,
  ServerOff,
} from "lucide-react"

interface FAQItem {
  id: string
  question: string
  answer: string
  category: string
  tags: string[]
}

const faqData: FAQItem[] = [
  {
    id: "1",
    question: "What wipe methods are supported by DropDrive?",
    answer:
      "DropDrive supports multiple industry-standard wipe methods including DoD 5220.22-M (3-pass), NIST 800-88 (1-pass for SSDs), Gutmann method (35-pass), Random Data (1-pass), and Zero Fill (1-pass). Each method is designed for different security requirements and drive types.",
    category: "Wipe Methods",
    tags: ["wipe", "security", "methods"],
  },
  {
    id: "2",
    question: "How do I verify that a wipe was successful?",
    answer:
      "After each wipe operation, DropDrive generates a detailed certificate that includes verification data. You can also enable auto-verification in Settings, which performs a read-back check to ensure data has been properly overwritten. All certificates are generated locally on your machine.",
    category: "Verification",
    tags: ["verification", "certificate", "security"],
  },
  {
    id: "3",
    question: "What are the limitations of DropDrive?",
    answer:
      "DropDrive does NOT provide cloud backups, remote device management, or live customer support. All wipe operations and certificates are generated locally on your system. It is a strictly offline tool designed for local data destruction.",
    category: "Limitations",
    tags: ["offline", "cloud", "support"],
  },
  {
    id: "4",
    question: "What file formats are supported for certificates?",
    answer:
      "DropDrive generates certificates in PDF format by default. You can also enable JSON report generation in Settings for machine-readable certificates. Both formats are stored locally on your device.",
    category: "Certificates",
    tags: ["certificate", "pdf", "json"],
  },
  {
    id: "5",
    question: "How long does a secure wipe take?",
    answer:
      "Wipe duration depends on the drive size, type, and selected method. SSDs with single-pass methods typically take 30 minutes to 2 hours. HDDs with multi-pass methods can take several hours to days for large drives. The Gutmann method (35-pass) takes the longest but provides maximum security.",
    category: "Performance",
    tags: ["time", "performance", "duration"],
  },
  {
    id: "6",
    question: "Is DropDrive compliant with industry standards?",
    answer:
      "Yes, DropDrive is compliant with major industry standards including DoD 5220.22-M, NIST 800-88, and Common Criteria. Our certificates are widely accepted for compliance audits.",
    category: "Compliance",
    tags: ["compliance", "standards", "certification"],
  },
  {
    id: "7",
    question: "Can I pause and resume a wipe operation?",
    answer:
      "Yes, you can pause most wipe operations and resume them later. However, for security reasons, some methods like Gutmann cannot be paused once started. The system will warn you before starting non-pausable operations.",
    category: "Operations",
    tags: ["pause", "resume", "operations"],
  },
  {
    id: "8",
    question: "What should I do if a wipe operation fails?",
    answer:
      "If a wipe fails, check the drive health first. DropDrive will automatically retry based on your settings (default: 3 attempts). If the drive has bad sectors or hardware issues, consider physical destruction. All failed attempts are logged locally.",
    category: "Troubleshooting",
    tags: ["error", "failure", "troubleshooting"],
  },
]

const categories = [
  "All",
  "Wipe Methods",
  "Verification",
  "Certificates",
  "limitations",
  "Performance",
  "Compliance",
  "Operations",
  "Troubleshooting",
]

export function Help() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [openItems, setOpenItems] = useState<string[]>([])

  const filteredFAQs = faqData.filter((faq) => {
    const matchesSearch =
      faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      faq.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategory = selectedCategory === "All" || faq.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const toggleItem = (id: string) => {
    setOpenItems((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">Help & Support</h1>
            <Badge variant="outline" className="text-xs bg-background/50 backdrop-blur border-primary/20 text-primary">
              <WifiOff className="w-3 h-3 mr-1" />
              Offline Mode
            </Badge>
          </div>
          <p className="text-muted-foreground">Documentation and support resources for DropDrive v2.1.0</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Search and Filter */}
          <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                Search Documentation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search for help topics, features, or error messages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                    className={
                      selectedCategory === category
                        ? "bg-primary text-primary-foreground"
                        : "bg-transparent border-border/50 hover:bg-accent hover:text-accent-foreground"
                    }
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Start Guide */}
          <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                <Book className="h-5 w-5 text-primary" />
                Quick Start Guide
              </CardTitle>
              <CardDescription>Essential steps to get started with DropDrive</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg border border-border/50 bg-background/30 hover:bg-background/50 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20">
                      1
                    </div>
                    <h3 className="font-medium text-card-foreground">Connect Your Drive</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Connect the storage device you want to securely wipe to your computer
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-border/50 bg-background/30 hover:bg-background/50 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20">
                      2
                    </div>
                    <h3 className="font-medium text-card-foreground">Select Wipe Method</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Choose the appropriate security standard for your requirements
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-border/50 bg-background/30 hover:bg-background/50 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20">
                      3
                    </div>
                    <h3 className="font-medium text-card-foreground">Start Wipe Process</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Begin the secure wipe operation and monitor progress in real-time
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-border/50 bg-background/30 hover:bg-background/50 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20">
                      4
                    </div>
                    <h3 className="font-medium text-card-foreground">Get Certificate</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Download your compliance certificate once the wipe is complete
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* FAQ Section */}
          <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                Frequently Asked Questions
              </CardTitle>
              <CardDescription>
                {filteredFAQs.length} of {faqData.length} questions
                {selectedCategory !== "All" && ` in ${selectedCategory}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {filteredFAQs.map((faq) => (
                <Collapsible key={faq.id} open={openItems.includes(faq.id)} onOpenChange={() => toggleItem(faq.id)}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-accent/50 hover:border-accent transition-all group">
                    <div className="flex items-start gap-3 text-left">
                      <div className="flex-1">
                        <h3 className="font-medium text-card-foreground group-hover:text-primary transition-colors">{faq.question}</h3>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs border-border/50 text-muted-foreground">
                            {faq.category}
                          </Badge>
                          {faq.tags.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs bg-muted/50 text-muted-foreground">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    {openItems.includes(faq.id) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 pb-4">
                    <div className="pt-3 ml-1 border-l-2 border-border/50 pl-4 mt-2">
                      <p className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}

              {filteredFAQs.length === 0 && (
                <div className="text-center py-8">
                  <HelpCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-lg font-medium text-card-foreground">No results found</p>
                  <p className="text-muted-foreground">
                    Try adjusting your search terms or browse different categories
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Disclaimer */}
          <div className="flex items-start gap-3 p-4 rounded-lg border border-red-500/20 bg-red-500/5">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-red-500">Important Disclaimer</p>
              <p className="text-xs text-muted-foreground">
                DropDrive performs destructive disk operations. Always verify the selected drive before starting a wipe.
                The developers are not responsible for accidental data loss. This software is provided "as is" without any warranty.
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">

          {/* How DropDrive Works */}
          <Card className="bg-card/50 border-border/50 backdrop-blur-sm overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-primary to-purple-500" />
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                How DropDrive Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-sm text-muted-foreground">
                  <WifiOff className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>Runs fully offline with no external connections</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-muted-foreground">
                  <ShieldAlert className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>Performs permanent, destructive disk operations</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>Generates digitally signed certificates locally</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-muted-foreground">
                  <Database className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>Requires administrator privileges for disk access</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Support Information */}
          <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                <ServerOff className="h-5 w-5 text-primary" />
                Support Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-accent/20 border border-accent/50">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  DropDrive is distributed as a local desktop application. All wipe operations and certificates are generated locally.
                  Support is provided through documentation and project resources.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Resources */}
          <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-card-foreground">Resources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start bg-transparent border-border/50 hover:bg-accent hover:text-accent-foreground h-auto py-3">
                <FileText className="mr-2 h-4 w-4 text-primary" />
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium">User Manual</span>
                  <span className="text-xs text-muted-foreground">Local Documentation</span>
                </div>
              </Button>

              <Button variant="outline" className="w-full justify-start bg-transparent border-border/50 hover:bg-accent hover:text-accent-foreground h-auto py-3">
                <Shield className="mr-2 h-4 w-4 text-primary" />
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium">Security Standards</span>
                  <span className="text-xs text-muted-foreground">NIST 800-88 Overview</span>
                </div>
              </Button>
            </CardContent>
          </Card>

          {/* System Info */}
          <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-card-foreground">System Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">App Version</span>
                <Badge variant="secondary" className="font-mono text-xs">v2.1.0</Badge>
              </div>

              <Separator className="bg-border/50" />

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Admin Privileges</span>
                <Badge variant="outline" className="text-xs border-green-500/30 text-green-500 bg-green-500/10">Yes</Badge>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Database Status</span>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-medium text-card-foreground">Connected</span>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

