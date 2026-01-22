import PropTypes from "prop-types";
import { CheckCircle2, Clock, XCircle, AlertCircle, Rocket } from "lucide-react";

/**
 * TradingAccountStepper - DB-driven stepper for Trading Account Request flow
 * 
 * Step mapping based on existing entity fields (NO new enums):
 * 
 * Step 1: KYC Verified
 *   ✅ if VerificationRequest.status === 'approved'
 *   ⏳ if VerificationRequest.status === 'pending' | 'under_review' | 'needs_help' OR no record
 *   ❌ if VerificationRequest.status === 'rejected'
 * 
 * Step 2: Request Form Submitted
 *   ✅ if LiveAccountRequest exists (record created = form submitted)
 *   ⏳ if no LiveAccountRequest exists
 * 
 * Step 3: Admin Review
 *   ⏳ Under review if: LiveAccountRequest exists AND reviewed_at is null
 *   ✅ Approved if: reviewed_at is not null AND rejection_reason is null/empty AND (status === 'assigned' OR assigned_at/assigned_pool_account_id exists)
 *   ❌ Rejected if: reviewed_at is not null AND rejection_reason has value
 * 
 * Step 4: Trading Account Ready
 *   ✅ if: status === 'assigned' OR assigned_at is not null OR assigned_pool_account_id is not null
 */
export default function TradingAccountStepper({ 
  language = "en", 
  isVerified = false, 
  existingRequest = null 
}) {
  // Derive step statuses from DB data
  const getStepStatuses = () => {
    // Step 1: KYC Verification
    const step1 = {
      done: isVerified,
      pending: !isVerified,
      rejected: false // We don't have rejection info passed here; parent handles it
    };

    // Step 2: Form Submitted - a LiveAccountRequest record exists
    const hasRequest = !!existingRequest;
    const step2 = {
      done: hasRequest,
      pending: !hasRequest
    };

    // Step 3: Admin Review
    const reviewedAt = existingRequest?.reviewed_at;
    const rejectionReason = existingRequest?.rejection_reason;
    const status = existingRequest?.status;
    const assignedAt = existingRequest?.assigned_at;
    const assignedPoolAccountId = existingRequest?.assigned_pool_account_id;
    
    const isAssigned = status === 'assigned' || !!assignedAt || !!assignedPoolAccountId;
    const isRejected = !!reviewedAt && !!rejectionReason;
    const isApproved = !!reviewedAt && !rejectionReason && isAssigned;
    const isUnderReview = hasRequest && !reviewedAt;

    const step3 = {
      done: isApproved,
      pending: isUnderReview,
      rejected: isRejected,
      rejectionReason: rejectionReason
    };

    // Step 4: Trading Account Ready
    const step4 = {
      done: isAssigned,
      pending: !isAssigned && hasRequest && !isRejected
    };

    return { step1, step2, step3, step4 };
  };

  const { step1, step2, step3, step4 } = getStepStatuses();

  const steps = [
    { 
      step: 1, 
      label: language === 'ar' ? 'تحقق من هويتك' : 'Verify your identity (KYC)', 
      done: step1.done,
      pending: step1.pending,
      rejected: step1.rejected
    },
    { 
      step: 2, 
      label: language === 'ar' ? 'أكمل نموذج الطلب' : 'Complete the request form', 
      done: step2.done,
      pending: step2.pending
    },
    { 
      step: 3, 
      label: language === 'ar' ? 'انتظر الموافقة' : 'Wait for approval', 
      done: step3.done,
      pending: step3.pending,
      rejected: step3.rejected,
      rejectionReason: step3.rejectionReason
    },
    { 
      step: 4, 
      label: language === 'ar' ? 'ابدأ التداول!' : 'Start trading!', 
      done: step4.done,
      pending: step4.pending
    }
  ];

  // Determine current active step (first non-done step)
  const currentStepIndex = steps.findIndex(s => !s.done && !s.rejected);

  const getStepIcon = (item, index) => {
    if (item.done) {
      return <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4" />;
    }
    if (item.rejected) {
      return <XCircle className="h-3 w-3 sm:h-4 sm:w-4" />;
    }
    if (item.pending && index === currentStepIndex) {
      return <Clock className="h-3 w-3 sm:h-4 sm:w-4 animate-pulse" />;
    }
    return item.step;
  };

  const getStepStyles = (item, index) => {
    if (item.done) {
      return 'bg-emerald-500 text-white';
    }
    if (item.rejected) {
      return 'bg-rose-500 text-white';
    }
    if (item.pending && index === currentStepIndex) {
      return 'bg-blue-500 text-white';
    }
    return 'bg-muted text-muted-foreground';
  };

  const getTextStyles = (item) => {
    if (item.done) {
      return 'text-emerald-600 dark:text-emerald-400';
    }
    if (item.rejected) {
      return 'text-rose-600 dark:text-rose-400';
    }
    return 'text-muted-foreground';
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {language === 'ar' ? 'الخطوات' : 'Steps to Get Started'}
      </p>
      <div className="space-y-1.5 sm:space-y-2">
        {steps.map((item, index) => (
          <div key={item.step}>
            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
              <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-medium flex-shrink-0 transition-all duration-300 ${getStepStyles(item, index)}`}>
                {getStepIcon(item, index)}
              </div>
              <span className={`truncate transition-colors duration-300 ${getTextStyles(item)}`}>
                {item.label}
              </span>
            </div>
            {/* Show rejection reason for Step 3 if rejected */}
            {item.rejected && item.rejectionReason && (
              <div className="ml-7 sm:ml-9 mt-1 p-2 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-xs text-rose-600 dark:text-rose-400">
                <span className="font-medium">{language === 'ar' ? 'السبب: ' : 'Reason: '}</span>
                {item.rejectionReason}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

TradingAccountStepper.propTypes = {
  language: PropTypes.string,
  isVerified: PropTypes.bool,
  existingRequest: PropTypes.shape({
    status: PropTypes.string,
    reviewed_at: PropTypes.string,
    rejection_reason: PropTypes.string,
    assigned_at: PropTypes.string,
    assigned_pool_account_id: PropTypes.string
  })
};