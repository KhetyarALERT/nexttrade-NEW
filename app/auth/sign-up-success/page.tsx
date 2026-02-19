import Link from "next/link";
import { Mail, TrendingUp } from "lucide-react";

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5">
          <TrendingUp className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold text-foreground">NextTrade</span>
        </div>

        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-primary/10 p-4">
            <Mail className="h-8 w-8 text-primary" />
          </div>
        </div>

        <h1 className="mb-2 text-2xl font-bold text-foreground">
          Check your email
        </h1>
        <p className="mb-8 text-muted-foreground">
          {
            "We've sent you a confirmation link. Please check your email and click the link to activate your account."
          }
        </p>

        <Link
          href="/auth/login"
          className="inline-flex rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
