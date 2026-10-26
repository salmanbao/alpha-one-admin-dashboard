"use client";
export default function ErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="max-w-md text-center space-y-2">
        <h1 className="text-2xl font-semibold">Something went wrong.</h1>
        <p className="text-muted-foreground">An unexpected error occurred in the console.</p>
      </div>
    </div>
  );
}
