// Payment processing module

type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

export function getPaymentInfo(status: PaymentStatus) {
  const statusLabel =
    status === 'pending' ? 'Awaiting payment'
    : status === 'processing' ? 'Processing payment'
    : status === 'completed' ? 'Payment received'
    : status === 'failed' ? 'Payment failed'
    : 'Payment refunded';

  return { statusLabel };
}
