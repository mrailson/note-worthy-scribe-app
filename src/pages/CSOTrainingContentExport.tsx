import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { csoTrainingModules } from "@/data/csoTrainingContent";

export default function CSOTrainingContentExport() {
  const [markdown, setMarkdown] = useState("");

  useEffect(() => {
    // Generate markdown export of all training content
    let content = "# CSO Training Content Export\n\n";
    content += `*Generated: ${new Date().toLocaleDateString('en-GB')}*\n\n`;
    content += "---\n\n";

    csoTrainingModules.forEach((module, index) => {
      content += `## Module ${index + 1}: ${module.title}\n\n`;
      content += `**Duration:** ${module.duration} minutes\n\n`;
      
      module.sections.forEach((section, sectionIndex) => {
        content += `### ${index + 1}.${sectionIndex + 1} ${section.title}\n\n`;
        content += `${section.content}\n\n`;
        
        if (section.keyPoints && section.keyPoints.length > 0) {
          content += "**Key Points:**\n\n";
          section.keyPoints.forEach(point => {
            content += `- ${point}\n`;
          });
          content += "\n";
        }
      });
      
      content += "---\n\n";
    });

    setMarkdown(content);
  }, []);

  return (
    <div className="min-h-screen bg-background p-8">
      <Card className="max-w-5xl mx-auto">
        <CardHeader>
          <CardTitle>CSO Training Content Export</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-slate dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {markdown}
          </ReactMarkdown>
        </CardContent>
      </Card>
    </div>
  );
}
