export interface SMSMessage {
  id: string;
  phoneNumber: string;
  message: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sentAt: string;
  consultationId?: string;
  notifyReference?: string;
}

export interface SMSSendRequest {
  phoneNumber: string;
  message: string;
  consultationId?: string;
}

export interface SMSSendResponse {
  success: boolean;
  notifyReference?: string;
  error?: string;
}

export interface NotifyResponse {
  id: string;
  reference?: string;
  content: {
    body: string;
    from_number: string;
  };
  uri: string;
  template: {
    id: string;
    version: number;
    uri: string;
  };
}
