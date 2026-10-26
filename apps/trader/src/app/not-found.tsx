export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="max-w-md text-center space-y-2">
        <h1 className="text-2xl font-semibold">Page not found.</h1>
        <p className="text-muted-foreground">The requested route could not be resolved.</p>
      </div>
    </div>
  );
}
