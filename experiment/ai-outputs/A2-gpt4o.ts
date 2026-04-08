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
    : status === 'completed' ? '#10B981'
    : status === 'failed' ? '#EF4444'
    : '#6B7280';

  return { statusLabel, statusColor };
}
