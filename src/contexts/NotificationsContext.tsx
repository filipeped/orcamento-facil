import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "./AuthContext";

export interface Notification {
  id: string;
  type: "proposal_viewed" | "proposal_approved" | "proposal_expired" | "payment_confirmed" | "payment_overdue" | "plan_expired" | "plan_upgraded" | "system";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  metadata?: {
    proposalId?: string;
    proposalTitle?: string;
    clientName?: string;
    plan?: string;
    amount?: number;
  };
}

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  createNotification: (data: Omit<Notification, "id" | "createdAt" | "read">) => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = async () => {
    if (!user) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await getSupabase()
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const mapped: Notification[] = (data || []).map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        read: n.read,
        createdAt: n.created_at,
        metadata: n.metadata,
      }));

      setNotifications(mapped);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // 🔔 Realtime: escutar novas notificações
    if (!user) return;

    const channel = getSupabase()
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as {
            id: string;
            type: Notification['type'];
            title: string;
            message: string;
            read: boolean;
            created_at: string;
            metadata?: Notification['metadata'];
          };

          // Adicionar nova notificação no topo
          setNotifications((prev) => [
            {
              id: n.id,
              type: n.type,
              title: n.title,
              message: n.message,
              read: n.read,
              createdAt: n.created_at,
              metadata: n.metadata,
            },
            ...prev,
          ]);
        }
      )
      .subscribe();

    return () => {
      getSupabase().removeChannel(channel);
    };
  }, [user]);

  const refreshNotifications = async () => {
    await fetchNotifications();
  };

  const markAsRead = async (id: string) => {
    try {
      await getSupabase()
        .from("notifications")
        .update({ read: true })
        .eq("id", id);

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      await getSupabase()
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  const createNotification = async (data: Omit<Notification, "id" | "createdAt" | "read">) => {
    if (!user) return;

    try {
      const { data: newNotification, error } = await getSupabase()
        .from("notifications")
        .insert({
          user_id: user.id,
          type: data.type,
          title: data.title,
          message: data.message,
          metadata: data.metadata,
          read: false,
        })
        .select()
        .single();

      if (error) throw error;

      if (newNotification) {
        setNotifications((prev) => [
          {
            id: newNotification.id,
            type: newNotification.type,
            title: newNotification.title,
            message: newNotification.message,
            read: newNotification.read,
            createdAt: newNotification.created_at,
            metadata: newNotification.metadata,
          },
          ...prev,
        ]);
      }
    } catch (error) {
      console.error("Error creating notification:", error);
    }
  };

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        createNotification,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationsProvider");
  }
  return context;
}

// Helper function to create notification when proposal is viewed (called from API/backend)
export async function createProposalViewedNotification(
  userId: string,
  proposalId: string,
  proposalTitle: string,
  clientName: string
) {
  try {
    await getSupabase().from("notifications").insert({
      user_id: userId,
      type: "proposal_viewed",
      title: "Proposta Visualizada",
      message: `${clientName} visualizou a proposta "${proposalTitle}"`,
      metadata: {
        proposalId,
        proposalTitle,
        clientName,
      },
      read: false,
    });
  } catch (error) {
    console.error("Error creating proposal viewed notification:", error);
  }
}

// Helper function to create notification when proposal is approved
export async function createProposalApprovedNotification(
  userId: string,
  proposalId: string,
  proposalTitle: string,
  clientName: string
) {
  try {
    await getSupabase().from("notifications").insert({
      user_id: userId,
      type: "proposal_approved",
      title: "Proposta Aprovada! 🎉",
      message: `${clientName} aprovou a proposta "${proposalTitle}"`,
      metadata: {
        proposalId,
        proposalTitle,
        clientName,
      },
      read: false,
    });
  } catch (error) {
    console.error("Error creating proposal approved notification:", error);
  }
}
