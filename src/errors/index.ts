/**
 * Base error class for x402 payment errors
 */
export class X402Error extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number = 400) {
    super(message);
    this.name = 'X402Error';
    this.code = code;
    this.statusCode = statusCode;
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
    };
  }
}

/**
 * Thrown when user has insufficient private balance for payment
 */
export class InsufficientBalanceError extends X402Error {
  public readonly required: number;
  public readonly available: number;

  constructor(required: number, available: number = 0) {
    super(
      `Insufficient private balance. Required: ${required} lamports, Available: ${available} lamports`,
      'INSUFFICIENT_BALANCE',
      402
    );
    this.name = 'InsufficientBalanceError';
    this.required = required;
    this.available = available;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      required: this.required,
      available: this.available,
      hint: 'Please deposit more SOL into Privacy Cash pool',
    };
  }
}

/**
 * Thrown when a commitment has already been used (double-spend attempt)
 */
export class DoubleSpendError extends X402Error {
  public readonly commitment: string;

  constructor(commitment: string) {
    super(
      'Commitment already used. This payment has already been redeemed.',
      'DOUBLE_SPEND',
      402
    );
    this.name = 'DoubleSpendError';
    this.commitment = commitment;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      commitment: this.commitment.substring(0, 20) + '...',
      hint: 'Generate a new payment commitment',
    };
  }
}

/**
 * Thrown when payment verification fails
 */
export class InvalidPaymentError extends X402Error {
  public readonly reason: string;

  constructor(reason: string) {
    super(`Invalid payment: ${reason}`, 'INVALID_PAYMENT', 400);
    this.name = 'InvalidPaymentError';
    this.reason = reason;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      reason: this.reason,
    };
  }
}

/**
 * Thrown when balance proof is expired or invalid
 */
export class ExpiredBalanceProofError extends X402Error {
  public readonly proofTimestamp: number;
  public readonly currentTimestamp: number;

  constructor(proofTimestamp: number) {
    super(
      'Balance proof has expired. Please generate a new payment.',
      'EXPIRED_BALANCE_PROOF',
      402
    );
    this.name = 'ExpiredBalanceProofError';
    this.proofTimestamp = proofTimestamp;
    this.currentTimestamp = Date.now();
  }

  toJSON() {
    return {
      ...super.toJSON(),
      proofTimestamp: this.proofTimestamp,
      currentTimestamp: this.currentTimestamp,
      hint: 'Balance proofs are valid for 5 minutes',
    };
  }
}

/**
 * Thrown when network/scheme mismatch occurs
 */
export class NetworkMismatchError extends X402Error {
  public readonly expected: string;
  public readonly received: string;

  constructor(expected: string, received: string) {
    super(
      `Network mismatch. Expected: ${expected}, Received: ${received}`,
      'NETWORK_MISMATCH',
      400
    );
    this.name = 'NetworkMismatchError';
    this.expected = expected;
    this.received = received;
  }
}
