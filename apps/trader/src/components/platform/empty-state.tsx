"use client";

import Link from "next/link";
import { TerraEmpty } from "@/components/terra/terra-ui";

export function TraderEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 space-y-4">
      <TerraEmpty title="No challenges yet" />
      <p className="text-sm text-muted-foreground">
        Browse available trading challenges to get started
      </p>
      <Link href="/marketplace" className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary hover:bg-primary/90">
        View Challenges
      </Link>
    </div>
  );
}