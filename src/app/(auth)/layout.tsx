export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <img
              src="/pec-logo.png"
              alt="Pallavi Engineering College Logo"
              className="w-40 h-40 rounded"
            />
          </div>
          <h2 className="text-sm font-bold" style={{ color: "#008A22" }}>
            Pallavi Engineering College
          </h2>
          <h1 className="text-3xl font-bold text-foreground mt-1">
            Code <span className="text-primary-light">Clash</span> 2026
          </h1>
          <p className="text-gray-400 mt-2">The Ultimate Coding Showdown</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-8 shadow-2xl">
          {children}
        </div>
      </div>
    </div>
  );
}
