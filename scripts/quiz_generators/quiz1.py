import json
import re
import os

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
            
        print(f"Successfully created: {output_path}")
        return True
    
    except Exception as e:
        print(f"Error processing {input_path}: {str(e)}")
        return False

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Process all files ending with _format.txt
    processed_files = 0
    for filename in os.listdir(script_dir):
        if filename.endswith("_format.txt"):
            input_path = os.path.join(script_dir, filename)
            output_filename = filename.replace("_format.txt", ".json")
            output_path = os.path.join(script_dir, output_filename)
            
            if process_file(input_path, output_path):
                processed_files += 1
                
    print(f"\nProcessing complete. {processed_files} files converted to JSON.")