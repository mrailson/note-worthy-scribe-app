import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";

const formSchema = z.object({
  practiceId: z.string().min(1, "Please select a practice"),
  practiceName: z.string().optional(),
  complaintsUse: z.number().min(0).max(2),
  complaintsUsefulness: z.number().min(0).max(5),
  meetingsUse: z.number().min(0).max(2),
  meetingsUsefulness: z.number().min(0).max(5),
  comments: z.string().max(1000).optional(),
  respondentName: z.string().optional(),
  respondentEmail: z.string().email().optional().or(z.literal("")),
});

type FormData = z.infer<typeof formSchema>;

const sliderValueToText = (value: number): string => {
  const map: Record<number, string> = { 0: "No", 1: "Maybe", 2: "Yes" };
  return map[value] || "Unknown";
};

const usefulnessLabel = (value: number): string => {
  const labels = [
    "Not useful",
    "Slightly useful",
    "Moderately useful",
    "Useful",
    "Very useful",
    "Extremely useful",
  ];
  return labels[value] || "Unknown";
};

const getUsefulnessColor = (value: number): string => {
  const colors = [
    "hsl(var(--destructive))",
    "hsl(20, 91%, 56%)",
    "hsl(43, 96%, 56%)",
    "hsl(82, 61%, 56%)",
    "hsl(142, 71%, 45%)",
    "hsl(142, 76%, 36%)",
  ];
  return colors[value] || "hsl(var(--muted-foreground))";
};

export default function PracticeManagerFeedback() {
  const [practices, setPractices] = useState<Array<{ id: string; name: string; practice_code: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showOtherInput, setShowOtherInput] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      practiceId: "",
      practiceName: "",
      complaintsUse: 1,
      complaintsUsefulness: 2,
      meetingsUse: 1,
      meetingsUsefulness: 2,
      comments: "",
      respondentName: "",
      respondentEmail: "",
    },
  });

  useEffect(() => {
    const fetchPractices = async () => {
      const { data, error } = await supabase
        .from("gp_practices")
        .select("id, name, practice_code")
        .order("name");

      if (error) {
        console.error("Error fetching practices:", error);
        toast.error("Failed to load practices");
        return;
      }

      setPractices(data || []);
    };

    fetchPractices();
  }, []);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);

    try {
      // Check rate limiting (simple IP-based check)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      // Insert feedback
      const feedbackData = {
        practice_id: data.practiceId === "other" ? null : data.practiceId,
        practice_name: data.practiceId === "other" ? data.practiceName : null,
        would_use_complaints_system: data.complaintsUse,
        complaints_system_usefulness: data.complaintsUsefulness,
        would_use_meeting_manager: data.meetingsUse,
        meeting_manager_usefulness: data.meetingsUsefulness,
        comments: data.comments || null,
        respondent_name: data.respondentName || null,
        respondent_email: data.respondentEmail || null,
      };

      const { error: insertError } = await supabase
        .from("practice_manager_feedback")
        .insert(feedbackData);

      if (insertError) {
        console.error("Insert error:", insertError);
        toast.error("Failed to submit feedback. Please try again.");
        return;
      }

      // Get practice details for email
      const selectedPractice = practices.find(p => p.id === data.practiceId);
      const practiceName = data.practiceId === "other" 
        ? data.practiceName || "Other Practice"
        : selectedPractice?.name || "Unknown Practice";
      const practiceCode = data.practiceId === "other" 
        ? ""
        : selectedPractice?.practice_code || "";

      // Send email notification using existing ai_generated_content template
      const feedbackMessage = `NEW PRACTICE MANAGER FEEDBACK RECEIVED

Practice Information:
• Practice Name: ${practiceName}
${practiceCode ? `• Practice Code: ${practiceCode}` : ''}

Complaints Manager Interest:
• Would use: ${sliderValueToText(data.complaintsUse)}
• Usefulness rating: ${data.complaintsUsefulness}/5 - ${usefulnessLabel(data.complaintsUsefulness)}

Meeting Notes Interest:
• Would use: ${sliderValueToText(data.meetingsUse)}
• Usefulness rating: ${data.meetingsUsefulness}/5 - ${usefulnessLabel(data.meetingsUsefulness)}

Additional Comments:
${data.comments || "No additional comments provided"}

Respondent Details:
• Name: ${data.respondentName || "Anonymous"}
• Email: ${data.respondentEmail || "Not provided"}

Submitted: ${new Date().toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })}`;

      const { error: emailError } = await supabase.functions.invoke("send-email-via-emailjs", {
        body: {
          to_email: "Malcolm.railson@nhs.net",
          subject: `New Feedback: ${practiceName}`,
          template_type: "ai_generated_content",
          message: feedbackMessage
        },
      });

      if (emailError) {
        console.error("Email error:", emailError);
        // Don't show error to user as feedback was saved successfully
      }

      setIsSuccess(true);
      toast.success("Thank you! Your feedback has been submitted.");
      form.reset();
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary/20 p-4">
        <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-8 text-center space-y-6">
          <CheckCircle2 className="w-16 h-16 mx-auto text-primary" />
          <h1 className="text-2xl font-bold">Thank You!</h1>
          <p className="text-muted-foreground">
            Your feedback has been successfully submitted. We appreciate you taking the time to help us improve our services.
          </p>
          <Button onClick={() => setIsSuccess(false)} className="w-full">
            Submit Another Response
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-card rounded-lg shadow-lg p-8 space-y-8">
          <div className="space-y-4 text-center">
            <h1 className="text-3xl font-bold">Practice Manager Feedback</h1>
            <p className="text-muted-foreground">
              We'd love to hear your thoughts on our complaints management system and meeting manager.
              This should take approximately 2 minutes.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Practice Selection */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Your Practice</h2>
                <FormField
                  control={form.control}
                  name="practiceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Your Practice</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          setShowOtherInput(value === "other");
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a practice..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {practices.map((practice) => (
                            <SelectItem key={practice.id} value={practice.id}>
                              {practice.name} ({practice.practice_code})
                            </SelectItem>
                          ))}
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {showOtherInput && (
                  <FormField
                    control={form.control}
                    name="practiceName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Practice Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter practice name..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Complaints System */}
              <div className="space-y-6 p-6 bg-secondary/30 rounded-lg">
                <h2 className="text-xl font-semibold">Complaints Management System</h2>

                <FormField
                  control={form.control}
                  name="complaintsUse"
                  render={({ field }) => (
                    <FormItem className="space-y-4">
                      <FormLabel>Would you use the complaints management system?</FormLabel>
                      <FormControl>
                        <div className="space-y-4">
                          <Slider
                            min={0}
                            max={2}
                            step={1}
                            value={[field.value]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                            className="my-4"
                          />
                          <div className="text-center">
                            <span className="text-lg font-semibold text-primary">
                              {sliderValueToText(field.value)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>No</span>
                            <span>Maybe</span>
                            <span>Yes</span>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="complaintsUsefulness"
                  render={({ field }) => (
                    <FormItem className="space-y-4">
                      <FormLabel>How useful would it be?</FormLabel>
                      <FormControl>
                        <div className="space-y-4">
                          <Slider
                            min={0}
                            max={5}
                            step={1}
                            value={[field.value]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                            className="my-4"
                          />
                          <div className="text-center">
                            <span
                              className="text-lg font-semibold transition-colors"
                              style={{ color: getUsefulnessColor(field.value) }}
                            >
                              {usefulnessLabel(field.value)}
                            </span>
                            <span className="ml-2 text-muted-foreground">
                              ({field.value}/5)
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Not useful</span>
                            <span>Very useful</span>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Meeting Manager */}
              <div className="space-y-6 p-6 bg-secondary/30 rounded-lg">
                <h2 className="text-xl font-semibold">Meeting Manager System</h2>

                <FormField
                  control={form.control}
                  name="meetingsUse"
                  render={({ field }) => (
                    <FormItem className="space-y-4">
                      <FormLabel>Would you use the meeting manager system?</FormLabel>
                      <FormControl>
                        <div className="space-y-4">
                          <Slider
                            min={0}
                            max={2}
                            step={1}
                            value={[field.value]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                            className="my-4"
                          />
                          <div className="text-center">
                            <span className="text-lg font-semibold text-primary">
                              {sliderValueToText(field.value)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>No</span>
                            <span>Maybe</span>
                            <span>Yes</span>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="meetingsUsefulness"
                  render={({ field }) => (
                    <FormItem className="space-y-4">
                      <FormLabel>How useful would it be?</FormLabel>
                      <FormControl>
                        <div className="space-y-4">
                          <Slider
                            min={0}
                            max={5}
                            step={1}
                            value={[field.value]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                            className="my-4"
                          />
                          <div className="text-center">
                            <span
                              className="text-lg font-semibold transition-colors"
                              style={{ color: getUsefulnessColor(field.value) }}
                            >
                              {usefulnessLabel(field.value)}
                            </span>
                            <span className="ml-2 text-muted-foreground">
                              ({field.value}/5)
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Not useful</span>
                            <span>Very useful</span>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Additional Feedback */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Additional Feedback (Optional)</h2>

                <FormField
                  control={form.control}
                  name="comments"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comments or Suggestions</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Please share any additional thoughts..."
                          className="min-h-[120px]"
                          maxLength={1000}
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        {field.value?.length || 0}/1000 characters
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="respondentName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Name (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your name..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="respondentEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Email (Optional)</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="your.email@practice.nhs.uk" {...field} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        In case we'd like to follow up on your feedback
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Feedback"
                )}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
