import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { CompetitionDetailPage } from "../../../modules/community/pages/competition-detail-page";

/**
 * /competitions/[id] — Next 16: `params` is a Promise. Await it on the
 * server and hand the resolved id to the client page.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CompetitionDetailPage id={id} />
    </Suspense>
  );
}
