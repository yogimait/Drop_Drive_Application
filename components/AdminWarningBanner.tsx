"use client"

import { AlertTriangle, ShieldAlert, RefreshCw, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useState } from "react"

interface AdminStatus {
    isElevated: boolean;
    message: string;
    guidance: string[] | null;
    capabilities: {
        canWipe: boolean;
        canPurge: boolean;
        canTestAddon: boolean;
        canDryRun: boolean;
        canViewDrives: boolean;
    };
}

interface AdminWarningBannerProps {
    adminStatus: AdminStatus | null;
    loading?: boolean;
    onRestartElevated?: () => void;
}

export function AdminWarningBanner({
    adminStatus,
    loading = false,
    onRestartElevated
}: AdminWarningBannerProps) {
    const [isRestarting, setIsRestarting] = useState(false);

    // Don't show anything while loading
    if (loading) {
        return null;
    }

    // Don't show banner if elevated or status unknown
    if (!adminStatus || adminStatus.isElevated) {
        return null;
    }

    const handleRestartClick = async () => {
        if (onRestartElevated) {
            setIsRestarting(true);
            try {
                await onRestartElevated();
            } catch (error) {
                console.error('Failed to restart with elevation:', error);
                setIsRestarting(false);
            }
        }
    };

    return (
        <Card className="border-amber-500/50 bg-amber-50/10 dark:bg-amber-950/20">
            <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                    {/* Icon and Message */}
                    <div className="flex items-start gap-3 flex-1">
                        <div className="p-2 rounded-lg bg-amber-500/20">
                            <ShieldAlert className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                Administrator Privileges Required
                            </h3>
                            <p className="text-sm text-amber-700 dark:text-amber-300">
                                {adminStatus.message}
                            </p>

                            {/* Guidance list */}
                            {adminStatus.guidance && adminStatus.guidance.length > 0 && (
                                <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-1 mt-2 list-disc list-inside">
                                    {adminStatus.guidance.map((item, index) => (
                                        <li key={index}>{item}</li>
                                    ))}
                                </ul>
                            )}

                            {/* Capabilities info */}
                            <div className="flex flex-wrap gap-2 mt-3">
                                <CapabilityBadge
                                    enabled={adminStatus.capabilities.canViewDrives}
                                    label="View Drives"
                                />
                                <CapabilityBadge
                                    enabled={adminStatus.capabilities.canDryRun}
                                    label="Dry Run"
                                />
                                <CapabilityBadge
                                    enabled={adminStatus.capabilities.canWipe}
                                    label="Wipe Drives"
                                />
                                <CapabilityBadge
                                    enabled={adminStatus.capabilities.canPurge}
                                    label="Purge Drives"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Restart Button */}
                    <div className="flex-shrink-0">
                        <Button
                            onClick={handleRestartClick}
                            disabled={isRestarting}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {isRestarting ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Restarting...
                                </>
                            ) : (
                                <>
                                    <ShieldAlert className="mr-2 h-4 w-4" />
                                    Restart as Administrator
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// Small capability badge component
function CapabilityBadge({ enabled, label }: { enabled: boolean; label: string }) {
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
      ${enabled
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
            {enabled ? (
                <CheckCircle2 className="h-3 w-3" />
            ) : (
                <AlertTriangle className="h-3 w-3" />
            )}
            {label}
        </span>
    );
}

// Export a compact version for inline use
export function AdminWarningInline({
    isElevated,
    onRestartElevated
}: {
    isElevated: boolean;
    onRestartElevated?: () => void;
}) {
    if (isElevated) {
        return null;
    }

    return (
        <div className="flex items-center gap-2 p-2 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-sm">
            <ShieldAlert className="h-4 w-4" />
            <span>Admin required for this action</span>
            {onRestartElevated && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRestartElevated}
                    className="ml-auto text-amber-700 hover:text-amber-800 hover:bg-amber-200/50"
                >
                    Restart as Admin
                </Button>
            )}
        </div>
    );
}
