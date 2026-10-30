import { useState } from "react";

export function useAuditVersion(): number {
  const [v, setV] = useState(0);
  return v;
}