import React from 'react';
import { format } from 'date-fns';
import { Medication, ClinicalAction } from './ClinicalActionsPanel';

interface PatientLetterPreviewProps {
  patientCopy: string;
  summaryLine?: string;
  consultationType?: string;
  consultationDate?: Date;
  clinicalActions?: ClinicalAction;
  review?: string;
  referral?: string;
}

export const PatientLetterPreview: React.FC<PatientLetterPreviewProps> = ({
  patientCopy,
  summaryLine,
  consultationType,
  consultationDate,
  clinicalActions,
  review,
  referral
}) => {
  const consultDate = consultationDate || new Date();
  const formattedDate = format(consultDate, 'EEEE, do MMMM yyyy');

  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900 shadow-lg rounded-lg p-8 md:p-12">
      {/* Header with decorative line */}
      <div className="border-t-4 border-blue-600 mb-8" />
      
      {/* Letter heading */}
      <h1 className="text-4xl font-bold text-blue-800 dark:text-blue-400 text-center mb-4">
        Your Consultation Summary
      </h1>
      
      {/* Date and consultation type */}
      <p className="text-center text-gray-600 dark:text-gray-400 italic mb-2">
        {formattedDate}
      </p>
      
      {consultationType && (
        <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
          Consultation Type: {consultationType}
        </p>
      )}
      
      {/* Decorative separator */}
      <p className="text-center text-gray-400 my-6">• • •</p>
      
      {/* Greeting */}
      <div className="space-y-4 mb-8">
        <p className="text-lg font-semibold">Dear Patient,</p>
        <p className="text-base leading-relaxed text-justify">
          Thank you for attending your consultation. This letter provides a detailed summary of our discussion, 
          the care plan we have agreed upon together, and important information about your ongoing care.
        </p>
      </div>
      
      {/* What We Discussed */}
      <div className="mb-10">
        <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-400 mb-4 border-b-2 border-blue-200 dark:border-blue-800 pb-2">
          What We Discussed Today
        </h2>
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <p className="text-base leading-relaxed whitespace-pre-wrap text-justify">
            {patientCopy}
          </p>
        </div>
      </div>
      
      {/* Medications Section */}
      {clinicalActions?.medications && clinicalActions.medications.length > 0 && (
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-400 mb-4 border-b-2 border-blue-200 dark:border-blue-800 pb-2">
            Your Medications
          </h2>
          <p className="text-base font-semibold mb-3">
            We have made the following changes to your medications:
          </p>
          <ul className="space-y-2 ml-6 mb-4">
            {clinicalActions.medications.map((med, idx) => {
              // Handle both string and object formats
              const medText = typeof med === 'string' 
                ? med 
                : med.name 
                  ? `${med.name}${med.dose ? ` ${med.dose}` : ''}${med.instructions ? ` - ${med.instructions}` : ''}`
                  : JSON.stringify(med);
              
              return (
                <li key={idx} className="text-base leading-relaxed flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                  <span className="flex-1">{medText}</span>
                </li>
              );
            })}
          </ul>
          
          <p className="text-base font-semibold text-blue-800 dark:text-blue-400 mb-2">
            Why these changes?
          </p>
          <p className="text-base leading-relaxed text-justify mb-4">
            These medication changes have been made to help improve your health based on our discussion today. 
            Each medication has been carefully chosen to address your specific needs. Please take them exactly 
            as prescribed and contact us if you experience any unexpected side effects.
          </p>
          
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded">
            <p className="text-base">
              <span className="font-bold">💊 Important: </span>
              <span className="italic">
                If you have any questions about your medications, please speak to your pharmacist or contact 
                the surgery. Never stop taking prescribed medications without consulting your doctor first.
              </span>
            </p>
          </div>
        </div>
      )}
      
      {/* Tests and Investigations */}
      {clinicalActions?.investigations && clinicalActions.investigations.length > 0 && (
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-400 mb-4 border-b-2 border-blue-200 dark:border-blue-800 pb-2">
            Tests and Investigations
          </h2>
          <p className="text-base mb-3">
            We have arranged the following tests to help monitor your condition:
          </p>
          <ul className="space-y-2 ml-6 mb-4">
            {clinicalActions.investigations.map((inv, idx) => (
              <li key={idx} className="text-base font-semibold flex items-start gap-2">
                <span>🔬</span>
                <span>{inv}</span>
              </li>
            ))}
          </ul>
          <p className="text-base leading-relaxed text-justify">
            You will be contacted with the results once they are available. If any action is needed, 
            we will discuss this with you.
          </p>
        </div>
      )}
      
      {/* Follow-up Appointments */}
      {clinicalActions?.followUp && clinicalActions.followUp.length > 0 && (
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-400 mb-4 border-b-2 border-blue-200 dark:border-blue-800 pb-2">
            Your Follow-Up Plan
          </h2>
          <p className="text-base mb-3">
            To ensure your ongoing care, we have arranged the following:
          </p>
          <ul className="space-y-2 ml-6 mb-4">
            {clinicalActions.followUp.map((fu, idx) => (
              <li key={idx} className="text-base flex items-start gap-2">
                <span>📅</span>
                <span className="flex-1">{fu}</span>
              </li>
            ))}
          </ul>
          <p className="text-base italic text-gray-600 dark:text-gray-400 leading-relaxed text-justify">
            Please mark these dates in your calendar. If you need to change any appointments, 
            please contact the surgery as soon as possible.
          </p>
        </div>
      )}
      
      {/* Safety Netting */}
      {review && (
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-red-700 dark:text-red-400 mb-4 border-b-2 border-red-200 dark:border-red-800 pb-2">
            When to Seek Further Help
          </h2>
          <p className="text-xl font-bold text-red-700 dark:text-red-400 mb-3">
            🚨 Important Safety Information
          </p>
          <div className="prose prose-sm max-w-none dark:prose-invert mb-4">
            <p className="text-base leading-relaxed whitespace-pre-wrap text-justify">
              {review}
            </p>
          </div>
          
          <p className="text-base font-semibold mb-3">
            If you experience any of the above symptoms or are concerned about your condition worsening, please:
          </p>
          <ul className="space-y-2 ml-6 mb-4">
            <li className="text-base flex items-start gap-2">
              <span>⚠️</span>
              <span>Contact the surgery during working hours (Monday-Friday, 08:00-18:30)</span>
            </li>
            <li className="text-base flex items-start gap-2">
              <span>⚠️</span>
              <span>Call NHS 111 for urgent advice outside of surgery hours</span>
            </li>
            <li className="text-base flex items-start gap-2">
              <span>⚠️</span>
              <span>Call 999 or go to A&E if you have a medical emergency</span>
            </li>
          </ul>
        </div>
      )}
      
      {/* Referral Information */}
      {referral && !referral.toLowerCase().includes('no referral') && !referral.toLowerCase().includes('not indicated') && (
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-400 mb-4 border-b-2 border-blue-200 dark:border-blue-800 pb-2">
            Specialist Referral
          </h2>
          <p className="text-base mb-3">
            We have referred you to a specialist for further assessment and treatment. Here are the details:
          </p>
          <div className="prose prose-sm max-w-none dark:prose-invert mb-4">
            <p className="text-base leading-relaxed whitespace-pre-wrap text-justify">
              {referral}
            </p>
          </div>
          <p className="text-base italic text-gray-600 dark:text-gray-400 leading-relaxed text-justify">
            You should receive an appointment letter within the next few weeks. If you do not hear anything 
            within 4 weeks, please contact the surgery.
          </p>
        </div>
      )}
      
      {/* Useful Resources */}
      <div className="mb-10">
        <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-400 mb-4 border-b-2 border-blue-200 dark:border-blue-800 pb-2">
          Helpful Information and Resources
        </h2>
        <p className="text-base mb-4">
          The following websites provide reliable, NHS-approved information about your condition:
        </p>
        
        <div className="space-y-4 ml-6">
          <div>
            <p className="text-base">
              <span>🌐 </span>
              <span className="font-bold text-blue-600 dark:text-blue-400">NHS Website: </span>
              <span className="italic text-gray-600 dark:text-gray-400">www.nhs.uk</span>
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 ml-8">
              Comprehensive health information and advice
            </p>
          </div>
          
          <div>
            <p className="text-base">
              <span>🌐 </span>
              <span className="font-bold text-blue-600 dark:text-blue-400">Patient.info: </span>
              <span className="italic text-gray-600 dark:text-gray-400">www.patient.info</span>
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 ml-8">
              Detailed leaflets about conditions and treatments
            </p>
          </div>
          
          <div>
            <p className="text-base">
              <span>🌐 </span>
              <span className="font-bold text-blue-600 dark:text-blue-400">British Heart Foundation: </span>
              <span className="italic text-gray-600 dark:text-gray-400">www.bhf.org.uk</span>
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 ml-8">
              If you have heart or circulation concerns
            </p>
          </div>
          
          <div>
            <p className="text-base">
              <span>🌐 </span>
              <span className="font-bold text-blue-600 dark:text-blue-400">Diabetes UK: </span>
              <span className="italic text-gray-600 dark:text-gray-400">www.diabetes.org.uk</span>
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 ml-8">
              Support and information for diabetes management
            </p>
          </div>
          
          <div>
            <p className="text-base">
              <span>🌐 </span>
              <span className="font-bold text-blue-600 dark:text-blue-400">NHS 111 Online: </span>
              <span className="italic text-gray-600 dark:text-gray-400">www.111.nhs.uk</span>
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 ml-8">
              Get urgent medical advice online
            </p>
          </div>
        </div>
        
        <p className="text-base mt-4">
          <span className="font-bold">💡 Tip: </span>
          <span className="italic">
            Always check that health websites are NHS-approved or from reputable medical organisations. 
            Be cautious of unofficial sources.
          </span>
        </p>
      </div>
      
      {/* Decorative separator */}
      <p className="text-center text-gray-400 my-8">• • •</p>
      
      {/* Important Reminders */}
      <div className="mb-10">
        <h2 className="text-xl font-bold text-blue-800 dark:text-blue-400 mb-4">
          Important Reminders
        </h2>
        <ul className="space-y-2 ml-6">
          <li className="text-base leading-relaxed flex items-start gap-2">
            <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
            <span className="flex-1">Keep this letter for your personal records and bring it to future appointments.</span>
          </li>
          <li className="text-base leading-relaxed flex items-start gap-2">
            <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
            <span className="flex-1">Make sure you understand your care plan - if anything is unclear, please contact the surgery.</span>
          </li>
          <li className="text-base leading-relaxed flex items-start gap-2">
            <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
            <span className="flex-1">Attend all scheduled follow-up appointments and tests.</span>
          </li>
          <li className="text-base leading-relaxed flex items-start gap-2">
            <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
            <span className="flex-1">Take your medications exactly as prescribed.</span>
          </li>
          <li className="text-base leading-relaxed flex items-start gap-2">
            <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
            <span className="flex-1">Monitor your symptoms and seek help if they worsen.</span>
          </li>
          <li className="text-base leading-relaxed flex items-start gap-2">
            <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
            <span className="flex-1">Use the NHS resources provided to learn more about your condition.</span>
          </li>
          <li className="text-base leading-relaxed flex items-start gap-2">
            <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
            <span className="flex-1">If you have any questions or concerns, we are here to help - please do not hesitate to contact us.</span>
          </li>
        </ul>
      </div>
      
      {/* Closing */}
      <div className="mb-8">
        <p className="text-base italic mb-2">
          With best wishes for your continued health,
        </p>
        <p className="text-base font-bold">
          Your GP Practice Team
        </p>
      </div>
      
      {/* Footer with decorative line */}
      <div className="border-b-4 border-blue-600 mt-8 mb-6" />
      
      <div className="text-center space-y-2">
        <p className="text-sm italic text-gray-500 dark:text-gray-400">
          This letter is for your personal records
        </p>
        <p className="text-sm italic text-gray-500 dark:text-gray-400">
          Generated: {format(new Date(), 'do MMMM yyyy, HH:mm')}
        </p>
      </div>
    </div>
  );
};
