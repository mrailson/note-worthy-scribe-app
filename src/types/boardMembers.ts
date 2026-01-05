export interface BoardMember {
  id: string;
  user_id: string;
  name: string;
  role: string | null;
  group_name: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateBoardMemberData {
  name: string;
  role?: string;
  group_name?: string;
  email?: string;
  is_active?: boolean;
}

export interface UpdateBoardMemberData extends Partial<CreateBoardMemberData> {
  id: string;
}

export interface BoardActionDocument {
  id: string;
  action_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}
