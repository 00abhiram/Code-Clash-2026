import Link from "next/link";
import SignupForm from "@/components/auth/SignupForm";
import GoogleOAuthButton from "@/components/auth/GoogleOAuthButton";

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Create Account</h2>
        <p className="text-gray-400 text-sm mt-1">
          Register for Code Clash 2026
        </p>
      </div>

      <SignupForm />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-surface text-gray-400">or</span>
        </div>
      </div>

      <GoogleOAuthButton />

      <p className="text-center text-sm text-gray-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-primary-light hover:text-primary font-medium transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
