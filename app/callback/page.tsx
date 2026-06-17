import { Suspense } from "react";
import { SpotifyCallbackPage } from "@/components/spotify-callback-page";

export default function CallbackPage() {
  return (
    <Suspense fallback={null}>
      <SpotifyCallbackPage />
    </Suspense>
  );
}
