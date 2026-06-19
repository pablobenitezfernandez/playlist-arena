"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";

export type Profile = {
  id: string;
  display_name: string;
  is_owner: boolean;
};

type AuthContextValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isOwner: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<boolean>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, is_owner")
      .eq("id", userId)
      .maybeSingle();

    setProfile((data as Profile) ?? null);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) {
        return;
      }

      setSession(data.session);

      if (data.session?.user) {
        await loadProfile(data.session.user.id);
      }

      setLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);

      if (nextSession?.user) {
        void loadProfile(nextSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      throw new Error(translateAuthError(error.message));
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } }
      });

      if (error) {
        throw new Error(translateAuthError(error.message));
      }

      // Sin sesión = Supabase exige confirmar el email antes de entrar.
      return !data.session;
    },
    []
  );

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const supabase = getSupabaseClient();
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/reset` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      throw new Error(translateAuthError(error.message));
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      throw new Error(translateAuthError(error.message));
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      profile,
      isOwner: profile?.is_owner ?? false,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword
    }),
    [loading, session, profile, signIn, signUp, signOut, resetPassword, updatePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>.");
  }

  return context;
}

function translateAuthError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Email o contraseña incorrectos.";
  }

  if (normalized.includes("user already registered")) {
    return "Ya existe una cuenta con ese email. Inicia sesión.";
  }

  if (normalized.includes("password should be at least")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Tienes que confirmar tu email antes de entrar (revisa tu correo).";
  }

  return message;
}
