import { AuthGate } from "@/components/auth-gate";
import { PlaylistArenaApp } from "@/components/playlist-arena-app";

export default function HomePage() {
  return (
    <AuthGate>
      <PlaylistArenaApp />
    </AuthGate>
  );
}
