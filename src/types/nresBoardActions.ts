export type BoardActionStatus = 'pending' | 'in-progress' | 'completed' | 'overdue';
export type BoardActionPriority = 'low' | 'medium' | 'high';

export interface NRESBoardAction {
  id: string;
  user_id: string;
  reference_number: string | null;
  action_title: string;
  description: string | null;
  responsible_person: string;
  meeting_date: string;
  due_date: string | null;
  status: BoardActionStatus;
  priority: BoardActionPriority;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by_email: string | null;
  updated_by_email: string | null;
  original_status: BoardActionStatus | null;
  original_status_date: string | null;
  status_changed_at: string | null;
}

export interface CreateBoardActionData {
  action_title: string;
  description?: string;
  responsible_person: string;
  meeting_date: string;
  due_date?: string;
  status: BoardActionStatus;
  priority: BoardActionPriority;
  notes?: string;
}

export interface UpdateBoardActionData extends Partial<CreateBoardActionData> {
  id: string;
}
