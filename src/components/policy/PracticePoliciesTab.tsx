import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Search,
  Download,
  FileText,
  Calendar,
  Eye,
  Loader2,
  Building2,
  Shield,
  Lock,
  Edit3,
} from 'lucide-react';
import { PolicyCompletion } from '@/hooks/usePolicyCompletions';
import { PolicyAccessLevel } from '@/hooks/usePolicyLibraryAccess';
import { generatePolicyDocx } from '@/utils/generatePolicyDocx';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { ManagePolicyAccessModal } from './ManagePolicyAccessModal';
import { PracticeUserWithAccess } from '@/hooks/usePolicyLibraryAccess';

interface PracticePoliciesTabProps {
  practiceName: string | null;
  policies: PolicyCompletion[];
  accessLevel: PolicyAccessLevel | null;
  isPracticeManager: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isLoading: boolean;
  // PM access management
  practiceUsers: PracticeUserWithAccess[];
  isLoadingUsers: boolean;
  onSaveAccess: (changes: Array<{ userId: string; accessLevel: PolicyAccessLevel }>) => Promise<boolean>;
}

export const PracticePoliciesTab: React.FC<PracticePoliciesTabProps> = ({
  practiceName,
  policies,
  accessLevel,
  isPracticeManager,
  canEdit,
  canDelete,
  isLoading,
  practiceUsers,
  isLoadingUsers,
  onSaveAccess,
}) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAccessModal, setShowAccessModal] = useState(false);

  const filteredPolicies = policies.filter(p =>
    p.policy_title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDownload = async (policy: PolicyCompletion) => {
    try {
      const metadata = {
        title: policy.metadata?.title || policy.policy_title,
        version: policy.version || '1.0',
        effective_date: policy.effective_date,
        review_date: policy.review_date,
        references: policy.metadata?.references || [],
      };
      await generatePolicyDocx(policy.policy_content, metadata, policy.policy_title);
      toast.success('Policy downloaded');
    } catch {
      toast.error('Failed to download policy');
    }
  };

  const handleView = (policy: PolicyCompletion) => {
    navigate(`/policy-service/view/${policy.id}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading practice policies…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-lg font-semibold">{practiceName || 'Practice'} Policy Library</h3>
            <p className="text-sm text-muted-foreground">
              {isPracticeManager ? (
                'You are the Practice Manager — full control'
              ) : accessLevel === 'edit' ? (
                'You have edit access to this library'
              ) : (
                'You have read-only access to this library'
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isPracticeManager && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAccessModal(true)}
              className="gap-2"
            >
              <Shield className="h-4 w-4" />
              Manage Access
            </Button>
          )}
        </div>
      </div>

      {/* Access level indicator */}
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={
            isPracticeManager
              ? 'bg-primary/10 text-primary border-primary/30'
              : accessLevel === 'edit'
              ? 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200'
              : 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200'
          }
        >
          {isPracticeManager ? (
            <>
              <Shield className="h-3 w-3 mr-1" /> Practice Manager
            </>
          ) : accessLevel === 'edit' ? (
            <>
              <Edit3 className="h-3 w-3 mr-1" /> Edit Access
            </>
          ) : (
            <>
              <Lock className="h-3 w-3 mr-1" /> Read Only
            </>
          )}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {filteredPolicies.length} {filteredPolicies.length === 1 ? 'policy' : 'policies'}
        </span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search practice policies…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Policies list */}
      {filteredPolicies.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No practice policies found</p>
          {isPracticeManager ? (
            <p className="text-sm mt-1">
              Policies you create will appear here for your practice team.
            </p>
          ) : (
            <p className="text-sm mt-1">
              Your Practice Manager hasn't shared any policies yet.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredPolicies.map(policy => (
            <Card key={policy.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm truncate">{policy.policy_title}</h4>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <Badge variant="secondary" className="text-xs">
                        v{policy.version || '1.0'}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Review: {format(parseISO(policy.review_date), 'dd MMM yyyy')}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleView(policy)}
                      className="gap-1.5"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(policy)}
                      className="gap-1.5"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                    {canEdit && (
                      <Button
                        size="sm"
                        onClick={() => navigate(`/policy-service/view/${policy.id}`)}
                        className="gap-1.5"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Access management modal */}
      {isPracticeManager && (
        <ManagePolicyAccessModal
          open={showAccessModal}
          onOpenChange={setShowAccessModal}
          practiceName={practiceName}
          practiceUsers={practiceUsers}
          isLoadingUsers={isLoadingUsers}
          onSave={onSaveAccess}
        />
      )}
    </div>
  );
};
