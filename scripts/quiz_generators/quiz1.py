import json
import re
from pathlib import Path

def parse_questions(content):
    questions = []
    current = {}
    state = None
    explanation_buffer = []

    for line in content.split('\n'):
        line = line.strip()
        if not line:
            continue

        # Detect question
        if re.match(r'^\d+\. ', line):
            if current:
                if explanation_buffer:
                    current['e'] = ' '.join(explanation_buffer).strip()
                    explanation_buffer = []
                questions.append(current)
            current = {
                'q': re.sub(r'^\d+\.\s*', '', line),
                'c': [],
                'a': '',
                'e': ''
            }
            state = 'question'
            continue

        # Detect choices
        if re.match(r'^[A-Z]\s', line) and state in ('question', 'choices'):
            state = 'choices'
            current['c'].append(re.sub(r'^[A-Z]\s*', '', line))
            continue

        # Detect answer
        if line.startswith('-'):
            state = 'answer'
            answer_letter = line[1:].strip()
            if current['c'] and len(answer_letter) == 1:
                index = ord(answer_letter.upper()) - ord('A')
                if 0 <= index < len(current['c']):
                    current['a'] = current['c'][index]
            continue

        # Detect explanation
        if line.startswith('--'):
            state = 'explanation'
            explanation_buffer.append(line[2:].strip())
            continue

        # Handle continuation lines
        if state == 'explanation' and explanation_buffer:
            explanation_buffer.append(line.strip())
        elif state == 'choices' and current['c']:
            current['c'][-1] += ' ' + line.strip()

    if current:
        if explanation_buffer:
            current['e'] = ' '.join(explanation_buffer).strip()
        questions.append(current)

    return questions

def process_file(input_path, output_path):
    try:
        with open(input_path, 'r') as f:
            content = f.read()
        
        questions = parse_questions(content)
        
        with open(output_path, 'w') as f:
            json.dump(questions, f, indent=2)
        return True  # Indicate success
    except Exception as e:
        print(f"Error processing {input_path}: {str(e)}")
        return False  # Indicate failure

if __name__ == "__main__":
    script_dir = Path(__file__).parent
    output_dir = Path.cwd() / "OutputFiles"  # Changed: Use current working directory
    output_dir.mkdir(exist_ok=True)
    
    processed_inputs = []
    for input_path in output_dir.glob('*_format.txt'):
        print(f"\nProcessing file: {input_path}")
        output_filename = input_path.name.replace('_format.txt', '_quiz1.json')
        output_path = output_dir / output_filename
        if process_file(input_path, output_path):
            processed_inputs.append(input_path)
        print(f"\nFile '{output_filename}' created.")
    
    if processed_inputs:
        response = input("\nWould you like to delete the original input files now? [y/N] ").strip().lower()
        if response in ('y', 'yes'):
            deleted_count = 0
            for path in processed_inputs:
                try:
                    path.unlink()
                    deleted_count += 1
                except Exception as e:
                    print(f"Error deleting {path}: {e}")
            print(f"Deleted {deleted_count} input files.")
        else:
            print("Input files were not deleted.")
    else:
        print("No input files were processed.")
        