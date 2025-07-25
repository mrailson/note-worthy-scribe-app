import { useState } from "react";
import { MeetingRecorderV2 } from "@/components/MeetingRecorderV2";

export const RecorderV2Test = () => {
  const [transcript, setTranscript] = useState("");
  const [duration, setDuration] = useState("00:00");
  const [wordCount, setWordCount] = useState(0);

  return (
    <div className="min-h-screen bg-background">
      <MeetingRecorderV2
        onTranscriptUpdate={setTranscript}
        onDurationUpdate={setDuration}
        onWordCountUpdate={setWordCount}
        initialSettings={{
          title: "V2 Test Meeting",
          description: "Testing the new recorder with multiple speech services",
          meetingType: "test"
        }}
      />
    </div>
  );
};