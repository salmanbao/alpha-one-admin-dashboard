"use client";
export default function ErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="max-w-md text-center space-y-2">
        <h1 className="text-2xl font-semibold">Something went wrong.</h1>
        <p className="text-muted-foreground">An unexpected error occurred in the console.</p>
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => window.history.back()} className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/80">Go Back</button>
          <button onClick={() => window.location.reload()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Try Again</button>
        </div>
      </div>
    </div>
  );
}
