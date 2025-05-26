import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "./ui/card"; // Assuming ./ui/card exists and is set up
import { Calendar, HelpCircle } from "lucide-react"; // Using HelpCircle for question count
import { format } from 'date-fns'; // For date formatting

// Define the structure of an Interview object based on your backend model
// This helps in typing the props and fetched data.
export interface Interview {
  id: string;
  name: string | null; // Name can be null
  created_at: string; // ISO date string
  questions_used: string[] | string | null; // Can be array, JSON string, or null
  transcription_text: string | null;
  status_transcription: string;
  status_analysis: string;
  status_coaching: string;
  // Add other fields as needed, e.g., analysis_results, coaching_feedback if you want to show status indicators
}

interface InterviewCardProps {
  interview: Interview;
  onClick?: (id: string) => void;
}

const InterviewCard: React.FC<InterviewCardProps> = ({
  interview,
  onClick,
}) => {
  const { id, name, created_at, questions_used } = interview;

  const formattedDate = created_at ? format(new Date(created_at), "PPP") : "N/A";
  
  let questionsArray: string[] = [];
  let questionsPreview: string = "No questions available for this interview."; // Default message

  try {
    if (Array.isArray(questions_used)) {
      questionsArray = questions_used;
    } else if (typeof questions_used === 'string' && questions_used.trim() !== '') {
      try {
        const parsed = JSON.parse(questions_used);
        if (Array.isArray(parsed)) {
          questionsArray = parsed;
        } else {
          // If it's a string but not a JSON array, treat it as a single question string (or part of one)
          // Or it could be an error in data. For now, we can assume it might be a single descriptive string if not an array.
          console.warn(`Parsed questions_used string for interview ${id} is not an array:`, parsed);
          questionsPreview = "Question data format is non-standard."; // A more specific message for this case
          // To be safe, don't push to questionsArray unless it's explicitly an array of strings
        }
      } catch (jsonError) {
        // If JSON.parse fails, it means it's not a JSON string. 
        // It could be a plain string (e.g. a single question, or legacy data).
        // We won't treat it as an array of questions here to avoid misinterpretation.
        console.warn(`questions_used for interview ${id} is a string but not valid JSON:`, questions_used);
        questionsPreview = "Questions data is a plain string or malformed.";
      }
    } else if (questions_used === null || (typeof questions_used === 'string' && questions_used.trim() === '')) {
      questionsPreview = "No question data provided for this interview.";
    } else {
      // Handle cases where questions_used is neither array, string, nor null (e.g. object, number)
      console.warn(`questions_used for interview ${id} is of unexpected type:`, typeof questions_used, questions_used);
      questionsPreview = "Question data is in an invalid format.";
    }

    // Update preview based on successfully populated questionsArray
    if (questionsArray.length > 0) {
      questionsPreview = `${questionsArray.length} question${questionsArray.length > 1 ? 's' : ''} answered.`;
    } else if (questionsPreview === "No questions available for this interview." && 
               (questions_used !== null && (Array.isArray(questions_used) || typeof questions_used === 'string'))) {
      // If no questions were extracted into array, but there *was* some form of question data,
      // use a more specific message than the initial default if not already set by an error condition.
      questionsPreview = "Could not extract individual questions.";
    }

  } catch (error) {
    console.error(`Error processing questions_used for interview ${id}:`, error, "Value was:", questions_used);
    questionsPreview = "Error displaying question data.";
  }

  const handleCardClick = () => {
    if (onClick) {
      onClick(id);
    }
  };

  return (
    <Card
      className="flex flex-col justify-between h-full shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer bg-white rounded-lg overflow-hidden"
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-gray-800 truncate">
          {name || "Untitled Interview"}
        </CardTitle>
        <div className="flex items-center text-xs text-gray-500 mt-1 space-x-3">
          <div className="flex items-center">
            <Calendar className="w-3.5 h-3.5 mr-1" />
            <span>{formattedDate}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow pb-3">
        <div className="flex items-start text-sm text-gray-600">
          <HelpCircle className="w-4 h-4 mr-1.5 mt-0.5 flex-shrink-0" />
          <CardDescription className="line-clamp-3">
            {questionsPreview}
          </CardDescription>
        </div>
      </CardContent>
      {/* You can add a CardFooter here if needed for status icons or actions */}
    </Card>
  );
};

export default InterviewCard; 