import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if we have the required env vars
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

console.log('Supabase URL:', supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'NOT SET');
console.log('Supabase Key:', supabaseAnonKey ? 'SET (' + supabaseAnonKey.length + ' chars)' : 'NOT SET');

// Storage key for manual session management
export const SUPABASE_PROJECT_REF = "nnqctrjvtacswjvdgred";
export const SESSION_STORAGE_KEY = `sb-${SUPABASE_PROJECT_REF}-auth-token`;

// Session type for manual session management
interface StoredSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  token_type: string;
  user: {
    id: string;
    email?: string;
    [key: string]: unknown;
  };
}

// Get session from localStorage (manual approach)
export function getStoredSession(): StoredSession | null {
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as StoredSession;
    }
  } catch (e) {
    console.error("Error reading session from localStorage:", e);
  }
  return null;
}

// Update stored session
export function updateStoredSession(session: StoredSession) {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (e) {
    console.error("Error saving session to localStorage:", e);
  }
}

// Clear session from localStorage
export function clearStoredSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

// Check if token is expired (with 60 second buffer)
export function isTokenExpired(session: StoredSession | null): boolean {
  if (!session?.expires_at) return true;
  const expiresAt = session.expires_at * 1000; // Convert to milliseconds
  const now = Date.now();
  const buffer = 60 * 1000; // 60 second buffer
  return now >= (expiresAt - buffer);
}

// Refresh the access token using refresh_token
let isRefreshing = false;
let refreshPromise: Promise<StoredSession | null> | null = null;

export async function refreshSession(): Promise<StoredSession | null> {
  const session = getStoredSession();
  if (!session?.refresh_token) {
    console.log("No refresh token available");
    clearStoredSession();
    return null;
  }

  // If already refreshing, wait for that to complete
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      console.log("Refreshing token...");
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: session.refresh_token,
      });

      if (error || !data.session) {
        console.error("Token refresh failed:", error?.message);
        clearStoredSession();
        return null;
      }

      // Update stored session with new tokens
      const newSession = {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        expires_in: data.session.expires_in,
        token_type: data.session.token_type,
        user: data.session.user,
      };
      updateStoredSession(newSession);

      // Reset the authenticated client so it picks up the new token
      authenticatedClient = null;
      lastToken = null;

      console.log("Token refreshed successfully");
      return newSession;
    } catch (e) {
      console.error("Token refresh exception:", e);
      clearStoredSession();
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Single authenticated client instance
let authenticatedClient: ReturnType<typeof createClient> | null = null;
let lastToken: string | null = null;

// Get or create authenticated client with current token
export function getSupabase() {
  const session = getStoredSession();
  const accessToken = session?.access_token || null;

  // Create new client only if token changed or no client exists
  if (!authenticatedClient || lastToken !== accessToken) {
    lastToken = accessToken;
    authenticatedClient = createClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseAnonKey || 'placeholder-key',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: accessToken ? {
            Authorization: `Bearer ${accessToken}`,
          } : {},
        },
      }
    );
  }

  return authenticatedClient;
}

// For backwards compatibility (login/register use this without token)
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  }
);

// Database types
export interface DbProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  company_name: string;
  company_cnpj: string;
  company_address: string;
  notifications_email: boolean;
  notifications_whatsapp: boolean;
  notifications_proposal_viewed: boolean;
  notifications_proposal_approved: boolean;
  notifications_service_reminder: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbClient {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  created_at: string;
  updated_at: string;
}

export interface DbCatalogItem {
  id: string;
  user_id: string;
  name: string;
  category: string;
  image: string;
  image_url: string | null;
  prices: {
    default?: number;
    P?: number;
    M?: number;
    G?: number;
  };
  created_at: string;
  updated_at: string;
}

export interface DbProposal {
  id: string;
  user_id: string;
  client_id: string | null;
  client_name: string;
  client_email: string;
  client_phone: string;
  service_type: string;
  title: string;
  description: string;
  notes: string;
  valid_until: string;
  status: 'draft' | 'sent' | 'viewed' | 'approved' | 'expired';
  total: number;
  sent_at: string | null;
  viewed_at: string | null;
  approved_at: string | null;
  signature: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbProposalItem {
  id: string;
  proposal_id: string;
  name: string;
  description: string;
  quantity: number;
  unit_price: number;
  image_url: string | null;
  created_at: string;
}

export interface DbEvent {
  id: string;
  user_id: string;
  title: string;
  client: string;
  date: string;
  time: string;
  location: string;
  type: 'service' | 'visit' | 'meeting';
  created_at: string;
  updated_at: string;
}
