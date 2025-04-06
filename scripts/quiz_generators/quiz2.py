import json
import re
from pathlib import Path

# Get the directory where the script is located
script_dir = Path(__file__).parent

# Dynamically locate the _q and _a files in the same directory
q_file_path = next(script_dir.glob('*_q.txt'), None)
a_file_path = next(script_dir.glob('*_a.txt'), None)

if not q_file_path or not a_file_path:
    raise FileNotFoundError("Could not find files ending with '_q.txt' or '_a.txt' in the script directory.")

# Generate the output JSON file name by replacing '_q' with '_quiz' in the _q file name
output_json_path = script_dir / f"{q_file_path.stem.replace('_q', '_quiz')}.json"

# Strip the capital letter and space from the beginning of a string
def strip_choice_prefix(text):
    return re.sub(r'^[A-Z]\s', '', text)

# Strip the number and period from the beginning of a question
def strip_question_prefix(text):
    return re.sub(r'^\d{1,2}\.\s', '', text)

# Main function
def main():
    combined_data = []
    q_line_number = 0
    a_line_number = 0

    with open(q_file_path, 'r') as q_file, open(a_file_path, 'r') as a_file:
        q_lines = q_file.readlines()
        a_lines = a_file.readlines()

        while q_line_number < len(q_lines) and a_line_number < len(a_lines):
            # Skip lines that are empty in _q file
            while q_line_number < len(q_lines) and (not q_lines[q_line_number].strip()):
                q_line_number += 1

            # Skip lines that are empty in _a file
            while a_line_number < len(a_lines) and (not a_lines[a_line_number].strip()):
                a_line_number += 1

            # Find the next line in _q that starts with a number
            q_match = re.match(r'^(\d{1,2})\.\s', q_lines[q_line_number].strip()) if q_line_number < len(q_lines) else None
            # Find the next line in _a that starts with a number
            a_match = re.match(r'^(\d{1,2})', a_lines[a_line_number].strip()) if a_line_number < len(a_lines) else None

            if q_match and a_match:
                q_number = int(q_match.group(1))
                a_number = int(a_match.group(1))

                # If the numbers match, process the question and answer
                if q_number == a_number:
                    # Parse the question and choices (keep the letter prefix for now)
                    q_text = strip_question_prefix(q_lines[q_line_number].strip())  # Strip the number from the question
                    choices = []
                    q_line_number += 1
                    while q_line_number < len(q_lines) and re.match(r'^[A-Z]\s', q_lines[q_line_number].strip()):
                        choices.append(q_lines[q_line_number].strip())  # Keep the letter prefix
                        q_line_number += 1

                    # Parse the answer and explanation
                    a_line_number += 1
                    if a_line_number < len(a_lines) and a_lines[a_line_number].startswith('-'):
                        answer_line = a_lines[a_line_number].strip().lstrip('-')
                        answer_letters = list(answer_line)
                        a_line_number += 1
                        if a_line_number < len(a_lines) and a_lines[a_line_number].startswith('--'):
                            explanation_line = a_lines[a_line_number].strip().lstrip('--')
                            a_line_number += 1
                        else:
                            explanation_line = ''

                        # Map answer letters to their corresponding choice text (keep the letter prefix for now)
                        full_answers = []
                        for letter in answer_letters:
                            matching_choice = next((choice for choice in choices if choice.startswith(letter)), None)
                            if matching_choice:
                                full_answers.append(matching_choice)  # Keep the letter prefix
                            else:
                                continue

                        # Strip the letter prefix from choices and answers before adding to JSON
                        stripped_choices = [strip_choice_prefix(choice) for choice in choices]
                        stripped_answers = [strip_choice_prefix(answer) for answer in full_answers]

                        # Add to combined data
                        combined_data.append({
                            'q': q_text,
                            'c': stripped_choices,
                            'a': stripped_answers,
                            'e': explanation_line
                        })
                    else:
                        print(f"Error: Missing answer line for question {q_number} at line {a_line_number + 1} in _a file.")
                else:
                    # If the numbers don't match, print the line numbers and stop
                    print(f"Mismatch found: Question {q_number} at line {q_line_number + 1} in _q file does not match answer {a_number} at line {a_line_number + 1} in _a file.")
                    break
            else:
                # If no more numbers are found, stop
                break

    # Write to JSON file
    with open(output_json_path, 'w') as json_file:
        json.dump(combined_data, json_file, indent=4)
    
    print(f"JSON file created successfully at {output_json_path}")

if __name__ == '__main__':
    main()