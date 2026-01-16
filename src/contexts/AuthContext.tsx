import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getReferralCode, clearReferralCode } from '../hooks/useReferralCapture';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    // Get referral code before signup (if any)
    const referralCode = getReferralCode();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    // If signup successful and we have a referral code, store it
    if (!error && data.user && referralCode) {
      try {
        // Update user_settings with referral code after a short delay
        // (to allow the auth trigger to create the settings record first)
        setTimeout(async () => {
          const { error: settingsError } = await supabase
            .from('user_settings')
            .update({
              referral_code: referralCode,
              trial_start: new Date().toISOString(),
            })
            .eq('user_id', data.user!.id);

          if (settingsError) {
            console.error('Failed to attach referral code:', settingsError);
          } else {
            console.log(`Referral code ${referralCode} attached to user`);
            clearReferralCode(); // Clear after successful attachment
          }
        }, 1000);
      } catch (err) {
        console.error('Error attaching referral:', err);
      }
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    // Clear local state first (handles mock login scenario)
    setUser(null);
    setSession(null);
    // Also sign out from Supabase in case real auth is used
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
