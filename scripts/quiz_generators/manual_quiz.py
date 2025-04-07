import json
import re
from pathlib import Path

# --- Formatting Logic (manual_format.py) ---
def format_file(input_path, output_path):
    try:
        with open(input_path, 'r') as infile:
            lines = infile.readlines()
    except Exception as e:
        print(f"Error opening file: {str(e)}")
        return False

    processed = []
    current_choices = []
    explanation = []
    state = "start"

    for line in lines:
        raw_line = line.strip()
        if not raw_line:
            continue

        # Detect new question (e.g., "1. ...")
        if re.match(r'^\d+\. ', raw_line):
            if state != "start":
                processed.extend(current_choices)
                current_choices = []
                if explanation:
                    processed.append("--" + ' '.join(explanation))
                    explanation = []
            processed.append(raw_line)
            state = "question"

        # Detect choice lines (e.g., "A. Core" -> "A Core")
        elif re.match(r'^([A-Z])\.\s+', raw_line) and state in ("question", "choices"):
            state = "choices"
            letter = raw_line[0]
            choice_text = re.sub(r'^[A-Z]\.\s*', '', raw_line).strip()
            current_choices.append(f"{letter} {choice_text}")

        # Detect answer lines (e.g., "C., B., A." -> "-CBA")
        elif state == "choices":
            # Check if the line contains answer letters
            answer_letters = re.findall(r'\b([A-Z])\b', raw_line)
            if answer_letters:
                # Split line into choice and answer parts
                choice_part = re.sub(r'[A-Z][.,]?.*$', '', raw_line).strip()
                if choice_part:
                    # Extract choice letter and text
                    choice_match = re.match(r'^([A-Z])\s+(.*)', choice_part)
                    if choice_match:
                        letter = choice_match.group(1)
                        choice_text = choice_match.group(2)
                        current_choices.append(f"{letter} {choice_text}")
                # Add answer line
                processed.extend(current_choices)
                processed.append(f"-{''.join(answer_letters)}")
                current_choices = []
                state = "answer"
                continue

        # Detect explanation (e.g., "--Explanation...")
        elif raw_line.startswith('--'):
            state = "explanation"
            explanation.append(raw_line[2:].strip())

        # Handle continuation lines
        else:
            if state == "choices" and current_choices:
                current_choices[-1] += " " + raw_line.strip()
            elif state == "explanation":
                explanation.append(raw_line.strip())

    # Finalize last question
    processed.extend(current_choices)
    if explanation:
        processed.append("--" + ' '.join(explanation))

    try:
        with open(output_path, 'w') as outfile:
            outfile.write('\n'.join(processed))
        return True
    except Exception as e:
        print(f"Error writing output: {str(e)}")
        return False

# --- parses questions function ---
def parse_questions(content):
    questions = []
    current = {}
    explanation_buffer = []
    state = None

    for line in content.split('\n'):
        line = line.strip()
        if not line:
            continue

        # Detect new question (e.g., "1. ...")
        if re.match(r'^\d+\. ', line):
            if current:
                if explanation_buffer:
                    current['e'] = ' '.join(explanation_buffer)
                questions.append(current)
            current = {
                'q': re.sub(r'^\d+\.\s*', '', line),
                'c': [],
                'a': [],  # Now a list
                'e': ''
            }
            explanation_buffer = []
            state = "question"
            continue

        # Detect choices (e.g., "A Core")
        if re.match(r'^[A-Z]\s', line) and state in ("question", "choices"):
            state = "choices"
            choice_text = line.split(' ', 1)[1].strip()  # Extract text after letter
            current['c'].append(choice_text)
            continue

        # Detect answer (e.g., "-CBA")
        if line.startswith('-') and not line.startswith('--'):
            state = "answer"
            answer_part = line[1:].strip().upper().replace('.', '').replace(',', '')
            valid_answers = []
            for letter in answer_part:
                if letter.isalpha() and len(letter) == 1:
                    idx = ord(letter) - ord('A')
                    if 0 <= idx < len(current['c']):
                        valid_answers.append(current['c'][idx])
            current['a'] = valid_answers  # Store as list
            continue

        # Detect explanation (e.g., "--Explanation...")
        if line.startswith('--'):
            state = "explanation"
            explanation_buffer.append(line[2:].strip())
            continue

        # Handle continuation lines
        if state == "explanation":
            explanation_buffer.append(line.strip())
        elif state == "choices" and current['c']:
            current['c'][-1] += ' ' + line

    # Add the last question
    if current:
        if explanation_buffer:
            current['e'] = ' '.join(explanation_buffer)
        questions.append(current)

    return questions

def quiz_process_file(input_path, output_path):
    try:
        with open(input_path, 'r') as f:
            content = f.read()
        questions = parse_questions(content)
        with open(output_path, 'w') as f:
            json.dump(questions, f, indent=2)
        return True
    except Exception as e:
        print(f"Error processing {input_path}: {e}")
        return False

# --- Main Workflow ---
if __name__ == "__main__":
    script_dir = Path(__file__).parent
    output_dir = script_dir / "OutputFiles"
    output_dir.mkdir(exist_ok=True)

    # Step 1: Format *_rawm.txt -> *_format.txt
    format_files = []
    for input_path in script_dir.glob('*_rawm.txt'):
        output_path = output_dir / input_path.name.replace('_rawm.txt', '_format.txt')
        if format_file(input_path, output_path):
            format_files.append(output_path)
    
    # Step 2: Convert *_format.txt -> *.json and delete intermediates
    for format_file_path in output_dir.glob('*_format.txt'):
        # Remove "_format" from the filename
        json_filename = format_file_path.name.replace('_format.txt', '.json')
        json_path = output_dir / json_filename
        if quiz_process_file(format_file_path, json_path):
            format_file_path.unlink()  # Delete intermediate file
        print(f"Generated: {json_path.name}")