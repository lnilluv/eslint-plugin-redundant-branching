// Payment processing module

type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

export function getPaymentInfo(status: PaymentStatus) {
  const statusLabel =
    status === 'pending' ? 'Awaiting payment'
    : status === 'processing' ? 'Processing payment'
    : status === 'completed' ? 'Payment received'
    : status === 'failed' ? 'Payment failed'
    : 'Payment refunded';

  const statusColor =
    status === 'pending' ? '#F59E0B'
    : status === 'processing' ? '#3B82F6'
    : status === 'completed' ? '#22C55E'
    : status === 'failed' ? '#EF4444'
    : '#8B5CF6';

  return { statusLabel, statusColor };
}
