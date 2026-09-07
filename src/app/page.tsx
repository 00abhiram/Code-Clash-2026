import Link from "next/link";
import { Code2, Timer, Shield, Trophy } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="border-b border-border bg-surface/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="w-8 h-8 text-primary-light" />
            <span className="text-xl font-bold text-foreground">
              Code <span className="text-primary-light">Clash</span> 2026
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="px-4 py-2 text-gray-300 hover:text-foreground transition-colors font-medium"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 bg-primary hover:bg-primary-light text-white rounded-lg transition-colors font-medium"
            >
              Register
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 border border-primary/30 rounded-full text-primary-light text-sm font-medium mb-6">
            <Timer className="w-4 h-4" />
            Friday, 7th August 2026
          </div>

          <h1 className="text-5xl sm:text-7xl font-bold text-foreground mb-6">
            The Ultimate
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-light to-accent">
              Coding Showdown
            </span>
          </h1>

          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            Choose your battle. Participate freely in Test-Driven Development,
            Code Debugging, or both! 30 minutes per format. Compete against the
            best minds in the college.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="px-8 py-3 bg-primary hover:bg-primary-light text-white rounded-lg transition-colors font-semibold text-lg"
            >
              Register Now
            </Link>
            <Link
              href="#schedule"
              className="px-8 py-3 border border-border hover:bg-surface text-gray-300 rounded-lg transition-colors font-semibold text-lg"
            >
              View Schedule
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-24">
          <div className="bg-surface border border-border rounded-2xl p-8 text-center hover:border-primary/50 transition-colors">
            <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Code2 className="w-7 h-7 text-primary-light" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">
              Test-Driven Development
            </h3>
            <p className="text-gray-400">
              Write test-driven code to solve DSA problems. Pass hidden test cases to score.
            </p>
            <div className="mt-4 text-sm text-accent font-medium">
              1:45 PM IST — 30 minutes
            </div>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-8 text-center hover:border-primary/50 transition-colors">
            <div className="w-14 h-14 bg-accent/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Shield className="w-7 h-7 text-accent" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">
              Code Debugging
            </h3>
            <p className="text-gray-400">
              Find and fix bugs in pre-written code. Sharp eye and logic win here.
            </p>
            <div className="mt-4 text-sm text-accent font-medium">
              2:30 PM IST — 30 minutes
            </div>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-8 text-center hover:border-primary/50 transition-colors">
            <div className="w-14 h-14 bg-warning/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-7 h-7 text-warning" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">
              Dual Leaderboards
            </h3>
            <p className="text-gray-400">
              Separate rankings for TDD and Debugging. Individual winners declared for each format.
            </p>
            <div className="mt-4 text-sm text-accent font-medium">
              Ranked by performance
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div id="schedule" className="mt-24">
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">
            Event Schedule
          </h2>
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex items-center gap-6 bg-surface border border-border rounded-xl p-6">
              <div className="text-right min-w-[120px]">
                <div className="text-lg font-bold text-primary-light">1:45 PM</div>
                <div className="text-sm text-gray-400">IST</div>
              </div>
              <div className="w-px h-12 bg-border" />
              <div>
                <div className="font-semibold text-foreground">Test-Driven Development</div>
                <div className="text-sm text-gray-400">Write code to pass hidden test cases — 30 minutes</div>
              </div>
            </div>

            <div className="flex items-center gap-6 bg-surface border border-border rounded-xl p-6">
              <div className="text-right min-w-[120px]">
                <div className="text-lg font-bold text-accent">2:15 PM</div>
                <div className="text-sm text-gray-400">IST</div>
              </div>
              <div className="w-px h-12 bg-border" />
              <div>
                <div className="font-semibold text-foreground">Break</div>
                <div className="text-sm text-gray-400">15 minutes between formats</div>
              </div>
            </div>

            <div className="flex items-center gap-6 bg-surface border border-border rounded-xl p-6">
              <div className="text-right min-w-[120px]">
                <div className="text-lg font-bold text-accent">2:30 PM</div>
                <div className="text-sm text-gray-400">IST</div>
              </div>
              <div className="w-px h-12 bg-border" />
              <div>
                <div className="font-semibold text-foreground">Code Debugging</div>
                <div className="text-sm text-gray-400">Fix bugs in pre-written code — 30 minutes</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-20 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          Code Clash 2026 — Pallavi Engineering College
        </div>
      </footer>
    </div>
  );
}
