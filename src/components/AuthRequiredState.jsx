import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AuthRequiredState({
  title,
  description,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  secondaryActionHref,
}) {
  return (
    <div className="relative min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-12 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-cyan-500/10" />
      <div className="pointer-events-none absolute -top-32 right-[-10%] h-64 w-64 rounded-full bg-blue-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 left-[-10%] h-64 w-64 rounded-full bg-cyan-500/10 blur-[120px]" />

      <Card className="relative w-full max-w-2xl border-border/60 bg-card/80 shadow-[0_32px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur">
        <CardHeader className="border-b border-border/60">
          <CardTitle className="flex items-center gap-3 text-2xl">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-200/70 to-orange-200/70 text-amber-800 shadow-inner shadow-amber-100 dark:from-amber-500/20 dark:to-orange-500/20 dark:text-amber-200">
              <ShieldAlert className="h-6 w-6" />
            </span>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-6 sm:p-8">
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{description}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              className="bg-gradient-to-r from-blue-600 via-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-cyan-700"
              onClick={onPrimaryAction}
            >
              {primaryActionLabel}
            </Button>
            {secondaryActionLabel && secondaryActionHref ? (
              <Button asChild variant="outline" className="border-border/70">
                <Link to={secondaryActionHref}>{secondaryActionLabel}</Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

AuthRequiredState.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  primaryActionLabel: PropTypes.string.isRequired,
  onPrimaryAction: PropTypes.func.isRequired,
  secondaryActionLabel: PropTypes.string,
  secondaryActionHref: PropTypes.string,
};
