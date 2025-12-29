import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const TrainingVideoPage = () => {
  const transcriptEntries = [
    { time: "00:00", text: "This tutorial will guide you through logging into NoteWell AI and using its features to support NHS Primary Care tasks." },
    { time: "00:06", text: "Here you will be able to access AI services, manage your profile and your team's profiles, and utilise key functionalities to support your practice team." },
    { time: "00:15", text: "When logging in to NoteWell AI for the first time from your welcome email, enter your NHS email address and the password provided in the email." },
    { time: "00:22", text: "If you ever forget your password, request a reset email or a magic link valid for one hour to access the system directly." },
    { time: "00:29", text: "Start the login process by entering your credentials to access NoteWell AI securely." },
    { time: "00:34", text: "Click the Sign In button to submit your credentials and proceed to the NoteWell AI dashboard." },
    { time: "00:39", text: "After logging in, the default screen displays the meeting service for recording meetings." },
    { time: "00:44", text: "You can navigate to other modules via the select service menu at the top of the screen." },
    { time: "00:48", text: "Including AI for GP, which provides AI powered assistance tailored for NHS use." },
    { time: "00:55", text: "Click AI 4 PM from the menu, where you can interact with an AI assistant designed to support general practice tasks." },
    { time: "01:02", text: "You will receive responses from the AI assistant, allowing you to have interactive conversations and obtain relevant information." },
    { time: "01:09", text: "Click the white input field shown here to begin typing your query." },
    { time: "01:13", text: "You can ask the AI to rewrite text, for example, translating content into another language such as French." },
    { time: "01:20", text: "Go here to explore further options and functionalities available within the AI service interface." },
    { time: "01:26", text: "Throughout the system, buttons allow you to download content." },
    { time: "01:29", text: "Clicking this option lets you save the AI generated text as a Word document for offline use." },
    { time: "01:35", text: "Click the Download as Word Document button to save the current AI output in a Word file format." },
    { time: "01:43", text: "Use the history feature to start a new search or chat session by clicking the plus icon, allowing you to ask new questions." },
    { time: "01:51", text: "Go here to access your previous search history and review past AI interactions." },
    { time: "01:56", text: "Click the 'Search History' button to view a list of your recent queries and responses." },
    { time: "02:02", text: "Click here to select a specific entry from your search history for review or further action." },
    { time: "02:07", text: "Click here to open the selected history item and see the detailed AI response." },
    { time: "02:12", text: "The next feature is meeting notes, which will be covered in separate tutorials for detailed guidance." },
    { time: "02:18", text: "You can change your username and password anytime by accessing your profile settings." },
    { time: "02:23", text: "Click here to open your profile settings where you can update personal information and security details." },
    { time: "02:29", text: "View and update practice staff details, adjust their access permissions, change roles, or delete users as needed." },
    { time: "02:37", text: "Click the Cancel button to exit the current screen or action without saving changes." },
    { time: "02:42", text: "Click the Logout button to securely sign out of your NoteWell AI account." },
    { time: "02:46", text: "You have successfully logged into NoteWell AI and explored its basic functions." },
    { time: "02:50", text: "Including AI assistance, document downloads, search history and user settings management." },
    { time: "02:56", text: "For further learning, explore advanced features like meeting notes and practice management." },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link to="/">
          <Button variant="ghost" className="mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>

        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-foreground">
              First Time to Notewell AI?
            </h1>
            <p className="text-muted-foreground">
              Watch our 2 minute training video to get started
            </p>
          </div>

          <div className="rounded-lg overflow-hidden border border-border shadow-lg">
            <iframe
              width="100%"
              height="400"
              src="https://embed.app.guidde.com/playbooks/gCxn8UuCkRPWiXTDrfZ5dj?mode=videoOnly"
              title="Login and Navigate Basic Features in NoteWell AI"
              frameBorder="0"
              referrerPolicy="unsafe-url"
              allowFullScreen
              allow="clipboard-write"
              sandbox="allow-popups allow-popups-to-escape-sandbox allow-scripts allow-forms allow-same-origin allow-presentation"
              className="rounded-lg"
            />
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="transcript" className="border rounded-lg px-4">
              <AccordionTrigger className="text-sm font-medium">
                View Video Transcript
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  {transcriptEntries.map((entry, index) => (
                    <div key={index} className="flex gap-3 text-sm">
                      <span className="text-primary font-mono shrink-0">
                        {entry.time}
                      </span>
                      <span className="text-muted-foreground">
                        {entry.text}
                      </span>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </div>
  );
};

export default TrainingVideoPage;
