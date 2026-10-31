"use client";

import { PageSkeleton } from "@/components/shell/page-skeleton";
import { AnnouncementsPage } from "../../modules/announcements/pages/announcements-page";
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AnnouncementsPage />
    </Suspense>
  );
}