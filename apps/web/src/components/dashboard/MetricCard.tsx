"use client";

interface MetricCardProps {
    title: string;
    value: string;
    subtitle?: string;
    icon?: string;
    status?: "default" | "success" | "warning" | "danger";
}

export function MetricCard({
    title,
    value,
    subtitle,
    icon,
    status = "default",
}: MetricCardProps) {
    const statusClasses = {
        default: "border-white/10",
        success: "border-emerald-500/30",
        warning: "border-amber-500/30",
        danger: "border-red-500/30",
    };

    const statusText = {
        default: "text-white",
        success: "text-emerald-400",
        warning: "text-amber-400",
        danger: "text-red-400",
    };

    return (
        <div
            className={`rounded-2xl border bg-white/[0.03] p-5 backdrop-blur ${statusClasses[status]}`}
        >
            <div className="flex items-center justify-between">
                <p className="text-sm text-white/50">{title}</p>

                {icon && (
                    <span className="text-lg opacity-70">
                        {icon}
                    </span>
                )}
            </div>

            <div className={`mt-3 text-2xl font-semibold ${statusText[status]}`}>
                {value}
            </div>

            {subtitle && (
                <p className="mt-1 text-xs text-white/40">
                    {subtitle}
                </p>
            )}
        </div>
    );
}