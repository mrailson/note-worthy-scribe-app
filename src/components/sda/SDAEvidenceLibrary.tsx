import { Card, CardContent } from "@/components/ui/card";
import { FileText, Download, Folder, FolderOpen, ChevronRight, Calendar, FileSpreadsheet, File, Heart, Play, Pause, Headphones, ClipboardList, Users } from "lucide-react";
import { ActionLogTable } from "./ActionLogTable";
import { actionLogData, actionLogMetadata } from "@/data/nresBoardActionsData";
import { Button } from "@/components/ui/button";
import { useState, useRef } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useNRESUserAccess } from "@/hooks/useNRESUserAccess";
import { NRESUserAccessModal } from "./NRESUserAccessModal";

type DocumentType = "presentation" | "document" | "legal" | "finance" | "analysis" | "spreadsheet" | "agenda" | "minutes" | "draft-minutes";

interface Document {
  title: string;
  type: DocumentType;
  filePath?: string;
  isDraft?: boolean;
  draftNote?: string;
  approvalNote?: string;
}

interface Meeting {
  id: number;
  date: string;
  location: string;
  documents: Document[];
}

// Programme Board Meetings with their documents
const programmeBoardMeetings: Meeting[] = [
  {
    id: 23,
    date: "23 December 2025",
    location: "Brackley Medical Centre",
    documents: [
      { 
        title: "Programme Board Agenda", 
        type: "agenda",
        filePath: "/evidence/meetings/meeting-23/Programme_Board_Agenda_23_Dec_2025.docx"
      },
      { 
        title: "Programme Board Minutes (9 Dec 2025)", 
        type: "minutes",
        filePath: "/evidence/meetings/meeting-23/Programme_Board_Minutes_09_Dec_2025.docx"
      },
      { 
        title: "Draft Minutes (23 Dec 2025)", 
        type: "draft-minutes",
        filePath: "/evidence/meetings/meeting-23/23rd_Dec_PB_Meeting_Draft_Minutes_TBC_V1.docx",
        isDraft: true,
        draftNote: "Early Draft - Final version to follow"
      },
      { 
        title: "Terms of Reference", 
        type: "legal",
        filePath: "/evidence/meetings/meeting-23/Terms_of_Reference.docx",
        approvalNote: "Approved as final by Programme Board on 23rd December 2025"
      },
      { 
        title: "SDA Innovator Project Plan", 
        type: "spreadsheet",
        filePath: "/evidence/meetings/meeting-23/SDA_Innovator_Project_Plan.xlsx"
      },
    ]
  }
];

// Workgroup Meetings with their documents
const workgroupMeetings: Meeting[] = [
  {
    id: 1,
    date: "Coming Soon",
    location: "TBC",
    documents: []
  }
];

// VCSE Infrastructure Partners Meetings with their documents
const vcseMeetings: Meeting[] = [
  {
    id: 1,
    date: "22 December 2025",
    location: "Virtual Meeting",
    documents: []
  },
  {
    id: 2,
    date: "19 January 2026",
    location: "Riverside, Islington Road, Towcester (NN12 6AU)",
    documents: []
  }
];

const getTypeColor = (type: DocumentType) => {
  switch (type) {
    case "presentation": return "bg-blue-100 text-blue-700";
    case "document": return "bg-slate-100 text-slate-700";
    case "legal": return "bg-purple-100 text-purple-700";
    case "finance": return "bg-green-100 text-green-700";
    case "analysis": return "bg-amber-100 text-amber-700";
    case "spreadsheet": return "bg-emerald-100 text-emerald-700";
    case "agenda": return "bg-cyan-100 text-cyan-700";
    case "minutes": return "bg-indigo-100 text-indigo-700";
    case "draft-minutes": return "bg-amber-100 text-amber-700";
    default: return "bg-slate-100 text-slate-700";
  }
};

const getFileIcon = (type: DocumentType) => {
  switch (type) {
    case "spreadsheet": return FileSpreadsheet;
    case "agenda": 
    case "minutes":
    case "draft-minutes": return Calendar;
    default: return FileText;
  }
};

const handleDownload = (filePath?: string) => {
  if (filePath) {
    window.open(filePath, '_blank');
  }
};

export const SDAEvidenceLibrary = () => {
  const [openProgrammeMeetings, setOpenProgrammeMeetings] = useState<number[]>([23]);
  const [openWorkgroupMeetings, setOpenWorkgroupMeetings] = useState<number[]>([]);
  const [openVcseMeetings, setOpenVcseMeetings] = useState<number[]>([1, 2]);
  const [showUserAccessModal, setShowUserAccessModal] = useState(false);
  
  // NRES user access data
  const { data: nresUsers = [], isLoading: isLoadingUsers } = useNRESUserAccess();
  
  // Audio player state
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSliderChange = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const toggleProgrammeMeeting = (meetingId: number) => {
    setOpenProgrammeMeetings(prev => 
      prev.includes(meetingId) 
        ? prev.filter(id => id !== meetingId)
        : [...prev, meetingId]
    );
  };

  const toggleWorkgroupMeeting = (meetingId: number) => {
    setOpenWorkgroupMeetings(prev => 
      prev.includes(meetingId) 
        ? prev.filter(id => id !== meetingId)
        : [...prev, meetingId]
    );
  };

  const toggleVcseMeeting = (meetingId: number) => {
    setOpenVcseMeetings(prev => 
      prev.includes(meetingId) 
        ? prev.filter(id => id !== meetingId)
        : [...prev, meetingId]
    );
  };

  const allMeetings = [...programmeBoardMeetings, ...workgroupMeetings, ...vcseMeetings];
  const totalMeetingDocs = allMeetings.reduce((sum, m) => sum + m.documents.length, 0);

  const renderMeetingList = (
    meetings: Meeting[], 
    openMeetings: number[], 
    toggleMeeting: (id: number) => void,
    prefix: string
  ) => (
    <div className="space-y-2">
      {meetings.map((meeting) => {
        const isOpen = openMeetings.includes(meeting.id);
        const FolderIcon = isOpen ? FolderOpen : Folder;
        
        return (
          <Collapsible key={`${prefix}-${meeting.id}`} open={isOpen} onOpenChange={() => toggleMeeting(meeting.id)}>
            <Card className="bg-white border-0 shadow-sm overflow-hidden">
              <CollapsibleTrigger asChild>
                <button className="w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left">
                  <div className="w-10 h-10 rounded-lg bg-[#005EB8]/10 flex items-center justify-center">
                    <FolderIcon className="w-5 h-5 text-[#005EB8]" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{meeting.date} - {meeting.location}</p>
                    <p className="text-sm text-slate-500">{meeting.documents.length > 0 ? `${meeting.documents.length} documents` : 'No documents yet'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                      {meeting.documents.length} files
                    </span>
                    <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  </div>
                </button>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-4">
                  {meeting.documents.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {meeting.documents.map((doc, docIndex) => {
                        const FileIcon = getFileIcon(doc.type);
                        return (
                          <div 
                            key={docIndex}
                            className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors group cursor-pointer"
                            onClick={() => handleDownload(doc.filePath)}
                          >
                            <div className={`w-8 h-8 rounded-md flex items-center justify-center ${getTypeColor(doc.type)}`}>
                              <FileIcon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-slate-900 text-sm truncate group-hover:text-[#005EB8] transition-colors">
                                  {doc.title}
                                </p>
                                {doc.isDraft && (
                                  <span className="text-[10px] font-medium bg-amber-500 text-white px-1.5 py-0.5 rounded uppercase shrink-0">
                                    Draft
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 capitalize">
                                {doc.type === 'draft-minutes' ? 'minutes' : doc.type}
                                {doc.draftNote && <span className="text-amber-600 ml-1">• {doc.draftNote}</span>}
                                {doc.approvalNote && <span className="text-green-600 ml-1">• {doc.approvalNote}</span>}
                              </p>
                            </div>
                            <Download className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No documents available yet</p>
                  )}
                  
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Evidence Library</h2>
        <p className="text-slate-600 mt-1">
          Supporting documentation and evidence for the SDA Programme
        </p>
      </div>

      {/* Programme Board Action Log Section */}
      <Collapsible defaultOpen={false}>
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-left">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-[#005EB8]" />
                Programme Board Action Log
              </h3>
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                  {actionLogData.filter(a => a.status === 'Open').length} Open
                </Badge>
                <ChevronRight className="w-5 h-5 text-slate-400 transition-transform data-[state=open]:rotate-90" />
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-3">
              <ActionLogTable actions={actionLogData} metadata={actionLogMetadata} />
              <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">
                Source: {actionLogMetadata.sourceMeeting} • Next Meeting: {actionLogMetadata.nextMeeting}
              </p>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Programme Board Meetings Section */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#005EB8]" />
          Programme Board Meetings
        </h3>
        {renderMeetingList(programmeBoardMeetings, openProgrammeMeetings, toggleProgrammeMeeting, 'pb')}
      </div>

      {/* Workgroup Meetings Section */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-600" />
          Workgroup Meetings
        </h3>
        {renderMeetingList(workgroupMeetings, openWorkgroupMeetings, toggleWorkgroupMeeting, 'wg')}
      </div>

      {/* VCSE Infrastructure Partners Meetings Section */}
      <Collapsible defaultOpen={true}>
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-left">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Heart className="w-5 h-5 text-pink-500" />
                VCSE Infrastructure Partners Meetings
              </h3>
              <ChevronRight className="w-5 h-5 text-slate-400 transition-transform data-[state=open]:rotate-90" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-3">
              <div className="flex flex-wrap gap-2 mb-2">
          {[
            "Aspire Northants",
            "Black Communities Together",
            "Social Action West Northants",
            "Age Well Asset Groups"
          ].map((partner, index) => (
            <Badge key={index} variant="outline" className="bg-pink-50 text-pink-700 border-pink-200 px-3 py-1">
              {partner}
            </Badge>
          ))}
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Mapping complete for patient engagement, LTC support, and connecting residents to local community health champions.
        </p>
        
        {/* VCSE Meeting - 22 Dec 2025 */}
        <Collapsible open={openVcseMeetings.includes(1)} onOpenChange={() => toggleVcseMeeting(1)}>
          <Card className="bg-white border-0 shadow-sm overflow-hidden">
            <CollapsibleTrigger asChild>
              <button className="w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left">
                <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center">
                  {openVcseMeetings.includes(1) ? (
                    <FolderOpen className="w-5 h-5 text-pink-600" />
                  ) : (
                    <Folder className="w-5 h-5 text-pink-600" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">22 December 2025 - Virtual Meeting</p>
                  <p className="text-sm text-slate-500">Workgroup Meeting</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Completed
                  </Badge>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${openVcseMeetings.includes(1) ? 'rotate-90' : ''}`} />
                </div>
              </button>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-4">
                <div className="bg-green-50 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-2">Meeting Summary</h4>
                  <p className="text-sm text-green-800">
                    Discussed integration of voluntary sector into South Rural innovation site and SDA project. Primary focus on collaboration to improve patient outcomes in long-term and complex care, whilst ensuring financial viability.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="font-semibold text-slate-900 text-sm mb-2">Key Outcomes</h4>
                    <ul className="text-sm text-slate-700 space-y-1 list-disc list-inside">
                      <li>VCSE representation on Programme Board agreed</li>
                      <li>Helen & Russ to act as conduit to wider sector</li>
                      <li>Innovation Fund available for practice pilots</li>
                      <li>Two-year pilot to demonstrate ROI to ICB</li>
                    </ul>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="font-semibold text-slate-900 text-sm mb-2">Target Cohorts (Feb 2026)</h4>
                    <ul className="text-sm text-slate-700 space-y-1 list-disc list-inside">
                      <li>Frailty</li>
                      <li>Children&apos;s mental health in schools</li>
                      <li>Diabetes/Hypertension</li>
                      <li>Long-term complex conditions</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h4 className="font-semibold text-blue-900 text-sm mb-2">Priority Actions</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs">High</Badge>
                      <span className="text-slate-700">Helen & Russ: Confirm Board representation by 05/01</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs">High</Badge>
                      <span className="text-slate-700">Helen: Attend Programme Board 23 Dec at BMC</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Med</Badge>
                      <span className="text-slate-700">Maureen: Send background presentations by 05/01</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs">High</Badge>
                      <span className="text-slate-700">TBC: Establish KPIs with ICB/Neighbourhoods (Feb)</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-500">
                  Attendees: Mark Graham (PML), Amanda Taylor, Maureen Green (PML), Ellie, Russ, Helen
                </p>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* VCSE Meeting - 19 Jan 2026 - Riverside Towcester */}
        <Collapsible open={openVcseMeetings.includes(2)} onOpenChange={() => toggleVcseMeeting(2)}>
          <Card className="bg-white border-0 shadow-sm overflow-hidden mt-3">
            <CollapsibleTrigger asChild>
              <button className="w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left">
                <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center">
                  {openVcseMeetings.includes(2) ? (
                    <FolderOpen className="w-5 h-5 text-pink-600" />
                  ) : (
                    <Folder className="w-5 h-5 text-pink-600" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">19 January 2026 - Riverside, Towcester</p>
                  <p className="text-sm text-slate-500">Site Visit - Helen Barrett (SNVB)</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    Planned
                  </Badge>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${openVcseMeetings.includes(2) ? 'rotate-90' : ''}`} />
                </div>
              </button>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">Meeting Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
                    <div>
                      <p><strong>Date:</strong> Monday 19th January 2026</p>
                      <p><strong>Time:</strong> 10:00 - 11:00</p>
                      <p><strong>Location:</strong> Islington Road, Towcester, NN12 6AU</p>
                    </div>
                    <div>
                      <p><strong>Host:</strong> Helen Barrett</p>
                      <p><strong>Organisation:</strong> South Northants Volunteer Bureau (SNVB)</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900 text-sm mb-2">Purpose</h4>
                  <p className="text-sm text-slate-700">
                    Discuss potential Neighbourhood options and explore collaboration opportunities with Riverside and the wider VCSE sector in South Northamptonshire.
                  </p>
                </div>

                <div className="bg-pink-50 rounded-lg p-4 border border-pink-200">
                  <h4 className="font-semibold text-pink-900 text-sm mb-2">Attendees</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-white text-pink-700 border-pink-200">
                      Helen Barrett (SNVB) - Required
                    </Badge>
                    <Badge variant="outline" className="bg-white text-slate-600 border-slate-200">
                      Amanda Taylor (Brackley Medical Centre)
                    </Badge>
                    <Badge variant="outline" className="bg-white text-slate-600 border-slate-200">
                      Mark Gray (PML)
                    </Badge>
                    <Badge variant="outline" className="bg-white text-slate-600 border-slate-200">
                      Maureen Green (PML)
                    </Badge>
                  </div>
                </div>

                <p className="text-xs text-slate-500">
                  Response: 2 accepted, 1 tentatively accepted, 0 declined
                </p>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8">
        <Card className="bg-[#005EB8]/10 border-0">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-[#005EB8]">{allMeetings.length}</p>
            <p className="text-sm text-slate-600">Meetings</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-50 border-0">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-slate-700">{totalMeetingDocs}</p>
            <p className="text-sm text-slate-600">Documents</p>
          </CardContent>
        </Card>
        <Card className="bg-cyan-50 border-0">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-cyan-700">{allMeetings.reduce((sum, m) => sum + m.documents.filter(d => d.type === 'agenda').length, 0)}</p>
            <p className="text-sm text-slate-600">Agendas</p>
          </CardContent>
        </Card>
        <Card className="bg-indigo-50 border-0">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-indigo-700">{allMeetings.reduce((sum, m) => sum + m.documents.filter(d => d.type === 'minutes').length, 0)}</p>
            <p className="text-sm text-slate-600">Minutes</p>
          </CardContent>
        </Card>
        <Card 
          className="bg-emerald-50 border-0 cursor-pointer hover:bg-emerald-100 transition-colors group"
          onClick={() => setShowUserAccessModal(true)}
        >
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              <p className="text-3xl font-bold text-emerald-700">
                {isLoadingUsers ? "..." : nresUsers.length}
              </p>
            </div>
            <p className="text-sm text-slate-600">NRES Users</p>
            <p className="text-xs text-emerald-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
              Click to view list →
            </p>
          </CardContent>
        </Card>
      </div>

      {/* User Access Modal */}
      <NRESUserAccessModal 
        open={showUserAccessModal} 
        onOpenChange={setShowUserAccessModal} 
      />
    </div>
  );
};
