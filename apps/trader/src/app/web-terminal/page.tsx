import { Suspense } from "react";
import { WebTerminalPage } from "../../modules/trading/pages/web-terminal-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <WebTerminalPage />
    </Suspense>
  );
}
