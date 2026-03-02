-- Fix Jessica's Meeting 2 transcript crossover: remove first 1,617 characters (Angela's content)
UPDATE meetings
SET best_of_all_transcript = SUBSTRING(best_of_all_transcript FROM 1618)
WHERE id = 'dfb86972-ca8a-470a-9751-8a6c872e0707';