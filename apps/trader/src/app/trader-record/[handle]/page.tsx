import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { TraderRecordPage } from "../../../modules/record/pages/trader-record-page";

/**
 * /trader-record/[handle] — R9 W5 UC-T10. Next 16: `params` is a
 * Promise; await it on the server and hand the resolved handle to the
 * read-only record page.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TraderRecordPage handle={handle} />
    </Suspense>
  );
}
