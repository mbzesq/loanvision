import { Request, Response, NextFunction } from 'express';
import { SOLEventService } from '../services/SOLEventService';
import pool from '../db';

export interface SOLEventRequest extends Request {
  triggerSOLUpdate?: boolean;
  solEvent?: {
    loan_id: number;
    event_type: 'payment_received' | 'missed_payment' | 'foreclosure_filed' | 'acceleration' | 'maturity_reached' | 'status_change';
    metadata?: any;
  };
}

const solEventService = new SOLEventService(pool);

/**
 * Middleware to automatically trigger SOL updates when loans are modified
 */
export const solEventMiddleware = async (req: SOLEventRequest, res: Response, next: NextFunction) => {
  // Continue with the original request
  next();

  // After the response is sent, trigger SOL update if requested
  if (req.triggerSOLUpdate && req.solEvent) {
    // Don't wait for this to complete - run asynchronously
    setImmediate(async () => {
      try {
        await solEventService.handleLoanEvent({
          loan_id: req.solEvent!.loan_id,
          event_type: req.solEvent!.event_type,
          event_date: new Date(),
          metadata: req.solEvent!.metadata
        });
      } catch (error) {
        console.error('SOL event processing failed:', error);
      }
    });
  }
};

/**
 * Helper function to mark a request for SOL update
 */
export const markForSOLUpdate = (
  req: SOLEventRequest, 
  loanId: number, 
  eventType: 'payment_received' | 'missed_payment' | 'foreclosure_filed' | 'acceleration' | 'maturity_reached' | 'status_change',
  metadata?: any
) => {
  req.triggerSOLUpdate = true;
  req.solEvent = {
    loan_id: loanId,
    event_type: eventType,
    metadata
  };
};

export default solEventMiddleware;