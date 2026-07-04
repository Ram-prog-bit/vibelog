import { SessionClient } from "./client";

export const metadata = { title: "Session" };

// Live session ids come from the CLI at runtime, so this route is fully dynamic.
export default function SessionPage() {
  return <SessionClient />;
}
