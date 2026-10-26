export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="max-w-md text-center space-y-2">
        <h1 className="text-2xl font-semibold">View not found.</h1>
        <p className="text-muted-foreground">The requested console view could not be resolved.</p>
      </div>
    </div>
  );
}
