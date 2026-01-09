import { useState, useMemo } from 'react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  Users, 
  UserCheck, 
  UserX,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ChevronDown,
  Award,
  Briefcase,
  GraduationCap,
  Stethoscope,
  MessageSquare,
  Clock,
  Calendar,
  Star
} from "lucide-react";
import {
  gpRecruitmentSummary,
  allGPCandidates,
  gpScoringCriteria,
  getStronglyRecommendedGPCandidates,
  getRecommendedGPCandidates,
  getNotShortlistedGPCandidates,
  GPCandidate
} from "@/data/nresGPRecruitmentData";
import { useCandidateFeedback } from '@/hooks/useCandidateFeedback';
import { CandidateFeedbackButton } from './CandidateFeedbackButton';
import { CandidateFeedbackModal } from './CandidateFeedbackModal';
import { FeedbackSummaryCard } from './FeedbackSummaryCard';

const getScoreColor = (score: number, maxScore: number = 10) => {
  const percentage = (score / maxScore) * 100;
  if (percentage >= 80) return 'bg-green-100 text-green-800 border-green-200';
  if (percentage >= 60) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-red-100 text-red-800 border-red-200';
};

const getRecommendationBadge = (recommendation: GPCandidate['recommendation']) => {
  switch (recommendation) {
    case 'strongly-recommend':
      return <Badge className="bg-green-600 text-white">Strongly Recommend</Badge>;
    case 'recommend':
      return <Badge className="bg-green-500 text-white">Recommend</Badge>;
    case 'consider':
      return <Badge className="bg-amber-500 text-white">Consider</Badge>;
    case 'do-not-shortlist':
      return <Badge className="bg-red-500 text-white">Do Not Shortlist</Badge>;
  }
};

const getRecommendationText = (recommendation: GPCandidate['recommendation']) => {
  switch (recommendation) {
    case 'strongly-recommend':
      return 'Strongly Recommend';
    case 'recommend':
      return 'Recommend - Invite to Interview';
    case 'consider':
      return 'Consider';
    case 'do-not-shortlist':
      return 'Do Not Shortlist';
  }
};

const GPCandidateDetailCard = ({ candidate }: { candidate: GPCandidate }) => {
  return (
    <div className="space-y-4">
      {/* Qualifications Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <div className="flex items-center gap-2 text-slate-600 mb-1">
            <Award className="w-4 h-4" />
            <span className="text-xs font-medium">GMC Registration</span>
          </div>
          <p className="font-semibold text-sm">{candidate.gmcNumber}</p>
          {candidate.gmcDetails && (
            <p className="text-xs text-slate-500">{candidate.gmcDetails}</p>
          )}
        </div>
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <div className="flex items-center gap-2 text-slate-600 mb-1">
            <GraduationCap className="w-4 h-4" />
            <span className="text-xs font-medium">CCT Status</span>
          </div>
          <p className="font-semibold text-sm">{candidate.cctStatus}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <div className="flex items-center gap-2 text-slate-600 mb-1">
            <Stethoscope className="w-4 h-4" />
            <span className="text-xs font-medium">Primary Qualification</span>
          </div>
          <p className="font-semibold text-sm">{candidate.primaryQualification}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <div className="flex items-center gap-2 text-slate-600 mb-1">
            <Briefcase className="w-4 h-4" />
            <span className="text-xs font-medium">Experience</span>
          </div>
          <p className="font-semibold text-sm">{candidate.experience}</p>
        </div>
      </div>

      {/* Additional Qualifications */}
      {candidate.additionalQualifications.length > 0 && (
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <h5 className="font-semibold text-blue-900 mb-2">Additional Qualifications</h5>
          <div className="flex flex-wrap gap-1">
            {candidate.additionalQualifications.map((qual, idx) => (
              <Badge key={idx} variant="outline" className="bg-white text-blue-700 border-blue-300 text-xs">
                {qual}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Current Role & Settings */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <h5 className="font-semibold text-blue-900 mb-2">Current Role</h5>
        <p className="text-sm text-blue-800">{candidate.currentRole}</p>
        <div className="flex flex-wrap gap-1 mt-2">
          {candidate.settings.map((setting, idx) => (
            <Badge key={idx} variant="outline" className="bg-white text-blue-700 border-blue-300 text-xs">
              {setting}
            </Badge>
          ))}
        </div>
      </div>

      {/* Key Roles */}
      {candidate.keyRoles.length > 0 && (
        <div>
          <h5 className="font-semibold text-slate-900 mb-2">Key Roles & Responsibilities</h5>
          <ul className="space-y-1">
            {candidate.keyRoles.map((role, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-[#005EB8] mt-1.5 flex-shrink-0" />
                {role}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Scoring Breakdown */}
      <div>
        <h5 className="font-semibold text-slate-900 mb-3">Scoring Breakdown</h5>
        <div className="space-y-2">
          {candidate.scoringBreakdown.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <div className="w-32 text-xs font-medium text-slate-600 truncate">
                {item.criterion}
              </div>
              <div className="flex-1">
                <Progress 
                  value={(item.score / item.maxScore) * 100} 
                  className="h-2"
                />
              </div>
              <div className={`w-8 text-center text-xs font-bold rounded px-1 py-0.5 ${getScoreColor(item.score, item.maxScore)}`}>
                {item.score}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Strengths & Concerns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {candidate.strengths.length > 0 && (
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <h5 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Strengths
            </h5>
            <ul className="space-y-1">
              {candidate.strengths.map((strength, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-green-700">
                  <span className="text-green-500">✓</span>
                  {strength}
                </li>
              ))}
            </ul>
          </div>
        )}
        {candidate.concerns.length > 0 && (
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
            <h5 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Considerations
            </h5>
            <ul className="space-y-1">
              {candidate.concerns.map((concern, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-amber-700">
                  <span className="text-amber-500">!</span>
                  {concern}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Interview Questions */}
      {candidate.interviewQuestions.length > 0 && (
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <h5 className="font-semibold text-purple-800 mb-2 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Suggested Interview Questions
          </h5>
          <ol className="space-y-2">
            {candidate.interviewQuestions.map((question, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-purple-700">
                <span className="font-semibold">{idx + 1}.</span>
                {question}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

export const GPRecruitmentPanel = () => {
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<GPCandidate | null>(null);
  const { profile } = useUserProfile();
  
  // ICB members can view feedback but cannot submit
  const canSubmitFeedback = !profile?.northamptonshire_icb_active;
  
  const stronglyRecommended = getStronglyRecommendedGPCandidates();
  const recommended = getRecommendedGPCandidates();
  const notShortlisted = getNotShortlistedGPCandidates();

  // Sort candidates by recommendation status
  const sortedCandidates = [...stronglyRecommended, ...recommended, ...notShortlisted];

  // Get all candidate IDs for feedback hook
  const candidateIds = useMemo(() => allGPCandidates.map(c => c.id), []);
  
  const {
    isLoading: feedbackLoading,
    isSubmitting,
    getFeedbackForCandidate,
    getUserFeedbackForCandidate,
    getCandidateStats,
    getSummary,
    submitFeedback,
    deleteFeedback,
  } = useCandidateFeedback('GP', candidateIds);

  const handleOpenFeedback = (candidate: GPCandidate) => {
    setSelectedCandidate(candidate);
    setFeedbackModalOpen(true);
  };

  const handleSubmitFeedback = async (agrees: boolean, comment?: string) => {
    if (!selectedCandidate) return false;
    return submitFeedback(selectedCandidate.id, agrees, comment);
  };

  const handleDeleteFeedback = async () => {
    if (!selectedCandidate) return false;
    return deleteFeedback(selectedCandidate.id);
  };

  const summary = getSummary();

  return (
    <div className="space-y-6">
      {/* Header with dates */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <span className="text-sm text-slate-600">
              Last updated: <span className="font-semibold text-slate-800">5 January 2026, 09:36</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 border border-red-300 rounded-lg">
          <Calendar className="w-4 h-4 text-red-600" />
          <span className="text-sm font-semibold text-red-700">Closing Date: 20 January 2026</span>
        </div>
      </div>

      {/* Team Feedback Summary */}
      <FeedbackSummaryCard
        summary={summary}
        totalCandidates={allGPCandidates.length}
        roleType="GP"
        isLoading={feedbackLoading}
      />

      {/* Executive Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center border-2 border-slate-200">
          <Users className="w-8 h-8 mx-auto text-[#005EB8] mb-2" />
          <p className="text-3xl font-bold text-[#005EB8]">{gpRecruitmentSummary.totalApplications}</p>
          <p className="text-sm text-slate-600 font-medium">Total Applications</p>
          <div className="flex justify-center gap-2 mt-2">
            <Badge variant="outline" className="text-xs">Indeed: {gpRecruitmentSummary.sources.indeed}</Badge>
            <Badge variant="outline" className="text-xs">NHS Jobs: {gpRecruitmentSummary.sources.nhsJobs}</Badge>
          </div>
        </Card>
        
        <Card className="p-4 text-center border-2 border-green-300 bg-green-100">
          <Star className="w-8 h-8 mx-auto text-green-700 mb-2" />
          <p className="text-3xl font-bold text-green-700">{gpRecruitmentSummary.stronglyRecommend}</p>
          <p className="text-sm text-green-800 font-medium">Strongly Recommend</p>
        </Card>
        
        <Card className="p-4 text-center border-2 border-green-200 bg-green-50">
          <UserCheck className="w-8 h-8 mx-auto text-green-600 mb-2" />
          <p className="text-3xl font-bold text-green-600">{gpRecruitmentSummary.interviewRecommended}</p>
          <p className="text-sm text-green-700 font-medium">Interview Recommended</p>
        </Card>
        
        <Card className="p-4 text-center border-2 border-red-200 bg-red-50">
          <UserX className="w-8 h-8 mx-auto text-red-600 mb-2" />
          <p className="text-3xl font-bold text-red-600">{gpRecruitmentSummary.doNotShortlist}</p>
          <p className="text-sm text-red-700 font-medium">Do Not Shortlist</p>
        </Card>
      </div>

      {/* Score Matrix */}
      <div>
        <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
          Candidate Score Matrix
          <Badge variant="outline" className="font-normal">Colour coded: Green 8-10 | Amber 6-7 | Red 0-5</Badge>
        </h4>
        <div className="overflow-x-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-100">
                <TableHead className="font-semibold sticky left-0 bg-slate-100 z-10">ID</TableHead>
                {gpScoringCriteria.map(c => (
                  <TableHead key={c.key} className="text-center font-semibold text-xs px-2" title={c.description}>
                    {c.label}
                  </TableHead>
                ))}
                <TableHead className="text-center font-semibold bg-slate-200">TOTAL</TableHead>
                <TableHead className="font-semibold">Recommendation</TableHead>
                <TableHead className="font-semibold text-center">Feedback</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCandidates.map((candidate) => {
                const stats = getCandidateStats(candidate.id);
                const userFeedback = getUserFeedbackForCandidate(candidate.id);
                return (
                  <TableRow key={candidate.id} className="hover:bg-slate-50">
                    <TableCell className="font-mono text-xs sticky left-0 bg-white z-10">
                      {candidate.id}
                    </TableCell>
                    {candidate.scoringBreakdown.map((score, idx) => (
                      <TableCell key={idx} className="text-center p-1">
                        <span className={`inline-block w-6 h-6 rounded text-xs font-bold leading-6 ${getScoreColor(score.score, score.maxScore)}`}>
                          {score.score}
                        </span>
                      </TableCell>
                    ))}
                    <TableCell className="text-center bg-slate-50">
                      <span className={`inline-block px-2 py-1 rounded text-sm font-bold ${getScoreColor(candidate.score, 100)}`}>
                        {candidate.score}
                      </span>
                    </TableCell>
                    <TableCell>
                      {getRecommendationBadge(candidate.recommendation)}
                    </TableCell>
                    <TableCell>
                      <CandidateFeedbackButton
                        stats={stats}
                        onClick={() => handleOpenFeedback(candidate)}
                        hasUserFeedback={!!userFeedback}
                        userAgreed={userFeedback?.agrees_with_assessment}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Shortlist Recommendations */}
      <div className="space-y-4">
        {/* Strongly Recommend */}
        {stronglyRecommended.length > 0 && (
          <div className="bg-green-100 border-2 border-green-300 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-5 h-5 text-green-700" />
              <h4 className="font-semibold text-green-800">Strongly Recommend - Invite to Interview ({stronglyRecommended.length} candidate)</h4>
            </div>
            <Accordion type="multiple" className="space-y-2">
              {stronglyRecommended.map((candidate) => {
                const stats = getCandidateStats(candidate.id);
                const userFeedback = getUserFeedbackForCandidate(candidate.id);
                return (
                  <AccordionItem key={candidate.id} value={candidate.id} className="bg-white rounded-lg border border-green-300">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-3 w-full flex-wrap">
                        <span className="font-mono text-sm font-semibold text-green-700">{candidate.id}</span>
                        <span className={`px-2 py-0.5 rounded text-sm font-bold ${getScoreColor(candidate.score, 100)}`}>
                          {candidate.score}/100
                        </span>
                        {getRecommendationBadge(candidate.recommendation)}
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          GMC: {candidate.gmcNumber}
                        </Badge>
                      <span className="text-sm text-slate-600 ml-auto mr-4">{candidate.currentRole}</span>
                      <CandidateFeedbackButton
                        stats={stats}
                        onClick={() => handleOpenFeedback(candidate)}
                        hasUserFeedback={!!userFeedback}
                        userAgreed={userFeedback?.agrees_with_assessment}
                      />
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <GPCandidateDetailCard candidate={candidate} />
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        )}

        {/* Recommend */}
        {recommended.length > 0 && (
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <h4 className="font-semibold text-green-800">Recommend - Invite to Interview ({recommended.length} candidates)</h4>
            </div>
            <Accordion type="multiple" className="space-y-2">
              {recommended.map((candidate) => {
                const stats = getCandidateStats(candidate.id);
                const userFeedback = getUserFeedbackForCandidate(candidate.id);
                return (
                  <AccordionItem key={candidate.id} value={candidate.id} className="bg-white rounded-lg border border-green-200">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-3 w-full flex-wrap">
                        <span className="font-mono text-sm font-semibold text-green-700">{candidate.id}</span>
                        <span className={`px-2 py-0.5 rounded text-sm font-bold ${getScoreColor(candidate.score, 100)}`}>
                          {candidate.score}/100
                        </span>
                        {getRecommendationBadge(candidate.recommendation)}
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          GMC: {candidate.gmcNumber}
                        </Badge>
                      <span className="text-sm text-slate-600 ml-auto mr-4">{candidate.currentRole}</span>
                      <CandidateFeedbackButton
                        stats={stats}
                        onClick={() => handleOpenFeedback(candidate)}
                        hasUserFeedback={!!userFeedback}
                        userAgreed={userFeedback?.agrees_with_assessment}
                      />
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <GPCandidateDetailCard candidate={candidate} />
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        )}

        {/* Do Not Shortlist */}
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
          <button 
            onClick={() => setShowAllCandidates(!showAllCandidates)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <h4 className="font-semibold text-red-800">Do Not Shortlist ({notShortlisted.length} candidates)</h4>
            </div>
            <ChevronDown className={`w-5 h-5 text-red-600 transition-transform ${showAllCandidates ? 'rotate-180' : ''}`} />
          </button>
          
          {showAllCandidates && (
            <div className="mt-4 space-y-4">
              {/* Summary Table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-red-100">
                      <TableHead className="font-semibold">ID</TableHead>
                      <TableHead className="font-semibold">Score</TableHead>
                      <TableHead className="font-semibold">GMC</TableHead>
                      <TableHead className="font-semibold">Reason for Rejection</TableHead>
                      <TableHead className="font-semibold">Feedback</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notShortlisted.map((candidate) => {
                      const stats = getCandidateStats(candidate.id);
                      const userFeedback = getUserFeedbackForCandidate(candidate.id);
                      return (
                        <TableRow key={candidate.id}>
                          <TableCell className="font-mono text-sm">{candidate.id}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded text-sm font-bold ${getScoreColor(candidate.score, 100)}`}>
                              {candidate.score}/100
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">{candidate.gmcNumber}</TableCell>
                          <TableCell className="text-sm text-red-700">{candidate.recommendationReason}</TableCell>
                          <TableCell>
                            <CandidateFeedbackButton
                              stats={stats}
                              onClick={() => handleOpenFeedback(candidate)}
                              hasUserFeedback={!!userFeedback}
                              userAgreed={userFeedback?.agrees_with_assessment}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Feedback Modal */}
      {selectedCandidate && (
        <CandidateFeedbackModal
          open={feedbackModalOpen}
          onOpenChange={setFeedbackModalOpen}
          candidateId={selectedCandidate.id}
          currentRecommendation={getRecommendationText(selectedCandidate.recommendation)}
          roleType="GP"
          feedback={getFeedbackForCandidate(selectedCandidate.id)}
          userFeedback={getUserFeedbackForCandidate(selectedCandidate.id)}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmitFeedback}
          onDelete={handleDeleteFeedback}
          canSubmitFeedback={canSubmitFeedback}
        />
      )}
    </div>
  );
};
