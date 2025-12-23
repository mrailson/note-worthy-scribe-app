import { Card, CardContent } from "@/components/ui/card";
import { FileText, Download, Folder, FolderOpen, ChevronRight, Calendar, FileSpreadsheet, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type DocumentType = "presentation" | "document" | "legal" | "finance" | "analysis" | "spreadsheet" | "agenda" | "minutes";

interface Document {
  title: string;
  type: DocumentType;
  filePath?: string;
}

interface Meeting {
  id: number;
  date: string;
  location: string;
  documents: Document[];
}


// Programme Board Meetings with their documents
const meetings: Meeting[] = [
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
        title: "Terms of Reference", 
        type: "legal",
        filePath: "/evidence/meetings/meeting-23/Terms_of_Reference.docx"
      },
      { 
        title: "SDA Innovator Project Plan", 
        type: "spreadsheet",
        filePath: "/evidence/meetings/meeting-23/SDA_Innovator_Project_Plan.xlsx"
      },
    ]
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
    default: return "bg-slate-100 text-slate-700";
  }
};

const getFileIcon = (type: DocumentType) => {
  switch (type) {
    case "spreadsheet": return FileSpreadsheet;
    case "agenda": 
    case "minutes": return Calendar;
    default: return FileText;
  }
};

const handleDownload = (filePath?: string) => {
  if (filePath) {
    window.open(filePath, '_blank');
  }
};

export const SDAEvidenceLibrary = () => {
  const [openMeetings, setOpenMeetings] = useState<number[]>([23]); // Default open meeting 23

  const toggleMeeting = (meetingId: number) => {
    setOpenMeetings(prev => 
      prev.includes(meetingId) 
        ? prev.filter(id => id !== meetingId)
        : [...prev, meetingId]
    );
  };

  const totalMeetingDocs = meetings.reduce((sum, m) => sum + m.documents.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Evidence Library</h2>
        <p className="text-slate-600 mt-1">
          Supporting documentation and evidence for the SDA Programme
        </p>
      </div>

      {/* Programme Board Meetings Section */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#005EB8]" />
          Programme Board Meetings
        </h3>
        
        <div className="space-y-2">
          {meetings.map((meeting) => {
            const isOpen = openMeetings.includes(meeting.id);
            const FolderIcon = isOpen ? FolderOpen : Folder;
            
            return (
              <Collapsible key={meeting.id} open={isOpen} onOpenChange={() => toggleMeeting(meeting.id)}>
                <Card className="bg-white border-0 shadow-sm overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <button className="w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left">
                      <div className="w-10 h-10 rounded-lg bg-[#005EB8]/10 flex items-center justify-center">
                        <FolderIcon className="w-5 h-5 text-[#005EB8]" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">Meeting {meeting.id}</p>
                        <p className="text-sm text-slate-500">{meeting.date} • {meeting.location}</p>
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
                    <div className="px-4 pb-4 pt-2 border-t border-slate-100">
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
                                <p className="font-medium text-slate-900 text-sm truncate group-hover:text-[#005EB8] transition-colors">
                                  {doc.title}
                                </p>
                                <p className="text-xs text-slate-500 capitalize">{doc.type}</p>
                              </div>
                              <Download className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      </div>


      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        <Card className="bg-[#005EB8]/10 border-0">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-[#005EB8]">{meetings.length}</p>
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
            <p className="text-3xl font-bold text-cyan-700">{meetings.reduce((sum, m) => sum + m.documents.filter(d => d.type === 'agenda').length, 0)}</p>
            <p className="text-sm text-slate-600">Agendas</p>
          </CardContent>
        </Card>
        <Card className="bg-indigo-50 border-0">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-indigo-700">{meetings.reduce((sum, m) => sum + m.documents.filter(d => d.type === 'minutes').length, 0)}</p>
            <p className="text-sm text-slate-600">Minutes</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
