import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const UPDATED_CONTENT = `# CSO Training Content Export

This file contains all training module content from the Clinical Safety Officer Level 1 Training Programme. You can edit this content to make it more engaging and less dry, then I'll help you import it back into the system.

---

## Module 1: Introduction to Clinical Safety

### Section 1: Welcome to CSO Training

**Welcome, Doctor.**

You are likely here because you drew the short straw at the partners' meeting, or perhaps you have a genuine interest in why our computers sometimes seem determined to trip us up. Either way, welcome to the Clinical Safety Officer (CSO) Level 1 course.

This isn't just about IT; it's about **Clinical Safety**. In a world where we rely on EMIS, SystmOne, and Vision for everything from prescribing to referrals, a "glitch" isn't just annoying—it can be dangerous.

**Why this matters to you:**
*   **Protects Patients:** Prevents the computer from letting you prescribe penicillin to an allergic patient.
*   **Protects the Practice:** Keeps the CQC happy and ensures you meet your contractual obligations.
*   **Protects You:** Gives you a framework to say "No" to unsafe digital workflows.

**Key Points:**
- It's not about being an IT whizz; it's about clinical judgment.
- The goal is ensuring our digital tools help, not harm.
- You are learning to bridge the gap between "The Code" and "The Patient."

---

### Section 2: Role of the Clinical Safety Officer

Think of the CSO as the **Health & Safety Officer, but for Software**. Just as someone checks that the loose carpet in the waiting room won't trip a patient, the CSO checks that the new referral software won't lose a 2-week-wait referral.

**Your Mission Profile:**
*   **The Translator:** You speak 'Clinical' to the 'Techies' and explain reality to the Managers.
*   **The Detective:** When a script goes missing, you help figure out if it was a human error or a system flaw.
*   **The Gatekeeper:** You sign off on new systems (or changes) to say, "Yes, this is safe to use on our patients."

**Key Responsibilities:**
- **Risk Management**: spotting hazards before they hit a patient.
- **Governance**: Keeping the paperwork (DCB0129/0160) in check so the practice is covered.
- **Incident Learning**: If the system fails, we fix the system, we don't just blame the receptionist.

**Key Points:**
- You must be a clinician (GPs, Nurses, Pharmacists)—clinical judgment is required.
- You don't need to write code, you just need to understand workflow.
- It's a statutory role (NHS Digital says we need one).

---

### Section 3: Importance of Clinical Safety in Healthcare IT

We've all seen it. A pop-up fatigue that makes you miss a drug interaction. A dropdown menu that defaults to "Male" when the patient is "Female."

**The "Swiss Cheese" Model in IT:**
Digital systems are often the last slice of cheese. If the software fails, the patient gets harmed.

**Real-Primary-Care Scenarios:**
*   **The Wrong Dose:** A decimal point error in a script calculator suggests 10mg instead of 1.0mg.
*   **The Mixed ID:** Two "John Smiths" are merged incorrectly, and one gets the other's cancer diagnosis.
*   **The Lost Lab Result:** A pathology link breaks, and abnormal bloods sit in the ether for weeks.

**Key Points:**
- IT errors scale up fast (one bug can affect 10,000 patients).
- Clinical Safety is a legal duty, just like prescribing safely.
- Systematic management beats "hoping for the best."

---

### Section 4: Legal and Professional Responsibilities

Let's talk about the scary stuff (briefly) so we can stay out of court. As a CSO, you are acting on behalf of the practice to ensure safety.

**The Big Rules:**
*   **Health and Safety at Work Act**: You can't deploy dangerous tools.
*   **Data Protection (GDPR)**: You can't leak patient data.
*   **NHS Standards (DCB0129/0160)**: The mandatory standards we are learning about today.

**Your Professional License:**
As a GP, your GMC registration requires you to act in the patient's best interest. If you knowingly roll out a system that deletes every third appointment, that's a probity issue.

**The Golden Rule of Accountability:**
*If you didn't write it down, it didn't happen.* You must document your decisions. If you decide a risk is acceptable, **write down why**.

**Key Points:**
- Compliance isn't optional, but it can be proportionate.
- You are protected if you follow the process and document your reasoning.
- Always ask: "Would I be happy for my family to be treated using this system?"

---

## Module 2: Understanding DCB0129 (The Manufacturer)

### Section 1: Overview of DCB0129

**"What the Vendors Owe Us"**

DCB0129 is the standard for the people building the software (EMIS, TPP, Accurx, etc.). You don't need to *do* this standard, but you need to know it exists so you can hold vendors accountable.

**The Analogy:**
When you buy a car, you expect the manufacturer to have tested the brakes (DCB0129). When you drive the car, you are responsible for driving it safely (DCB0160).

**Key Points:**
- Applies to anyone *building* health software.
- If you build your own intricate Excel spreadsheet for calculating Warfarin doses... surprise! You might be a manufacturer under DCB0129.
- Vendors must prove their safety to you.

---

### Section 2: Key Requirements

**What to ask for:**
When a salesperson tries to sell the practice a new "AI-driven Triage Tool," you should ask: *"Can I see your DCB0129 Hazard Log?"*

**Documents they must have:**
1.  **Hazard Log**: A list of things that could go wrong and how they fixed them.
2.  **Clinical Safety Case**: The summary argument proving the software is safe.

**Key Points:**
- No Safety Case? No Purchase.
- If they stare at you blankly when you ask for DCB0129, run away.

---

### Section 3: Clinical Safety Case

The **Safety Case** is essentially the vendor's "Defence File."

It should clearly state:
*   "Here is what the software does."
*   "Here is what could kill someone."
*   "Here is why we are sure it won't."

**Why you care:**
You need to read the **"Residual Risks"** section. This tells you what risks *they* couldn't fix and have passed on to *you* to manage (e.g., "User must check patient DOB manually").

**Key Points:**
- It's an evidence-based argument, not a marketing brochure.
- Always check the 'known issues' or 'limitations'.

---

### Section 4: Hazard Management Process

How do vendors spot problems?

*   **Hazard ID:** Brainstorming what could go wrong.
*   **Risk Control:** Fixing it (e.g., making a 'Save' button greyed out until mandatory fields are filled).

**The Hierarchy of Controls (The hierarchy of "How good is the fix?"):**
1.  **Elimination:** The system prevents the error entirely. (Best)
2.  **Warning:** A pop-up box says "Are you sure?" (Okay, but we ignore these).
3.  **Training:** "Please tell staff not to click the red button." (Worst - humans forget).

**Key Points:**
- If a vendor's only safety measure is "User Training," be skeptical.
- Good design prevents errors; bad design just warns you about them.

---

## Module 3: Understanding DCB0160 (The Practice)

### Section 1: Overview of DCB0160

**"Our Side of the Bargain"**

This is the most important module for a GP CSO. DCB0160 is the standard for **Health Organizations** (that's us) who **deploy** technology.

**The Reality:**
Just because EMIS is safe, doesn't mean we are using it safely. If we turn off the allergy alerts because they are annoying, that's a DCB0160 failure.

**Who does this apply to?**
*   GP Practices.
*   PCNs deploying shared tools.
*   ICBs rolling out area-wide software.

**Key Points:**
- DCB0160 = The Deployer's (Practice's) Duty.
- It ensures safe implementation and use of the system.

---

### Section 2: Deployment Responsibilities

So, the partners want to install a new chaotic document management system. What do you do?

**The Step-by-Step:**
1.  **Get their Safety Case:** Read the vendor's safety docs.
2.  **The "Monday Morning" Test:** Look at their risks and apply them to your practice. Will this work when reception is swamped on a Monday?
3.  **Local Risk Assessment:** Identify *your* specific hazards (e.g., "Our locums won't know how to use this").
4.  **Mitigate:** Create a protocol, run training, or change a setting to make it safe.
5.  **Sign it off:** The CSO signs the "Clinical Safety Case Report" for the practice.

**Key Points:**
- You cannot rely solely on the vendor's word.
- Local context (staffing, locums, internet speed) changes risk.
- Don't go live until you've checked the safety.

---

### Section 3: Integration and Customization

**"But we've tweaked it..."**

GPs love a custom protocol or an Ardens template. But beware:

**The Risks:**
*   **Integration:** Does the new ECG machine actually talk to SystmOne? Or does it attach the PDF to the wrong patient?
*   **Customization:** If you build a custom template that auto-codes "Asthma Review" without checking inhaler technique, you've introduced a clinical risk.

**Best Practice:**
*   Keep customizations simple.
*   If you change the workflow, check the safety.
*   Test it on a dummy patient first!

**Key Points:**
- Connecting two safe systems can create one unsafe system.
- Custom templates need safety checks too.

---

### Section 4: Training and Competence

**"Does everyone know which button to press?"**

You can have the safest software in the world, but if the frantic locum doesn't know how to log in, it's a hazard.

**Requirements:**
*   **Competence:** Staff must be trained *before* they use the system live.
*   **Locums/Agency:** Include IT login/training in their induction pack.
*   **Workarounds:** If the system goes down, does everyone know where the paper referral forms are?

**Key Points:**
- Training is a patient safety issue, not just HR.
- "I didn't know how to use it" is not a valid defence in a coroner's court.

---

## Module 4: Hazard Identification Techniques

### Section 1: Systematic Approaches

How do you spot a digital death-trap? You can't just guess.

**Techniques for the Busy GP:**
1.  **Structured Walkthrough:** Follow a referral from the GP brain, to the keyboard, to the admin team, to the cloud, to the hospital. Where can it fall off the tracks?
2.  **The "What If" Game:** "What if the internet cuts out now?" "What if the patient has a twin?"
3.  **Failure Mode Analysis (FMEA):** Sounds fancy, just means: "How can this break, and how bad is it?"

**Key Points:**
- Don't do this alone in a dark room.
- Walk through the actual process at the desk.

---

### Section 2: Stakeholder Engagement

**"Ask the Receptionists"**

The Reception Manager knows more about system failures than the Senior Partner. They know where the bodies are buried (metaphorically, we hope).

**Who to ask:**
*   **Admin Team:** They know the workarounds and the "glitchy bits."
*   **Nurses:** They use different modules (vaccinations, dressings).
*   **Patients:** "Did you find the online booking easy, or did it let you book a smear test with the male physiotherapist?"

**Key Points:**
- Clinical Safety is a team sport.
- Frontline staff are your best hazard detectors.

---

### Section 3: Learning from Incidents

**"Don't waste a good crisis."**

When IT goes wrong, we usually swear at the screen and move on. Stop. Record it.

**Sources of Intel:**
*   **Significant Events:** That near-miss where a script went to the wrong pharmacy.
*   **Complaints:** "Why wasn't my letter sent?"
*   **Helpdesk Tickets:** If staff are constantly resetting passwords or reporting crashes, that's a safety risk.

**Key Points:**
- Past incidents predict future accidents.
- Look at other practices—if they had a disaster with System X, learn from it.

---

### Section 4: Documentation and Tracking

**The Hazard Log: Your Living Spreadsheet**

This is your main tool. It's just a spreadsheet (we have a template).

**What goes in it:**
1.  **Hazard:** "System defaults to immediate release Morphine."
2.  **Effect:** "Patient overdose."
3.  **Control:** "Warning pop-up added / Protocol changed."
4.  **Status:** "Open" (Panic) or "Closed" (Safe).

**Key Points:**
- If it's not in the Hazard Log, you can't manage it.
- Review this log once a year or when things change.

---

## Module 5: Risk Assessment and Management

### Section 1: Risk Assessment Methodology

**"How scary is it?"**

We use a 5x5 Matrix (Likelihood x Severity). It's the same one we use for everything else in the NHS.

**Likelihood:**
1 (Rare) to 5 (Happens every Tuesday).

**Severity:**
1 (Minor annoyance) to 5 (Catastrophic/Death).

**Example:**
*   **Printer jam:** Likelihood 5, Severity 1 = **Low Risk**.
*   **Allergy codes mapped incorrectly:** Likelihood 2, Severity 5 = **High Risk**.

**Key Points:**
- Be realistic.
- Prioritize the high scores.

---

### Section 2: Risk Evaluation

**ALARP: As Low As Reasonably Practicable**

We can't make things 100% safe. We can't wrap the server room in cotton wool.
ALARP means: "Have we done everything reasonable to stop this, without spending £1 million?"

**Accepting Risk:**
Sometimes, you have to accept a risk.
*Example:* "The system might go down if the internet cuts."
*Control:* "We have 4G dongles."
*Residual Risk:* "4G might also fail." -> **Accepted Risk** (We can't fix the laws of physics).

**Key Points:**
- You are allowed to accept risks, provided you have justified them.
- High risks need Partner/Senior sign-off.

---

### Section 3: Risk Control Strategies

**"Fixing the Glitch"**

When you find a risk, how do you fix it?

1.  **Design (Strong):** Configure EMIS to force a 'Reason for Referral' field.
2.  **Process (Medium):** Write a protocol: "Admin must double-check DOB."
3.  **Human (Weak):** "Try harder not to make mistakes."

**Key Points:**
- Always aim for Design/Forced controls.
- Protocols are okay, but humans get tired and hungry.
- "Staff to be vigilant" is not a valid safety control.

---

### Section 4: Residual Risk Management

**"What's left over?"**

After you've put in your controls, there is still some risk. This is the **Residual Risk**.

**The CSO's Job:**
Make sure the Partners know what the Residual Risks are before they sign the cheque.
*   "We are buying this system. It's great, BUT it doesn't check interactions with hospital meds. We accept this risk because the benefits outweigh it."

**Key Points:**
- Document the residual risk.
- Ensure the 'Risk Owner' (usually a Partner) signs it off.

---

## Module 6: Clinical Safety Case Development

### Section 1: Purpose and Structure

**The "Safety Case" Document**

This is the output of all your work. It sounds daunting, but for a small practice change, it can be 2-3 pages.

**Structure:**
1.  **What are we doing?** (Installing Accurx Triage).
2.  **What could go wrong?** (Missed urgent requests).
3.  **What did we do about it?** (Dedicated admin time, safety netting protocol).
4.  **Conclusion:** (We think it's safe to go live).

**Key Points:**
- Keep it simple and logical.
- It's a snapshot in time.

---

### Section 2: Building Safety Arguments

**"Show your working"**

A Safety Argument is just a claim backed by evidence.
*   **Claim:** "The patient lookup is safe."
*   **Evidence:** "We tested it with 50 dummy patients and it worked every time."

**Key Points:**
- Don't just say "It's safe." Say "It's safe because..."
- Use data, testing, or vendor assurances as evidence.

---

### Section 3: Evidence Collection

**"Trust, but Verify"**

You need proof.

**Types of Evidence:**
*   **Test Scripts:** Screenshots of you testing the system.
*   **Meeting Minutes:** "Discussed at partners meeting on 12th July."
*   **Vendor Docs:** The manual or DCB0129 certificate.
*   **Training Logs:** The sign-in sheet from the staff training session.

**Key Points:**
- Keep a folder (digital or physical) with this evidence.
- If the CQC walks in, hand them the folder.

---

### Section 4: Safety Case Review and Approval

**"The Sign-off"**

You (the CSO) write/review the safety case.
The **Practice Management/Partners** approve it.

**The Process:**
1.  Draft the case.
2.  Show it to a colleague ("Does this make sense?").
3.  Present to the Partners.
4.  **Get a signature.**

**Key Points:**
- Never deploy without approval.
- The signature transfers liability from "You" to "The Organization."

---

## Module 7: Incident Management and Learning

### Section 1: Incident Identification and Reporting

**"See something, Say something"**

In Primary Care, we tolerate a lot of bad IT. We develop workarounds. Stop it.

**Reportable Incidents:**
*   Data breaches (obviously).
*   System unavailability (if it impacted care).
*   Data integrity errors (wrong info in notes).
*   "Near misses" (I almost prescribed the wrong thing because the box jumped).

**Key Points:**
- Encourage a "Just Culture"—no blaming staff for system flaws.
- Make reporting easy (e.g., an email to the Practice Manager).

---

### Section 2: Incident Investigation

**"CSI: GP Practice"**

When an IT incident happens, ask **Why?** five times.

*Example:* Referral wasn't sent.
1.  **Why?** Secretary didn't click send.
2.  **Why?** She was interrupted by the phone.
3.  **Why?** The system doesn't auto-save drafts.
4.  **Why?** It's a poorly designed system.

**Root Cause:** Poor software design + distractible environment.
**Solution:** Enable auto-save or protect admin time.

**Key Points:**
- Dig deeper than "Human Error."
- Fix the system, not the person.

---

### Section 3: Corrective and Preventive Actions

**Fix it, then Stop it happening again.**

*   **Corrective:** Apologize to patient, send the referral, update the notes.
*   **Preventive:** Update the protocol, retrain staff, or switch off the risky feature.

**Key Points:**
- Action plans need owners and deadlines.
- Follow up to check it actually worked.

---

### Section 4: Learning and Improvement

**Share the knowledge.**

If you found a bug in EMIS, chances are the practice down the road has it too.
*   Discuss at PCN meetings.
*   Report to the vendor (they need to know!).
*   Report to NHS Digital/MHRA if it's a medical device failure.

**Key Points:**
- We are all in this together.
- Reporting leads to software patches.

---

## Module 8: Post-Deployment Monitoring and Maintenance

### Section 1: Ongoing Safety Monitoring

**"Is it still working?"**

You don't just launch and leave.

**Things to watch:**
*   Are staff using "Workarounds"? (e.g., writing things on post-its because the system is too slow).
*   Has the vendor released a "Patch" that changed how things work?
*   Are error rates creeping up?

**Key Points:**
- Put "Clinical Safety" on the agenda for your quarterly practice meeting.
- Keep an eye on "Post-it Note" culture—it indicates system failure.

---

### Section 2: Change Management

**"The Update of Doom"**

Software updates happen. Sometimes they move buttons. Sometimes they break things.

**The Rule:**
Any significant change needs a quick safety check.
*   "Oh, they've updated the referral form. Let's test it on a dummy patient before Monday morning clinic."

**Key Points:**
- Don't let updates surprise you.
- Read the "Release Notes" (boring, but essential).

---

### Section 3: Periodic Safety Reviews

**The Annual MOT**

Once a year, dust off the Hazard Log.
*   Are these risks still real?
*   Have we had any incidents?
*   Is the training still up to date?

**Key Points:**
- Schedule this in your diary now.
- Keep the documentation alive.

---

### Section 4: System Retirement

**"The Digital Graveyard"**

Switching off an old system is risky.
*   **Data Migration:** Did all the patient notes transfer to the new system?
*   **Access:** Can we still view the old archive if we need to defend a claim in 5 years?

**Key Points:**
- Don't just pull the plug.
- Ensure you have read-only access to historic data.

---

## Summary

**Congratulations, CSO!**

You have survived the Clinical Safety Officer Level 1 Training.

**Your Takeaways:**
1.  **It's about patients:** Bad IT hurts people. You are the shield.
2.  **Documentation is key:** If you assess a risk, write it down.
3.  **DCB0160 is your friend:** It gives you the authority to demand safe systems.
4.  **You are not alone:** Use your team, ask vendors for proof, and work with your practice partners.

Go forth and make your practice safer, one risk assessment at a time.

---

## Instructions for Editing and Re-importing

1.  **Edit the content** in this file to make it more engaging, add examples, case studies, or interactive elements
2.  **Keep the structure** - maintain the module and section organization
3.  **Preserve key points** - ensure essential safety information remains
4.  **Save your changes** to this file
5.  **Let me know** when you're ready and I'll help you import the updated content back into the system

The content will be parsed and converted back into the TypeScript data structure for the application.`;

export default function CSOTrainingContentExport() {
  return (
    <div className="min-h-screen bg-background p-8">
      <Card className="max-w-5xl mx-auto">
        <CardHeader>
          <CardTitle>CSO Training Content Export</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-slate dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {UPDATED_CONTENT}
          </ReactMarkdown>
        </CardContent>
      </Card>
    </div>
  );
}
