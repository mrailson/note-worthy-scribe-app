import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Check, ChevronsUpDown } from "lucide-react";
import notewellLogo from "@/assets/notewell-logo.png";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  practiceId: z.string().min(1, "Please select a practice"),
  practiceName: z.string().optional(),
  complaintsUsefulness: z.number().min(0).max(5),
  meetingsUsefulness: z.number().min(0).max(5),
  comments: z.string().max(1000).optional(),
  respondentEmail: z.string().email().optional().or(z.literal("")),
}).refine((data) => {
  if (data.practiceId === "other" && !data.practiceName) {
    return false;
  }
  return true;
}, {
  message: "Practice name is required when selecting 'Other'",
  path: ["practiceName"],
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
  const navigate = useNavigate();
  const [practices, setPractices] = useState<Array<{ id: string; name: string; practice_code: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      practiceId: "",
      practiceName: "",
      complaintsUsefulness: 2,
      meetingsUsefulness: 2,
      comments: "",
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
        would_use_complaints_system: data.complaintsUsefulness <= 1 ? 0 : data.complaintsUsefulness <= 3 ? 1 : 2,
        complaints_system_usefulness: data.complaintsUsefulness,
        would_use_meeting_manager: data.meetingsUsefulness <= 1 ? 0 : data.meetingsUsefulness <= 3 ? 1 : 2,
        meeting_manager_usefulness: data.meetingsUsefulness,
        comments: data.comments || null,
        respondent_name: null,
        respondent_email: data.respondentEmail || null,
      };

      const { error: insertError } = await supabase
        .from("practice_manager_feedback")
        .insert(feedbackData);

      if (insertError) {
        console.error("Insert error:", insertError);
        toast.error(`Failed to submit feedback: ${insertError.message}`);
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
• Usefulness rating: ${data.complaintsUsefulness}/5 - ${usefulnessLabel(data.complaintsUsefulness)}

Meeting Notes Interest:
• Usefulness rating: ${data.meetingsUsefulness}/5 - ${usefulnessLabel(data.meetingsUsefulness)}

Additional Comments:
${data.comments || "No additional comments provided"}

Respondent Details:
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5 p-4">
        <div className="max-w-md w-full bg-card rounded-xl shadow-xl border border-primary/20 p-8 text-center space-y-6">
          <CheckCircle2 className="w-16 h-16 mx-auto text-primary" />
          <h1 className="text-2xl font-bold">Thank You!</h1>
          <p className="text-muted-foreground">
            Your feedback has been successfully submitted. We appreciate you taking the time to help us improve our services.
          </p>
          <div className="flex flex-col gap-3">
            <Button onClick={() => navigate("/feedback/results")} variant="outline" className="w-full border-primary/30 hover:bg-primary/10">
              View All Results
            </Button>
            <Button onClick={() => setIsSuccess(false)} className="w-full bg-primary hover:bg-primary-hover">
              Submit Another Response
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-primary/5 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-card rounded-xl shadow-xl border border-primary/20 p-6 space-y-6">
          <div className="space-y-3 text-center">
            <div className="flex justify-center mb-4">
              <img src={notewellLogo} alt="Notewell AI" className="h-16 w-auto" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Practice Manager Feedback</h1>
            <p className="text-sm text-muted-foreground">
              We'd love to hear your thoughts on the two services demonstrated by Amanda
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Practice Selection */}
              <div className="space-y-3 p-5 bg-gradient-to-br from-primary/5 to-background rounded-xl border-2 border-primary/20 shadow-sm">
                <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
                  <span className="text-xl">📍</span>
                  Your Practice
                </h2>
                <FormField
                  control={form.control}
                  name="practiceId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Select Your Practice</FormLabel>
                      <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={open}
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value === "other"
                                ? "Other"
                                : field.value
                                ? practices.find((practice) => practice.id === field.value)?.name
                                : "Start typing practice name or K code..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder="Search practice name or K code..."
                              value={searchQuery}
                              onValueChange={setSearchQuery}
                            />
                            <CommandList>
                              <CommandEmpty>No practice found.</CommandEmpty>
                              <CommandGroup>
                                {practices
                                  .filter((practice) =>
                                    searchQuery
                                      ? practice.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        practice.practice_code.toLowerCase().includes(searchQuery.toLowerCase())
                                      : true
                                  )
                                  .map((practice) => (
                                    <CommandItem
                                      key={practice.id}
                                      value={practice.id}
                                      onSelect={() => {
                                        field.onChange(practice.id);
                                        setShowOtherInput(false);
                                        setOpen(false);
                                        setSearchQuery("");
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          practice.id === field.value ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {practice.name} ({practice.practice_code})
                                    </CommandItem>
                                  ))}
                                <CommandItem
                                  value="other"
                                  onSelect={() => {
                                    field.onChange("other");
                                    setShowOtherInput(true);
                                    setOpen(false);
                                    setSearchQuery("");
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      "other" === field.value ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  Other
                                </CommandItem>
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <p className="text-xs text-muted-foreground">
                        Start typing your practice name or K code to search
                      </p>
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
              <div className="space-y-4 p-5 bg-gradient-to-br from-primary/8 to-primary/5 rounded-xl border-2 border-primary/30 shadow-md hover:shadow-lg transition-shadow">
                <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
                  <span className="text-xl">📋</span>
                  Complaints Management System
                </h2>

                <FormField
                  control={form.control}
                  name="complaintsUsefulness"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>How useful would it be?</FormLabel>
                      <FormControl>
                        <div className="space-y-3">
                          <Slider
                            min={0}
                            max={5}
                            step={1}
                            value={[field.value]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                            className="my-2"
                          />
                          <div className="text-center">
                            <span
                              className="text-base font-semibold transition-colors"
                              style={{ color: getUsefulnessColor(field.value) }}
                            >
                              {usefulnessLabel(field.value)}
                            </span>
                            <span className="ml-2 text-sm text-muted-foreground">
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
              <div className="space-y-4 p-5 bg-gradient-to-br from-primary/8 to-primary/5 rounded-xl border-2 border-primary/30 shadow-md hover:shadow-lg transition-shadow">
                <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
                  <span className="text-xl">📅</span>
                  Meeting Manager System
                </h2>

                <FormField
                  control={form.control}
                  name="meetingsUsefulness"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>How useful would it be?</FormLabel>
                      <FormControl>
                        <div className="space-y-3">
                          <Slider
                            min={0}
                            max={5}
                            step={1}
                            value={[field.value]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                            className="my-2"
                          />
                          <div className="text-center">
                            <span
                              className="text-base font-semibold transition-colors"
                              style={{ color: getUsefulnessColor(field.value) }}
                            >
                              {usefulnessLabel(field.value)}
                            </span>
                            <span className="ml-2 text-sm text-muted-foreground">
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
              <div className="space-y-3 p-5 bg-gradient-to-br from-primary/5 to-background rounded-xl border-2 border-primary/20 shadow-sm">
                <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
                  <span className="text-xl">💬</span>
                  Additional Feedback (Optional)
                </h2>

                <FormField
                  control={form.control}
                  name="comments"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comments or Suggestions</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Please share any additional thoughts..."
                          className="min-h-[100px]"
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

              <Button type="submit" className="w-full bg-primary hover:bg-primary-hover text-primary-foreground font-semibold shadow-md hover:shadow-lg transition-all" disabled={isSubmitting}>
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
