import PropTypes from "prop-types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Clock, Gift, AlertCircle, CheckCircle2, XCircle, Loader2, Calendar } from "lucide-react";
import UsdtIcon from "@/components/ui/UsdtIcon";

const t = {
  en: {
    days: "days",
    earned: "Earned",
    accrualPending: "Accrual pending",
    lastUpdated: "Last updated",
    endsIn: "Ends in",
    waitingApproval: "Awaiting approval",
    cancel: "Cancel",
    bonusRewards: "Bonus",
    startedOn: "Started",
    completedOn: "Completed",
    rejectedReason: "Reason"
  },
  ar: {
    days: "يوم",
    earned: "المكتسب",
    accrualPending: "الاحتساب معلق",
    lastUpdated: "آخر تحديث",
    endsIn: "ينتهي في",
    waitingApproval: "بانتظار الموافقة",
    cancel: "إلغاء",
    bonusRewards: "المكافأة",
    startedOn: "بدأ في",
    completedOn: "اكتمل في",
    rejectedReason: "السبب"
  }
};

const STATUS_CONFIG = {
  PENDING_LOCK: { color: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: Loader2, spin: true },
  PENDING_APPROVAL: { color: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: Clock },
  ACTIVE: { color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: CheckCircle2 },
  REJECTED: { color: "bg-red-500/10 text-red-600 border-red-500/30", icon: XCircle },
  CANCELLED: { color: "bg-muted text-muted-foreground border-border", icon: XCircle },
  COMPLETED: { color: "bg-blue-500/10 text-blue-600 border-blue-500/30", icon: CheckCircle2 },
  UNLOCKING: { color: "bg-purple-500/10 text-purple-600 border-purple-500/30", icon: Loader2, spin: true },
};

function formatUsdt(val) {
  if (val === null || val === undefined || !Number.isFinite(val)) return "0.00";
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatDaysRemaining(endsAt) {
  if (!endsAt) return null;
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function StakingPositionCard({ position, onCancel, language = "en" }) {
  const labels = t[language] || t.en;
  const statusConfig = STATUS_CONFIG[position.status] || STATUS_CONFIG.PENDING_APPROVAL;
  const StatusIcon = statusConfig.icon;

  const daysRemaining = formatDaysRemaining(position.endsAt);
  const progressPercent = position.status === "ACTIVE" && position.termDays > 0
    ? Math.min(100, Math.max(0, ((position.termDays - (daysRemaining || 0)) / position.termDays) * 100))
    : 0;

  const accruedAmount = position.accruedAmount || 0;
  const hasRealAccrual = accruedAmount > 0;

  return (
    <Card className={`overflow-hidden transition-all ${position.status === "ACTIVE" ? "border-emerald-500/30" : ""}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header: Amount + Status */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <UsdtIcon size="md" language={language} />
            <div>
              <p className="font-mono font-bold text-lg text-foreground">
                {formatUsdt(position.principal)}
                <span className="text-sm font-normal text-muted-foreground ml-1">USDT</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {position.planKey} • {position.apyPercent}% APY • {position.termDays}d
              </p>
            </div>
          </div>
          
          <Badge className={`${statusConfig.color} gap-1`}>
            <StatusIcon className={`w-3 h-3 ${statusConfig.spin ? "animate-spin" : ""}`} />
            {position.status.replace("_", " ")}
          </Badge>
        </div>

        {/* Active: Progress + Earned */}
        {position.status === "ACTIVE" && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                <span>{labels.endsIn}: <strong className="text-foreground">{daysRemaining}</strong> {labels.days}</span>
              </div>
              <div className="text-right">
                {hasRealAccrual ? (
                  <span className="text-emerald-600 font-semibold">+${formatUsdt(accruedAmount)} {labels.earned}</span>
                ) : (
                  <span className="text-muted-foreground text-xs">{labels.accrualPending}</span>
                )}
              </div>
            </div>
            <Progress value={progressPercent} className="h-2" />
            {position.lastAccrualAt && (
              <p className="text-[10px] text-muted-foreground">
                {labels.lastUpdated}: {formatDate(position.lastAccrualAt)}
              </p>
            )}
          </div>
        )}

        {/* Pending: Awaiting approval message */}
        {(position.status === "PENDING_APPROVAL" || position.status === "PENDING_LOCK") && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-600">
              <Clock className="w-4 h-4" />
              <span className="text-sm">{labels.waitingApproval}</span>
            </div>
            {onCancel && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onCancel(position.id)} 
                className="text-xs text-muted-foreground h-7 px-2"
              >
                {labels.cancel}
              </Button>
            )}
          </div>
        )}

        {/* Completed: Show completion date */}
        {position.status === "COMPLETED" && position.endsAt && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
            <span>{labels.completedOn}: {formatDate(position.endsAt)}</span>
          </div>
        )}

        {/* Rejected: Show reason */}
        {position.status === "REJECTED" && position.rejectReason && (
          <div className="flex items-start gap-2 p-2 bg-red-500/5 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-600">
              <strong>{labels.rejectedReason}:</strong> {position.rejectReason}
            </p>
          </div>
        )}

        {/* Rewards badge */}
        {position.rewardsGranted > 0 && (
          <div className="flex items-center gap-1.5 text-primary text-sm">
            <Gift className="w-4 h-4" />
            <span>+{position.rewardsGranted} {labels.bonusRewards}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

StakingPositionCard.propTypes = {
  position: PropTypes.shape({
    id: PropTypes.string,
    planKey: PropTypes.string,
    principal: PropTypes.number,
    apyPercent: PropTypes.number,
    termDays: PropTypes.number,
    status: PropTypes.string,
    startedAt: PropTypes.string,
    endsAt: PropTypes.string,
    accruedAmount: PropTypes.number,
    lastAccrualAt: PropTypes.string,
    rewardsGranted: PropTypes.number,
    rejectReason: PropTypes.string
  }).isRequired,
  onCancel: PropTypes.func,
  language: PropTypes.oneOf(["en", "ar"])
};