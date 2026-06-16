import { Suspense } from "react";
import ConsumerNoticeSignClient from "./sign-client";

export const dynamic = "force-dynamic";

export default function ConsumerNoticeSignPage() {
  return (
    <Suspense fallback={<div className="sign-shell">Loading signing page...</div>}>
      <ConsumerNoticeSignClient />
    </Suspense>
  );
}
