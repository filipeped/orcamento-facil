-- Adicionar novos tipos de notificação para cupons de trial
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
  type = ANY (ARRAY[
    'proposal_viewed', 'proposal_approved', 'proposal_expired',
    'proposal_reminder', 'proposal_pending_approval',
    'payment_confirmed', 'payment_overdue',
    'plan_expired', 'plan_upgraded', 'plan_downgraded',
    'plan_expiring_soon', 'plan_expiring_coupon',
    'trial_ending_coupon', 'trial_expired_coupon',
    'recurring_proposal',
    'system'
  ]::text[])
);
