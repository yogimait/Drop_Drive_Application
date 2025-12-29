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
  MessageCircle,
  Mail,
  Phone,
  FileText,
  Shield,
  ExternalLink,
  Book,
  Video,
  Download,
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
    question: "What wipe methods are supported by SecureWipe Pro?",
    answer:
      "SecureWipe Pro supports multiple industry-standard wipe methods including DoD 5220.22-M (3-pass), NIST 800-88 (1-pass for SSDs), Gutmann method (35-pass), Random Data (1-pass), and Zero Fill (1-pass). Each method is designed for different security requirements and drive types.",
    category: "Wipe Methods",
    tags: ["wipe", "security", "methods"],
  },
  {
    id: "2",
    question: "How do I verify that a wipe was successful?",
    answer:
      "After each wipe operation, SecureWipe Pro generates a detailed certificate that includes verification data. You can also enable auto-verification in Settings, which performs a read-back check to ensure data has been properly overwritten. All certificates are digitally signed and include timestamps.",
    category: "Verification",
    tags: ["verification", "certificate", "security"],
  },
  {
    id: "3",
    question: "Can I wipe system drives or drives with the operating system?",
    answer:
      "For security reasons, SecureWipe Pro prevents wiping of system drives that contain the active operating system. You can wipe system drives by booting from a SecureWipe Pro bootable USB or by removing the drive and connecting it to another system.",
    category: "System Drives",
    tags: ["system", "os", "bootable"],
  },
  {
    id: "4",
    question: "What file formats are supported for certificates?",
    answer:
      "SecureWipe Pro generates certificates in PDF format by default. You can also enable JSON report generation in Settings for machine-readable certificates. Both formats include the same verification data, timestamps, and digital signatures.",
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
    question: "Is SecureWipe Pro compliant with industry standards?",
    answer:
      "Yes, SecureWipe Pro is compliant with major industry standards including DoD 5220.22-M, NIST 800-88, and Common Criteria. Our certificates are accepted by government agencies, financial institutions, and healthcare organizations for compliance audits.",
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
      "If a wipe fails, check the drive health first. SecureWipe Pro will automatically retry based on your settings (default: 3 attempts). If the drive has bad sectors or hardware issues, consider professional data destruction services. All failed attempts are logged for troubleshooting.",
    category: "Troubleshooting",
    tags: ["error", "failure", "troubleshooting"],
  },
]

const categories = [
  "All",
  "Wipe Methods",
  "Verification",
  "Certificates",
  "Performance",
  "Compliance",
  "Operations",
  "Troubleshooting",
  "System Drives",
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Help & Support</h1>
        <p className="text-muted-foreground">Find answers to common questions and get support for SecureWipe Pro</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Search and Filter */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search Help Topics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search for help topics, features, or error messages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
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
                        : "bg-transparent hover:bg-accent"
                    }
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* FAQ Section */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
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
                  <CollapsibleTrigger className="flex w-full items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                    <div className="flex items-start gap-3 text-left">
                      <div className="flex-1">
                        <h3 className="font-medium text-card-foreground">{faq.question}</h3>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {faq.category}
                          </Badge>
                          {faq.tags.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs bg-muted text-muted-foreground">
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
                    <div className="pt-3 border-t border-border">
                      <p className="text-sm text-card-foreground leading-relaxed">{faq.answer}</p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}

              {filteredFAQs.length === 0 && (
                <div className="text-center py-8">
                  <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-card-foreground">No results found</p>
                  <p className="text-muted-foreground">
                    Try adjusting your search terms or browse different categories
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Start Guide */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                <Book className="h-5 w-5" />
                Quick Start Guide
              </CardTitle>
              <CardDescription>Essential steps to get started with SecureWipe Pro</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg border border-border bg-card/50">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                      1
                    </div>
                    <h3 className="font-medium text-card-foreground">Connect Your Drive</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Connect the storage device you want to securely wipe to your computer
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-border bg-card/50">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                      2
                    </div>
                    <h3 className="font-medium text-card-foreground">Select Wipe Method</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Choose the appropriate security standard for your requirements
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-border bg-card/50">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                      3
                    </div>
                    <h3 className="font-medium text-card-foreground">Start Wipe Process</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Begin the secure wipe operation and monitor progress in real-time
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-border bg-card/50">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
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
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact Support */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Contact Support
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                <MessageCircle className="mr-2 h-4 w-4" />
                Live Chat Support
              </Button>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-card-foreground">Email Support</p>
                    <p className="text-xs text-muted-foreground">support@securewipe.com</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-card-foreground">Phone Support</p>
                    <p className="text-xs text-muted-foreground">1-800-SECURE-1</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="text-center">
                <p className="text-xs text-muted-foreground">Business Hours</p>
                <p className="text-sm font-medium text-card-foreground">Mon-Fri 9AM-6PM EST</p>
              </div>
            </CardContent>
          </Card>

          {/* Resources */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-card-foreground">Resources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start bg-transparent">
                <FileText className="mr-2 h-4 w-4" />
                User Manual
                <ExternalLink className="ml-auto h-3 w-3" />
              </Button>

              <Button variant="outline" className="w-full justify-start bg-transparent">
                <Video className="mr-2 h-4 w-4" />
                Video Tutorials
                <ExternalLink className="ml-auto h-3 w-3" />
              </Button>

              <Button variant="outline" className="w-full justify-start bg-transparent">
                <Shield className="mr-2 h-4 w-4" />
                Security Standards
                <ExternalLink className="ml-auto h-3 w-3" />
              </Button>

              <Button variant="outline" className="w-full justify-start bg-transparent">
                <Download className="mr-2 h-4 w-4" />
                Download Center
                <ExternalLink className="ml-auto h-3 w-3" />
              </Button>
            </CardContent>
          </Card>

          {/* System Info */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-card-foreground">System Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Version</span>
                <span className="text-sm font-medium text-card-foreground">v2.1.0</span>
              </div>

              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">License</span>
                <Badge className="bg-secondary text-secondary-foreground">Professional</Badge>
              </div>

              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Support Until</span>
                <span className="text-sm font-medium text-card-foreground">Dec 2024</span>
              </div>

              <Separator />

              <Button variant="outline" size="sm" className="w-full bg-transparent">
                Generate Support Report
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
