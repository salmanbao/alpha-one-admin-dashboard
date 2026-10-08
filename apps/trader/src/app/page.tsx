import { redirect } from "next/navigation";

/**
 * Terra Trader App — Route `/`
 *
 * The trader experience starts at the Terra Dashboard.
 */
export default function Home() {
  redirect("/dashboard");
}
