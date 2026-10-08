import { redirect } from "next/navigation";

/**
 * Trader App — Route `/`
 *
 * The trader experience starts at My Workspace (trader-detail).
 */
export default function Home() {
  redirect("/trader-detail");
}
